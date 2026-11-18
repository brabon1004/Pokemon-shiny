import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import sampleJson from '../fixtures/combined.sample.json'
import preDynamaxJson from '../fixtures/combined.v1-pre-dynamax.json'
import { combinedSchema, type Combined, type Row } from '../shared/contract.ts'
import { emulateCompactViewport } from '../test/setup.ts'
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
    .queryAllByRole('article')
    .map((card) => within(card).getByRole('heading').textContent ?? '')
}

describe('tabs', () => {
  it('labels each tab with its row count, counting only live wild spawns', () => {
    renderPage()
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(tabs).toEqual(['Wild2', 'Raids5', 'Dynamax3', 'Eggs3', 'Research3', 'All Pokémon12'])
  })

  it('starts on Wild showing only live spawns, best odds first', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: /Wild/ }).getAttribute('aria-selected')).toBe('true')
    expect(cardNames()).toEqual(['Litwick', 'Galarian Ponyta'])
  })

  it('groups wild spawns under one heading per event that says when it ends', () => {
    renderPage()
    const eventHeadings = within(screen.getByRole('tabpanel')).getAllByRole('heading', { level: 3 })
    expect(eventHeadings.map((heading) => heading.textContent)).toEqual(['Event: Festival of Lights', 'Event: Galarian Expedition'])
    const festival = eventHeadings[0]?.closest('section') as HTMLElement
    expect(festival.textContent).toContain('Until Fri, Nov 20, 8 PM')
    const litwick = within(festival).getByRole('heading', { level: 4, name: 'Litwick' }).closest('article')
    expect(litwick?.textContent).not.toContain('Festival of Lights')
    expect(litwick?.textContent).not.toContain('Until')
  })

  it('hides wild event groups with no rows matching the search', () => {
    renderPage()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ponyta' } })
    const eventHeadings = within(screen.getByRole('tabpanel')).getAllByRole('heading', { level: 3 })
    expect(eventHeadings.map((heading) => heading.textContent)).toEqual(['Event: Galarian Expedition'])
  })

  it('starts on the first tab in tab order that has rows when Wild is empty', () => {
    renderPage({ ...sample, wild: [], raids: [], dynamax: [] })
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Eggs3')
  })

  it('starts on Wild when every tab is empty', () => {
    renderPage({ ...sample, wild: [], raids: [], dynamax: [], eggs: [], research: [], all: [] })
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

describe('Dynamax tab', () => {
  it('lists Max Battle bosses live now under a note that their rates are unverified', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /Dynamax/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Max Battles' })).toBeTruthy()
    expect(screen.getByText('Shiny rates for Max Battles are unverified estimates.')).toBeTruthy()
    // Dynamax Espurr's Max Monday has not started yet.
    expect(cardNames()).toEqual(['Dynamax Bulbasaur', 'Dynamax Squirtle', 'Gigantamax Pikachu'])
    const bulbasaur = screen.getByRole('heading', { name: 'Dynamax Bulbasaur' }).closest('article') as HTMLElement
    expect(within(bulbasaur).getByText('1★ Max Battle')).toBeTruthy()
  })

  it('leaves off a tier chip that would repeat the name, but keeps one that differs', () => {
    const boosted: Row = { ...(sample.dynamax[0] as Row), key: 'dynamax:x:Dynamax Eevee', name: 'Dynamax Eevee', tier: 'event', denom: 128 }
    renderPage({ ...sample, dynamax: [sample.dynamax[0] as Row, boosted] })
    fireEvent.click(screen.getByRole('tab', { name: /Dynamax/ }))
    const bulbasaur = screen.getByRole('heading', { name: 'Dynamax Bulbasaur' }).closest('article') as HTMLElement
    expect(within(bulbasaur).queryByText('Dynamax')).toBeNull()
    const eevee = screen.getByRole('heading', { name: 'Dynamax Eevee' }).closest('article') as HTMLElement
    expect(within(eevee).getByText('Event boosted')).toBeTruthy()
  })

  it('says so when no Max Battle boss is listed', () => {
    renderPage({ ...sample, dynamax: [] })
    fireEvent.click(screen.getByRole('tab', { name: /Dynamax/ }))
    expect(screen.getByText('No Max Battle bosses listed right now.')).toBeTruthy()
  })

  it('renders a combined.json from before the Dynamax tab with an empty Dynamax tab', () => {
    renderPage(combinedSchema.parse(preDynamaxJson))
    expect(screen.getByRole('tab', { name: /Dynamax/ }).textContent).toBe('Dynamax0')
    fireEvent.click(screen.getByRole('tab', { name: /Dynamax/ }))
    expect(screen.getByText('No Max Battle bosses listed right now.')).toBeTruthy()
  })

  it('shows no unverified note on other tabs', () => {
    renderPage()
    expect(screen.queryByText('Shiny rates for Max Battles are unverified estimates.')).toBeNull()
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

  it('shows a tier chip only when the tier is not base', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /Research/ }))
    const dratini = screen.getByRole('heading', { name: 'Dratini' }).closest('article') as HTMLElement
    expect(within(dratini).queryByText('Base')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Raids/ }))
    const kyogre = screen.getByRole('heading', { name: 'Kyogre' }).closest('article') as HTMLElement
    expect(within(kyogre).getByText('Legendary')).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: 'Calculate odds for Kyogre' }))
    expect((screen.getByLabelText('Odds, 1 in') as HTMLInputElement).value).toBe('20')
    expect(screen.getByText('Calculator set to Kyogre odds, 1 in 20.')).toBeTruthy()
  })

  it('keeps the sidebar calculator on wide screens, with no sheet or header button', () => {
    renderPage()
    expect(screen.getByRole('region', { name: 'Odds calculator' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Calculator' })).toBeNull()
    expect(document.querySelector('dialog')).toBeNull()
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

  it('shows the wild heading and empty state when no event spawn is live', () => {
    render(<ShinyOddsPage data={sample} now={new Date('2027-06-01T12:00:00')} isSample={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Wild/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Event wild spawns' })).toBeTruthy()
    expect(screen.getByText('No event spawns right now.')).toBeTruthy()
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
    expect(calculator.getByText('78.5%')).toBeTruthy()
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
      'DynamaxAbout 1 in 64* (unverified)',
      'GigantamaxAbout 1 in 64* (unverified)',
      'Community DayAbout 1 in 25',
      'LegendaryAbout 1 in 20',
      'Raid DayAbout 1 in 10',
    ])
  })

  it('leaves out the unverified footnote when every tier is researched', () => {
    const tiers = Object.fromEntries(Object.entries(sample.tiers).map(([tier, info]) => [tier, { label: info.label, denom: info.denom }]))
    renderPage(combinedSchema.parse({ ...sample, tiers }))
    const legend = screen.getByRole('region', { name: 'Rate tiers' })
    expect(legend.textContent).not.toContain('Unverified estimate')
    expect(legend.textContent).not.toContain('*')
  })
})

describe('phone layout', () => {
  it('opens the calculator sheet prefilled with a tapped row’s odds', () => {
    emulateCompactViewport()
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /Raids/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Calculate odds for Kyogre' }))
    const sheet = screen.getByRole('dialog', { name: 'Odds calculator' })
    expect((within(sheet).getByLabelText('Odds, 1 in') as HTMLInputElement).value).toBe('20')
  })

  it('names the tapped Pokémon in the sheet, as its description, and drops it when opened from the header', () => {
    emulateCompactViewport()
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /Raids/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Calculate odds for Kyogre' }))
    const sheet = screen.getByRole('dialog', { name: 'Odds calculator', description: 'Kyogre · 1 in 20' })
    expect(within(sheet).getByText('Kyogre · 1 in 20')).toBeTruthy()

    fireEvent.click(within(sheet).getByRole('button', { name: 'Close calculator' }))
    fireEvent.click(screen.getByRole('button', { name: 'Calculator' }))
    expect(within(screen.getByRole('dialog')).queryByText(/Kyogre/)).toBeNull()
  })

  it('opens the sheet from the header and keeps the encounters entered there', () => {
    emulateCompactViewport()
    renderPage()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Calculator' }))
    const sheet = screen.getByRole('dialog', { name: 'Odds calculator' })
    fireEvent.change(within(sheet).getByLabelText('Encounters'), { target: { value: '30' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close calculator' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: /Raids/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Calculate odds for Kyogre' }))
    const reopened = within(screen.getByRole('dialog', { name: 'Odds calculator' }))
    expect((reopened.getByLabelText('Encounters') as HTMLInputElement).value).toBe('30')
    expect(reopened.getByText('78.5%')).toBeTruthy()
  })

  it('folds the rate tiers into a closed "About these odds" disclosure that keeps the estimate note', () => {
    emulateCompactViewport()
    renderPage()
    const summary = screen.getByText('About these odds')
    const disclosure = summary.closest('details')
    expect(summary.tagName).toBe('SUMMARY')
    expect(disclosure?.open).toBe(false)
    expect(disclosure?.textContent).toContain('Niantic does not publish shiny rates. Most are community estimates from past research.')
    expect(disclosure?.textContent).toContain('* Unverified estimate: no research has measured it.')
    expect(disclosure?.querySelectorAll('li')).toHaveLength(8)
  })

  it('keeps the tab bar keyboard-navigable', () => {
    emulateCompactViewport()
    renderPage()
    const all = screen.getByRole('tab', { name: /All Pokémon/ })
    fireEvent.keyDown(screen.getByRole('tab', { name: /Wild/ }), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(all)
    expect(all.getAttribute('aria-selected')).toBe('true')
  })
})
