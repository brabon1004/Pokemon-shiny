import { useId, useRef, useState } from 'react'
import { useCompactLayout } from '../hooks/useCompactLayout.ts'
import { formatEventEnd } from '../lib/event-end.ts'
import { formatCount, formatOdds } from '../lib/format.ts'
import { filterByName, sortByBestOdds } from '../lib/rows.ts'
import { selectRowsByTab, TAB_DETAILS, TAB_IDS, TAB_PANEL_ID, tabElementId, type TabId } from '../lib/tabs.ts'
import { groupWildByEvent } from '../lib/wild-groups.ts'
import type { Combined, Row } from '../shared/contract.ts'
import { Calculator } from './Calculator.tsx'
import { CalculatorSheet } from './CalculatorSheet.tsx'
import { RowCard } from './RowCard.tsx'
import { SiteFooter } from './SiteFooter.tsx'
import { SiteHeader } from './SiteHeader.tsx'
import { TabBar } from './TabBar.tsx'
import { TierLegend } from './TierLegend.tsx'

/** All Pokémon can hold over a thousand rows, so it renders in pages of this size. */
const ALL_PAGE_SIZE = 60

interface ShinyOddsPageProps {
  data: Combined
  now: Date
  isSample: boolean
}

export function ShinyOddsPage({ data, now, isSample }: ShinyOddsPageProps) {
  const rowsByTab = selectRowsByTab(data, now)
  // Chosen once on load, so a later data refresh never moves the reader off the tab they're on.
  const [activeTab, setActiveTab] = useState<TabId>(() => TAB_IDS.find((tab) => rowsByTab[tab].length > 0) ?? 'wild')
  const [query, setQuery] = useState('')
  const [visibleLimit, setVisibleLimit] = useState(ALL_PAGE_SIZE)
  const [denomInput, setDenomInput] = useState('64')
  const [encountersInput, setEncountersInput] = useState('50')
  const [announcement, setAnnouncement] = useState('')
  /** "Kyogre · 1 in 20" while the phone sheet is open for a tapped row; cleared when opened from the header. */
  const [pickedRowLabel, setPickedRowLabel] = useState('')
  const calculatorId = useId()
  const isCompact = useCompactLayout()
  const sheetRef = useRef<HTMLDialogElement>(null)

  const matchingRows = sortByBestOdds(filterByName(rowsByTab[activeTab], query))
  const isPaged = activeTab === 'all'
  const shownRows = isPaged ? matchingRows.slice(0, visibleLimit) : matchingRows
  const details = TAB_DETAILS[activeTab]
  const emptyMessage = query.trim() === '' ? details.emptyMessage : 'No Pokémon match that search.'

  function selectTab(tab: TabId) {
    setActiveTab(tab)
    setVisibleLimit(ALL_PAGE_SIZE)
    // The phone tab bar stays on screen, so a new list would otherwise open partway down.
    if (isCompact && window.scrollY > 0) window.scrollTo({ top: 0 })
  }

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery)
    setVisibleLimit(ALL_PAGE_SIZE)
  }

  function loadIntoCalculator(row: Row) {
    if (row.denom === null) return
    setDenomInput(String(row.denom))
    setAnnouncement(`Calculator set to ${row.name} odds, ${formatOdds(row.denom)}.`)
    setPickedRowLabel(`${row.name} · ${formatOdds(row.denom)}`)
    if (isCompact) openCalculatorSheet()
  }

  function openCalculatorFromHeader() {
    setPickedRowLabel('')
    openCalculatorSheet()
  }

  function openCalculatorSheet() {
    const sheet = sheetRef.current
    if (sheet !== null && !sheet.open) sheet.showModal()
  }

  const calculator = (
    <Calculator
      headingId={`${calculatorId}-heading`}
      subtitle={isCompact && pickedRowLabel !== '' ? { id: `${calculatorId}-picked`, text: pickedRowLabel } : undefined}
      denomInput={denomInput}
      encountersInput={encountersInput}
      onDenomInputChange={setDenomInput}
      onEncountersInputChange={setEncountersInput}
    />
  )

  return (
    <div className="page">
      <div className="page__inner">
        <SiteHeader
          generatedAt={data.generatedAt}
          now={now}
          query={query}
          onQueryChange={changeQuery}
          onOpenCalculator={isCompact ? openCalculatorFromHeader : undefined}
        />
        {isSample && (
          <p className="notice">Showing sample data. The live data file isn't available on this dev server.</p>
        )}
        <TabBar activeTab={activeTab} rowsByTab={rowsByTab} onSelect={selectTab} />

        <main className="layout">
          <div
            id={TAB_PANEL_ID}
            className="results"
            role="tabpanel"
            aria-labelledby={tabElementId(activeTab)}
            tabIndex={0}
          >
            <div className="results__header">
              <h2 className="results__title">{details.title}</h2>
              <span className="muted">Sorted by best odds</span>
              {details.note !== undefined && <p className="results__note">{details.note}</p>}
            </div>
            {shownRows.length > 0 && activeTab === 'wild' ? (
              groupWildByEvent(shownRows).map((group) => {
                const eventEnd = group.window === undefined ? null : formatEventEnd(group.window)
                return (
                  <section key={group.key} className="event-group">
                    <div className="event-group__header">
                      <h3 className="event-group__title">{group.event}</h3>
                      {eventEnd !== null && <span className="event-group__until">{eventEnd}</span>}
                    </div>
                    <div className="card-grid">
                      {group.rows.map((row) => (
                        <RowCard key={row.key} row={row} tiers={data.tiers} onCalculate={loadIntoCalculator} isInEventGroup />
                      ))}
                    </div>
                  </section>
                )
              })
            ) : shownRows.length > 0 ? (
              <div className="card-grid">
                {shownRows.map((row) => (
                  <RowCard key={row.key} row={row} tiers={data.tiers} onCalculate={loadIntoCalculator} />
                ))}
              </div>
            ) : (
              <p className="empty-state">{emptyMessage}</p>
            )}
            {isPaged && matchingRows.length > ALL_PAGE_SIZE && (
              <div className="results__more">
                <p className="muted">
                  Showing {formatCount(shownRows.length)} of {formatCount(matchingRows.length)}. Search to
                  find a Pokémon faster.
                </p>
                {shownRows.length < matchingRows.length && (
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => setVisibleLimit((limit) => limit + ALL_PAGE_SIZE)}
                  >
                    Show more
                  </button>
                )}
              </div>
            )}
          </div>

          {!isCompact && calculator}
          <TierLegend tiers={data.tiers} isCollapsible={isCompact} />
        </main>
        {isCompact && (
          <CalculatorSheet
            ref={sheetRef}
            labelledBy={`${calculatorId}-heading`}
            describedBy={pickedRowLabel === '' ? undefined : `${calculatorId}-picked`}
          >
            {calculator}
          </CalculatorSheet>
        )}

        <p className="visually-hidden" role="status">
          {announcement}
        </p>
        <SiteFooter />
      </div>
    </div>
  )
}
