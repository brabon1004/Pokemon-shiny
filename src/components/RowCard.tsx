import { formatEncounters, formatOdds, formatPerEncounterPercent } from '../lib/format.ts'
import type { Combined, Row } from '../shared/contract.ts'
import { encountersForChance } from '../shared/odds.ts'
import { Sprite } from './Sprite.tsx'

interface RowCardProps {
  row: Row
  tiers: Combined['tiers']
  onCalculate: (row: Row) => void
}

export function RowCard({ row, tiers, onCalculate }: RowCardProps) {
  return (
    <article className="card">
      <div className="card__sprite">
        <Sprite dex={row.dex} name={row.name} />
      </div>
      <div className="card__info">
        <h3 className="card__name">{row.name}</h3>
        <span className="card__source">{row.source}</span>
        {row.tier !== null && <span className={`chip chip--${row.tier}`}>{tiers[row.tier].label}</span>}
      </div>
      {row.denom !== null ? (
        <>
          <div className="card__odds">
            <span className="card__denom">{formatOdds(row.denom)}</span>
            <span className="card__percent">{formatPerEncounterPercent(row.denom)}</span>
          </div>
          <div className="card__foot">
            <span className="card__half">50% at {formatEncounters(encountersForChance(row.denom, 0.5))}</span>
            <button
              type="button"
              className="button button--ghost"
              aria-label={`Use ${row.name} odds in the calculator`}
              onClick={() => onCalculate(row)}
            >
              Calculate
            </button>
          </div>
        </>
      ) : (
        <div className="card__odds">
          <span className="card__unavailable">Shiny not available</span>
        </div>
      )}
    </article>
  )
}
