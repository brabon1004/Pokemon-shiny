import { formatEventEnd } from '../lib/event-end.ts'
import { formatEncounters, formatOdds, formatPerEncounterPercent } from '../lib/format.ts'
import type { Combined, Row } from '../shared/contract.ts'
import { encountersForChance } from '../shared/odds.ts'
import { Sprite } from './Sprite.tsx'

interface RowCardProps {
  row: Row
  tiers: Combined['tiers']
  onCalculate: (row: Row) => void
  /** Inside a wild event group, whose heading already names the event and its end, under an h3. */
  isInEventGroup?: boolean
}

export function RowCard({ row, tiers, onCalculate, isInEventGroup = false }: RowCardProps) {
  const eventEnd = row.window === undefined || isInEventGroup ? null : formatEventEnd(row.window)
  const NameHeading = isInEventGroup ? 'h4' : 'h3'
  return (
    <article className="card">
      <div className="card__sprite">
        <Sprite dex={row.dex} name={row.name} />
      </div>
      <div className="card__info">
        <NameHeading className="card__name">{row.name}</NameHeading>
        {!isInEventGroup && <span className="card__source">{row.source}</span>}
        {eventEnd !== null && <span className="card__until">{eventEnd}</span>}
        {/* Most rows are base, so only a different tier earns a chip. */}
        {row.tier !== null && row.tier !== 'base' && <span className={`chip chip--${row.tier}`}>{tiers[row.tier].label}</span>}
      </div>
      {row.denom !== null ? (
        <>
          <div className="card__odds">
            <span className="card__denom">{formatOdds(row.denom)}</span>
            <span className="card__percent">{formatPerEncounterPercent(row.denom)}</span>
          </div>
          <div className="card__foot">
            <span className="card__half">50% at {formatEncounters(encountersForChance(row.denom, 0.5))}</span>
            {/* On phones this button is stretched over the whole row, so tapping anywhere on it calculates. */}
            <button
              type="button"
              className="button button--ghost card__calculate"
              aria-label={`Calculate odds for ${row.name}`}
              onClick={() => onCalculate(row)}
            >
              Calculate
            </button>
          </div>
        </>
      ) : (
        <div className="card__odds">
          <span className="card__unavailable">
            <span className="card__unavailable-full">Shiny not available</span>
            {/* Phones show the short form; the full wording stays for screen readers. */}
            <span className="card__unavailable-short" aria-hidden="true">
              No shiny
            </span>
          </span>
        </div>
      )}
    </article>
  )
}
