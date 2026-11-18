import { describe, expect, it } from 'vitest'
import { formKeyFromImage, releasedShinyKeys, unflaggedShinyWarning } from './shiny-keys.ts'

const ICONS = 'https://cdn.leekduck.com/assets/img/pokemon_icons'

describe('formKeyFromImage', () => {
  it('reads the base form key from a pm{dex}.icon.png filename', () => {
    expect(formKeyFromImage(`${ICONS}_crop/pm1.icon.png`)).toBe('pm1')
  })

  it('keeps the form token and drops the shiny-sprite ".s" marker', () => {
    expect(formKeyFromImage(`${ICONS}/pm52.fALOLA.icon.png`)).toBe('pm52.fALOLA')
    expect(formKeyFromImage(`${ICONS}/pm88.fALOLA.s.icon.png`)).toBe('pm88.fALOLA')
  })

  it('maps the base form of the older numeric schemes to pm{dex}', () => {
    expect(formKeyFromImage(`${ICONS}/pokemon_icon_001_00.png`)).toBe('pm1')
    expect(formKeyFromImage(`${ICONS}/pokemon_icon_624_00_shiny.png`)).toBe('pm624')
    expect(formKeyFromImage(`${ICONS}_crop/poke_capture_0824_000_mf_n_00000000_f_n.png`)).toBe('pm824')
  })

  it('returns null for numeric-scheme forms it cannot name, and for unknown filenames', () => {
    expect(formKeyFromImage(`${ICONS}/pokemon_icon_641_11.png`)).toBeNull()
    expect(formKeyFromImage(`${ICONS}_crop/poke_capture_0479_005_mf_n_00000000_f_n.png`)).toBeNull()
    expect(formKeyFromImage('https://cdn.leekduck.com/assets/img/items/stardust.png')).toBeNull()
    expect(formKeyFromImage('')).toBeNull()
  })
})

describe('releasedShinyKeys', () => {
  it('collects aa_fn keys released on or before the build date (UTC), leaving out later releases', () => {
    const entries = [
      { dex: 1, aa_fn: 'pm1', released_date: '2018/03/25' },
      { dex: 52, aa_fn: 'pm52.fALOLA', released_date: '2026/11/18' },
      { dex: 52, aa_fn: 'pm52.fGALARIAN', released_date: '2026/11/19' },
    ]
    expect(releasedShinyKeys(entries, new Date('2026-11-18T23:30:00Z'))).toEqual(new Set(['pm1', 'pm52.fALOLA']))
  })
})

describe('unflaggedShinyWarning', () => {
  const flags = (count: number, value = false) => Array.from({ length: count }, () => value)

  it('warns when a source with at least 10 Pokémon flags none of them shiny', () => {
    expect(unflaggedShinyWarning('ScrapedDuck research', 'rewards', flags(198))).toBe(
      'ScrapedDuck research: 0 of 198 rewards flagged shiny upstream; using the LeekDuck shiny list instead',
    )
  })

  it('stays quiet when any entry is flagged shiny or the source is too small to judge', () => {
    expect(unflaggedShinyWarning('ScrapedDuck research', 'rewards', [...flags(20), true])).toBeNull()
    expect(unflaggedShinyWarning('ScrapedDuck research', 'rewards', flags(9))).toBeNull()
  })
})
