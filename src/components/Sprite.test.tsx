import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Sprite } from './Sprite.tsx'

afterEach(cleanup)

const BW = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/shiny/25.png'
const FALLBACK = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/25.png'

describe('Sprite', () => {
  it('starts with the Black/White shiny sprite, lazy-loaded with fixed dimensions', () => {
    render(<Sprite dex={25} name="Pikachu" />)
    const image = screen.getByRole('img', { name: 'Shiny Pikachu sprite' }) as HTMLImageElement
    expect(image.src).toBe(BW)
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(image.getAttribute('width')).toBe('80')
    expect(image.getAttribute('height')).toBe('80')
  })

  it('falls back to the generic shiny sprite, then to a placeholder tile with the dex number', () => {
    render(<Sprite dex={25} name="Pikachu" />)
    fireEvent.error(screen.getByRole('img', { name: 'Shiny Pikachu sprite' }))
    const fallback = screen.getByRole('img', { name: 'Shiny Pikachu sprite' }) as HTMLImageElement
    expect(fallback.src).toBe(FALLBACK)

    fireEvent.error(fallback)
    const placeholder = screen.getByRole('img', { name: 'Shiny Pikachu sprite unavailable' })
    expect(placeholder.tagName).toBe('DIV')
    expect(placeholder.textContent).toBe('#025')
  })
})
