import { useRef, type KeyboardEvent } from 'react'
import { formatCount } from '../lib/format.ts'
import { TAB_DETAILS, TAB_IDS, TAB_PANEL_ID, tabElementId, type TabId } from '../lib/tabs.ts'
import type { Row } from '../shared/contract.ts'

interface TabBarProps {
  activeTab: TabId
  rowsByTab: Record<TabId, readonly Row[]>
  onSelect: (tab: TabId) => void
}

export function TabBar({ activeTab, rowsByTab, onSelect }: TabBarProps) {
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>())

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TAB_IDS.indexOf(activeTab)
    const last = TAB_IDS.length - 1
    const nextIndex = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key]
    const next = nextIndex === undefined ? undefined : TAB_IDS[nextIndex]
    if (next === undefined) return
    event.preventDefault()
    onSelect(next)
    tabRefs.current.get(next)?.focus()
  }

  return (
    <div className="tabs" role="tablist" aria-label="Encounter type">
      {TAB_IDS.map((tab) => {
        const isActive = tab === activeTab
        return (
          <button
            key={tab}
            ref={(element) => {
              if (element) tabRefs.current.set(tab, element)
              else tabRefs.current.delete(tab)
            }}
            type="button"
            role="tab"
            id={tabElementId(tab)}
            className="tab"
            aria-selected={isActive}
            aria-controls={TAB_PANEL_ID}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(tab)}
            onKeyDown={handleKeyDown}
          >
            <TabLabel tab={tab} />
            <span className="tab__count">{formatCount(rowsByTab[tab].length)}</span>
          </button>
        )
      })}
    </div>
  )
}

function TabLabel({ tab }: { tab: TabId }) {
  const { label, compactLabel } = TAB_DETAILS[tab]
  if (compactLabel === undefined || !label.startsWith(compactLabel)) return <span>{label}</span>
  return (
    <span>
      {compactLabel}{' '}
      <span className="tab__label-rest">{label.slice(compactLabel.length).trimStart()}</span>
    </span>
  )
}
