import { formatUpdatedAgo } from '../lib/relative-time.ts'

interface SiteHeaderProps {
  generatedAt: string
  now: Date
  query: string
  onQueryChange: (query: string) => void
}

function SparkleMark() {
  return (
    <svg className="brand__mark" aria-hidden="true" width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path d="M20 3 L23.5 16.5 L37 20 L23.5 23.5 L20 37 L16.5 23.5 L3 20 L16.5 16.5 Z" fill="currentColor" />
      <path d="M32 4 L33.2 8.8 L38 10 L33.2 11.2 L32 16 L30.8 11.2 L26 10 L30.8 8.8 Z" fill="currentColor" />
    </svg>
  )
}

export function SiteHeader({ generatedAt, now, query, onQueryChange }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="brand">
        <SparkleMark />
        <div className="brand__text">
          <h1 className="brand__title">Shiny Odds</h1>
          <p className="brand__tagline">Shiny chances for everything live in Pokémon GO right now</p>
        </div>
      </div>
      <div className="site-header__tools">
        <time className="muted site-header__updated" dateTime={generatedAt} title={new Date(generatedAt).toLocaleString()}>
          {formatUpdatedAgo(generatedAt, now)}
        </time>
        <div role="search" className="search">
          <label htmlFor="pokemon-search" className="visually-hidden">
            Search Pokémon
          </label>
          <input
            id="pokemon-search"
            className="input search__input"
            type="search"
            placeholder="Search Pokémon"
            autoComplete="off"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      </div>
    </header>
  )
}
