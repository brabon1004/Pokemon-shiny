import { useState } from 'react'
import { formatDex } from '../lib/format.ts'

const SPRITE_ROOT = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const SPRITE_SIZE = 80

function spriteUrls(dex: number): string[] {
  return [
    `${SPRITE_ROOT}/versions/generation-v/black-white/shiny/${dex}.png`,
    `${SPRITE_ROOT}/shiny/${dex}.png`,
  ]
}

/** Shiny sprite that tries the Black/White art, then the generic art, then a placeholder tile. */
export function Sprite({ dex, name }: { dex: number; name: string }) {
  const [failedCount, setFailedCount] = useState(0)
  const src = spriteUrls(dex)[failedCount]

  if (src === undefined) {
    return (
      <div className="sprite sprite--placeholder" role="img" aria-label={`Shiny ${name} sprite unavailable`}>
        {formatDex(dex)}
      </div>
    )
  }
  return (
    <img
      className="sprite"
      src={src}
      alt={`Shiny ${name} sprite`}
      width={SPRITE_SIZE}
      height={SPRITE_SIZE}
      loading="lazy"
      decoding="async"
      onError={() => setFailedCount((count) => count + 1)}
    />
  )
}
