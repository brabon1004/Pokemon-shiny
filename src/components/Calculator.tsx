import { useId, useState } from 'react'
import { calculateShinyChance, parseDenomInput, parseEncountersInput } from '../lib/calculator.ts'
import { formatChance, formatEncounters, formatOdds } from '../lib/format.ts'

interface CalculatorProps {
  denomInput: string
  encountersInput: string
  onDenomInputChange: (value: string) => void
  onEncountersInputChange: (value: string) => void
}

export function Calculator({ denomInput, encountersInput, onDenomInputChange, onEncountersInputChange }: CalculatorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const id = useId()
  const ids = {
    heading: `${id}-heading`,
    body: `${id}-body`,
    denom: `${id}-denom`,
    denomError: `${id}-denom-error`,
    encounters: `${id}-encounters`,
    encountersError: `${id}-encounters-error`,
  }

  const denom = parseDenomInput(denomInput)
  const encounters = parseEncountersInput(encountersInput)
  const result = denom.ok && encounters.ok ? calculateShinyChance(denom.value, encounters.value) : null
  const chanceText = result ? formatChance(result.chance) : '–'
  const summary =
    denom.ok && encounters.ok
      ? `${formatOdds(denom.value)} over ${formatEncounters(encounters.value)}`
      : 'Check the calculator inputs.'

  return (
    <section className="panel calculator" aria-labelledby={ids.heading} data-expanded={isExpanded}>
      <div className="calculator__summary">
        <div className="calculator__summary-text">
          <h2 id={ids.heading} className="panel__title">
            Odds calculator
          </h2>
          <span className="calculator__summary-line">{summary}</span>
        </div>
        <span className="calculator__summary-chance" aria-hidden="true">
          {chanceText}
        </span>
      </div>
      <button
        type="button"
        className="button button--ghost calculator__toggle"
        aria-expanded={isExpanded}
        aria-controls={ids.body}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        {isExpanded ? 'Close calculator' : 'Open calculator'}
      </button>

      <div id={ids.body} className="calculator__body">
        <div className="calculator__inputs">
          <div className="field">
            <label htmlFor={ids.denom}>Odds, 1 in</label>
            <input
              id={ids.denom}
              className="input"
              type="number"
              inputMode="decimal"
              min={1}
              step="any"
              value={denomInput}
              aria-invalid={!denom.ok}
              aria-describedby={denom.ok ? undefined : ids.denomError}
              onChange={(event) => onDenomInputChange(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={ids.encounters}>Encounters</label>
            <input
              id={ids.encounters}
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={encountersInput}
              aria-invalid={!encounters.ok}
              aria-describedby={encounters.ok ? undefined : ids.encountersError}
              onChange={(event) => onEncountersInputChange(event.target.value)}
            />
          </div>
        </div>
        <div className="calculator__errors" aria-live="polite">
          {!denom.ok && (
            <p id={ids.denomError} className="field-error">
              {denom.message}
            </p>
          )}
          {!encounters.ok && (
            <p id={ids.encountersError} className="field-error">
              {encounters.message}
            </p>
          )}
        </div>
        <div className="calculator__result">
          <span className="muted">Chance of at least one shiny</span>
          <span className="calculator__chance">{chanceText}</span>
        </div>
        {result && (
          <dl className="milestones">
            {result.milestones.map((milestone) => (
              <div key={milestone.target} className="milestones__row">
                <dt>{Math.round(milestone.target * 100)}% chance by</dt>
                <dd>{formatEncounters(milestone.encounters)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  )
}
