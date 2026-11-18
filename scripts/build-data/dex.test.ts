import { describe, expect, it } from 'vitest'
import { parseDex } from './dex.ts'

const ICONS = 'https://cdn.leekduck.com/assets/img/pokemon_icons'

describe('parseDex', () => {
  it('reads the dex from a pm{dex}.icon.png filename', () => {
    expect(parseDex(`${ICONS}/pm200.icon.png`)).toBe(200)
  })

  it('reads the dex from a pokemon_icon_{ddd}_{ff} filename, dropping leading zeros', () => {
    expect(parseDex(`${ICONS}/pokemon_icon_024_00_shiny.png`)).toBe(24)
  })

  it('reads the dex from a poke_capture_{dddd}_ filename (seen in live research rewards)', () => {
    expect(parseDex(`${ICONS}_crop/poke_capture_0824_000_mf_n_00000000_f_n.png`)).toBe(824)
  })

  it('returns null for dex 0 instead of a fake species', () => {
    expect(parseDex(`${ICONS}/pokemon_icon_000_00.png`)).toBeNull()
  })

  it('returns null when the filename matches no known scheme', () => {
    expect(parseDex('https://cdn.leekduck.com/assets/img/items/stardust.png')).toBeNull()
    expect(parseDex('')).toBeNull()
  })

  it('only looks at the filename, not directory names', () => {
    expect(parseDex('https://example.com/pm25.dir/unknown.png')).toBeNull()
  })
})
