import { useId } from 'react'
import { calculateShinyChance, parseDenomInput, parseEncountersInput } from '../lib/calculator.ts'
import { formatChance, formatEncounters } from '../lib/format.ts'

interface CalculatorProps {
  headingId: string
  /** A line under the heading, e.g. the Pokémon whose odds were just loaded. */
  subtitle?: { id: string; text: string } | undefined
  denomInput: string
  encountersInput: string
  onDenomInputChange: (value: string) => void
  onEncountersInputChange: (value: string) => void
}

export function Calculator({ headingId, subtitle, denomInput, encountersInput, onDenomInputChange, onEncountersInputChange }: CalculatorProps) {
  const id = useId()
  const ids = {
    denom: `${id}-denom`,
    denomError: `${id}-denom-error`,
    encounters: `${id}-encounters`,
    encountersError: `${id}-encounters-error`,
  }

  const denom = parseDenomInput(denomInput)
  const encounters = parseEncountersInput(encountersInput)
  const result = denom.ok && encounters.ok ? calculateShinyChance(denom.value, encounters.value) : null
  const chanceText = result ? formatChance(result.chance) : '–'

  return (
    <section className="panel calculator" aria-labelledby={headingId}>
      <div className="calculator__header">
        <h2 id={headingId} className="panel__title">
          Odds calculator
        </h2>
        {subtitle !== undefined && (
          <p id={subtitle.id} className="calculator__subtitle">
            {subtitle.text}
          </p>
        )}
      </div>
      <div className="calculator__body">
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
