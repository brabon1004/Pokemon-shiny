import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import sampleJson from '../fixtures/combined.sample.json'
import { combinedSchema, type Combined, type Row } from '../shared/contract.ts'
import { ShinyOddsPage } from './ShinyOddsPage.tsx'

const sample = combinedSchema.parse(sampleJson)
// Viewer-local noon: Litwick (local window) and Galarian Ponyta (UTC window) are live, Sprigatito is not.
const now = new Date('2026-11-18T12:00:00')

afterEach(cleanup)

function renderPage(data: Combined = sample) {
  return render(<ShinyOddsPage data={data} now={now} isSample={false} />)
}

function cardNames(): string[] {
  return within(screen.getByRole('tabpanel'))
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '')
}

describe('tabs', () => {
  it('labels each tab with its row count, counting only live wild spawns', () => {
    renderPage()
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(tabs).toEqual(['Wild2', 'Raids5', 'Eggs3', 'Research3', 'All Pokémon12'])
  })

  it('starts on Wild showing only live spawns, best odds first', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: /Wild/ }).getAttribute('aria-selected')).toBe('true')
    expect(cardNames()).toEqual(['Litwick', 'Galarian Ponyta'])
  })

  it('starts on the first tab in tab order that has rows when Wild is empty', () => {
    renderPage({ ...sample, wild: [], raids: [] })
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Eggs3')
  })

  it('starts on Wild when every tab is empty', () => {
    renderPage({ ...sample, wild: [], raids: [], eggs: [], research: [], all: [] })
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Wild0')
  })

  it('keeps the selected tab when later data leaves it empty', () => {
    const { rerender } = renderPage()
    rerender(<ShinyOddsPage data={{ ...sample, wild: [] }} now={now} isSample={false} />)
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Wild0')
  })

  it('switches the panel when a tab is clicked', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /Raids/ }))
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(
      screen.getByRole('tab', { name: /Raids/ }).id,
    )
    expect(cardNames()).toEqual(['Kyogre', 'Shadow Raikou', 'Mega Gengar', 'Alolan Marowak', 'Wiglett'])
  })

  it('moves selection and focus with arrow keys, Home, and End, wrapping at the ends', () => {
    renderPage()
    const wild = screen.getByRole('tab', { name: /Wild/ })
    fireEvent.keyDown(wild, { key: 'ArrowRight' })
    const raids = screen.getByRole('tab', { name: /Raids/ })
    expect(document.activeElement).toBe(raids)
    expect(raids.getAttribute('aria-selected')).toBe('true')
    expect(raids.tabIndex).toBe(0)
    expect(wild.tabIndex).toBe(-1)

    fireEvent.keyDown(raids, { key: 'End' })
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /All Pokémon/ }))
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(wild)
    fireEvent.keyDown(wild, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /All Pokémon/ }))
    fireEvent.keyDown(document.activeElement as Element, { key: 'Home' })
    expect(document.activeElement).toBe(wild)
  })
})

describe('cards', () => {
  it('shows odds, per-encounter percent, and the 50% point for a shiny row', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /Raids/ }))
    const kyogre = screen.getByRole('heading', { name: 'Kyogre' }).closest('article')
    expect(kyogre).not.toBeNull()
    const card = within(kyogre as HTMLElement)
    expect(card.getByText('1 in 20')).toBeTruthy()
    expect(card.getByText('5.0%')).toBeTruthy()
    expect(card.getByText('50% at 14 encounters')).toBeTruthy()
    expect(card.getByText('Legendary')).toBeTruthy()
  })

  it('says "Shiny not available" and offers no Calculate button for a non-shiny row', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /Raids/ }))
    const wiglett = within(screen.getByRole('heading', { name: 'Wiglett' }).closest('article') as HTMLElement)
    expect(wiglett.getByText('Shiny not available')).toBeTruthy()
    expect(wiglett.queryByRole('button')).toBeNull()
  })

  it('loads a card’s odds into the calculator', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /Raids/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Use Kyogre odds in the calculator' }))
    expect((screen.getByLabelText('Odds, 1 in') as HTMLInputElement).value).toBe('20')
    expect(screen.getByText('Calculator set to Kyogre odds, 1 in 20.')).toBeTruthy()
  })
})

describe('search', () => {
  it('filters the active tab by name, ignoring case and accents', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /Raids/ }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Pokémon' }), { target: { value: 'RAÍKOU' } })
    expect(cardNames()).toEqual(['Shadow Raikou'])
  })

  it('shows the no-match message when nothing matches', () => {
    renderPage()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Pokémon' }), { target: { value: 'mewtwo' } })
    expect(cardNames()).toEqual([])
    expect(screen.getByText('No Pokémon match that search.')).toBeTruthy()
  })

  it('shows the wild empty state when no boosted spawn is live', () => {
    render(<ShinyOddsPage data={sample} now={new Date('2027-06-01T12:00:00')} isSample={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Wild/ }))
    expect(screen.getByText('No boosted wild spawns right now.')).toBeTruthy()
  })
})

describe('All Pokémon tab', () => {
  function manyRows(count: number): Row[] {
    return Array.from({ length: count }, (_, i) => ({
      key: `all:${i + 1}`,
      dex: i + 1,
      name: `Mon ${i + 1}`,
      source: 'Wild',
      shiny: true,
      denom: 512,
      tier: 'base' as const,
    }))
  }

  it('renders 60 at a time with Show more, and the tab count shows the total', () => {
    renderPage({ ...sample, all: manyRows(130) })
    const allTab = screen.getByRole('tab', { name: /All Pokémon/ })
    expect(allTab.textContent).toBe('All Pokémon130')
    fireEvent.click(allTab)
    expect(cardNames()).toHaveLength(60)
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(cardNames()).toHaveLength(120)
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(cardNames()).toHaveLength(130)
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })
})

describe('calculator', () => {
  it('computes 78.5% for 1 in 20 over 30 encounters, with milestones', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Odds, 1 in'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Encounters'), { target: { value: '30' } })
    const calculator = within(screen.getByRole('region', { name: 'Odds calculator' }))
    // Shown in the collapsed mobile summary and in the full result.
    expect(calculator.getAllByText('78.5%')).toHaveLength(2)
    expect(calculator.getByText('14 encounters')).toBeTruthy()
    expect(calculator.getByText('45 encounters')).toBeTruthy()
    expect(calculator.getByText('90 encounters')).toBeTruthy()
  })

  it('shows an inline message for invalid input instead of a result', () => {
    renderPage()
    const denomInput = screen.getByLabelText('Odds, 1 in')
    fireEvent.change(denomInput, { target: { value: '0' } })
    expect(screen.getByText('Enter odds of 1 or more, like 64.')).toBeTruthy()
    expect(denomInput.getAttribute('aria-invalid')).toBe('true')
  })

  it('toggles the compact view with an aria-expanded button', () => {
    renderPage()
    const toggle = screen.getByRole('button', { name: 'Open calculator' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Close calculator' }).getAttribute('aria-expanded')).toBe('true')
  })
})

describe('rate tiers legend', () => {
  it('lists tiers from rarest to most common with "About 1 in N"', () => {
    renderPage()
    const legend = within(screen.getByRole('region', { name: 'Rate tiers' }))
    const lines = legend.getAllByRole('listitem').map((item) => item.textContent)
    expect(lines).toEqual([
      'BaseAbout 1 in 512',
      'Event boostedAbout 1 in 128',
      'BoostedAbout 1 in 64',
      'Community DayAbout 1 in 25',
      'LegendaryAbout 1 in 20',
      'Raid DayAbout 1 in 10',
    ])
  })
})
