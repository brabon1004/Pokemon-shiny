import { formatOdds } from '../lib/format.ts'
import { TIERS, type Combined } from '../shared/contract.ts'

interface TierLegendProps {
  tiers: Combined['tiers']
  /** Phones fold the legend into a closed disclosure below the list. */
  isCollapsible: boolean
}

export function TierLegend({ tiers, isCollapsible }: TierLegendProps) {
  const rarestFirst = TIERS.toSorted((a, b) => tiers[b].denom - tiers[a].denom)
  const content = (
    <>
      <ul className="legend__list">
        {rarestFirst.map((tier) => (
          <li key={tier} className="legend__row">
            <span className={`chip chip--${tier}`}>{tiers[tier].label}</span>
            <span className="legend__odds">About {formatOdds(tiers[tier].denom)}</span>
          </li>
        ))}
      </ul>
      <p className="legend__note">Niantic does not publish shiny rates. Every number here is a community estimate.</p>
    </>
  )

  if (isCollapsible) {
    return (
      <details className="panel legend legend--collapsible">
        <summary className="legend__summary">About these odds</summary>
        {content}
      </details>
    )
  }
  return (
    <section className="panel legend" aria-labelledby="tiers-heading">
      <h2 id="tiers-heading" className="panel__title">
        Rate tiers
      </h2>
      {content}
    </section>
  )
}
