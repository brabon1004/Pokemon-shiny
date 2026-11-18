// LeekDuck image filenames are the only place ScrapedDuck exposes a National Dex number.
const FILENAME_PATTERNS = [/^pm(\d+)\./, /^pokemon_icon_(\d+)_/, /^poke_capture_(\d+)_/]

export function parseDex(imageUrl: string): number | null {
  const filename = imageUrl.split('/').at(-1) ?? ''
  for (const pattern of FILENAME_PATTERNS) {
    const digits = pattern.exec(filename)?.[1]
    if (digits === undefined) continue
    const dex = Number(digits)
    return dex > 0 ? dex : null
  }
  return null
}
