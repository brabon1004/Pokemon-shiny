import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseWildEncounters } from './parse-wild-encounters.ts'

/** The Wild Encounters section of leekduck.com/events/dynamax-trails-2026/ as served on 2026-11-18, trimmed to six. */
const DYNAMAX_TRAILS_HTML = readFileSync(new URL('./__fixtures__/leekduck-event-dynamax-trails.html', import.meta.url), 'utf8')
const ICONS = 'https://cdn.leekduck.com/assets/img/pokemon_icons'

describe('parseWildEncounters', () => {
  it('lists each wild encounter with its icon and whether the shiny icon is shown', () => {
    expect(parseWildEncounters(DYNAMAX_TRAILS_HTML)).toEqual([
      { name: 'Bulbasaur', image: `${ICONS}/pokemon_icon_001_00.png`, canBeShiny: true },
      { name: 'Charmander', image: `${ICONS}/pokemon_icon_004_00.png`, canBeShiny: true },
      { name: 'Squirtle', image: `${ICONS}/pokemon_icon_007_00.png`, canBeShiny: true },
      { name: 'Toxtricity (Amped Form)', image: `${ICONS}/pm849.fAMPED.icon.png`, canBeShiny: true },
      { name: 'Toxtricity (Low Key Form)', image: `${ICONS}/pm849.fLOW_KEY.icon.png`, canBeShiny: true },
      { name: 'Duraludon', image: `${ICONS}/pm884.icon.png`, canBeShiny: true },
    ])
  })

  const item = (name: string, { shiny = true, icon = 'pm1.icon.png' } = {}) =>
    `<li class="pkmn-list-item"><div class="pkmn-list-img"><img src="${ICONS}/${icon}" /></div>` +
    `${shiny ? `<img class="shiny-icon" src="https://cdn.leekduck.com/assets/img/icons/shiny-icon.png" alt="shiny" />` : ''}` +
    `<div class="pkmn-name">${name}</div></li>`
  const page = (items: string) => `<h2 id="wild-encounters">Wild Encounters</h2><ul class="pkmn-list-flex">${items}</ul>`

  it('returns no encounters when the page has no Wild Encounters section', () => {
    expect(parseWildEncounters('<h2 id="raids">Raids</h2><ul class="pkmn-list-flex">' + item('Mewtwo') + '</ul>')).toEqual([])
  })

  it('marks an encounter without the shiny icon as not shiny', () => {
    expect(parseWildEncounters(page(item('Happiny', { shiny: false, icon: 'pm440.icon.png' })))).toEqual([
      { name: 'Happiny', image: `${ICONS}/pm440.icon.png`, canBeShiny: false },
    ])
  })

  it('decodes entities and strips tags in names', () => {
    const names = parseWildEncounters(page(item('Farfetch&#8217;d') + item('Nidoran&amp;<b>&#x2640;</b>'))).map((e) => e.name)
    expect(names).toEqual(['Farfetch’d', 'Nidoran& ♀'])
  })

  it('stops at the next section heading', () => {
    const html = page(item('Bulbasaur')) + '<h2 id="max-battles">Max Battles</h2><ul class="pkmn-list-flex">' + item('Eternatus') + '</ul>'
    expect(parseWildEncounters(html).map((e) => e.name)).toEqual(['Bulbasaur'])
  })

  it('skips a list item with no name or no sprite', () => {
    const noName = `<li class="pkmn-list-item"><img src="${ICONS}/pm1.icon.png" /></li>`
    const noSprite = '<li class="pkmn-list-item"><div class="pkmn-name">Ghost</div></li>'
    expect(parseWildEncounters(page(noName + noSprite + item('Pikachu'))).map((e) => e.name)).toEqual(['Pikachu'])
  })
})

describe('parseWildEncounters on hostile markup', () => {
  // Unclosed tags made the old `[^>]*` patterns rescan to the end of the page from every `<`, which is quadratic.
  const TWO_MB = 2 * 1024 * 1024
  it.each([
    ['unclosed <h2 tags', '<h2 '.repeat(TWO_MB / 4)],
    ['unclosed <li class=" tags in the section', '<h2 id="wild-encounters">' + '<li class="'.repeat(TWO_MB / 11)],
    ['name divs that never close', '<h2 id="wild-encounters"><li class="pkmn-list-item">' + '<div class="pkmn-name">x'.repeat(TWO_MB / 25)],
    ['a name made of 2 MB of "<"',`<h2 id="wild-encounters"><li class="pkmn-list-item"><img src="x.png"><div class="pkmn-name">${'<'.repeat(TWO_MB)}</div></li>`],
  ])('reads %s in well under a second', (_label, html) => {
    const started = performance.now()
    parseWildEncounters(html)
    expect(performance.now() - started).toBeLessThan(1_000)
  })
})
