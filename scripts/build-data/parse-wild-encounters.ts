// Reads the "Wild Encounters" list from a LeekDuck event page (leekduck.com/events/<slug>/). ScrapedDuck only says
// such a list exists (`extraData.generic.hasSpawns`), not what is in it. Markup verified 2026-11-18:
//   <h2 id="wild-encounters">Wild Encounters</h2> ... <ul class="pkmn-list-flex">
//     <li class="pkmn-list-item"><div class="pkmn-list-img"><img src=".../pokemon_icon_001_00.png" /></div>
//       <img class="shiny-icon" ... alt="shiny" /><div class="pkmn-name">Bulbasaur</div></li>
// The shiny icon is only present when the shiny is available.
import { decodeHtmlEntities, htmlToPlainText } from './html-text.ts'

export interface WildEncounter {
  name: string
  image: string
  canBeShiny: boolean
}

const SECTION_HEADING = /<h2\b[^<>]*\bid="wild-encounters"[^<>]*>/i
const NEXT_HEADING = '<h2'
const LIST_ITEM_START = /<li\b[^<>]*\bclass="[^"<>]*\bpkmn-list-item\b[^"<>]*"[^<>]*>/gi
const IMG_TAG = /<img\b[^<>]*>/gi
const SRC_ATTRIBUTE = /\bsrc="([^"<>]*)"/i
const SHINY_ICON_CLASS = /\bclass="[^"<>]*\bshiny-icon\b/i
const NAME_DIV = /<div\b[^<>]*\bclass="[^"<>]*\bpkmn-name\b[^"<>]*"[^<>]*>([\s\S]{0,500}?)<\/div>/i

/** Encounters listed under the page's Wild Encounters heading, in page order; [] when the page has no such section. */
export function parseWildEncounters(html: string): WildEncounter[] {
  const heading = SECTION_HEADING.exec(html)
  if (heading === null) return []
  const sectionStart = heading.index + heading[0].length
  const nextHeading = html.indexOf(NEXT_HEADING, sectionStart)
  const section = html.slice(sectionStart, nextHeading === -1 ? html.length : nextHeading)

  const itemStarts = [...section.matchAll(LIST_ITEM_START)].map((match) => match.index)
  return itemStarts.flatMap((start, index) => {
    const encounter = parseListItem(section.slice(start, itemStarts[index + 1] ?? section.length))
    return encounter === null ? [] : [encounter]
  })
}

function parseListItem(itemHtml: string): WildEncounter | null {
  const imgTags = itemHtml.match(IMG_TAG) ?? []
  const spriteTag = imgTags.find((tag) => !SHINY_ICON_CLASS.test(tag))
  const image = spriteTag === undefined ? undefined : SRC_ATTRIBUTE.exec(spriteTag)?.[1]
  const nameHtml = NAME_DIV.exec(itemHtml)?.[1]
  const name = nameHtml === undefined ? '' : htmlToPlainText(nameHtml)
  if (image === undefined || image === '' || name === '') return null
  return { name, image: decodeHtmlEntities(image), canBeShiny: imgTags.some((tag) => SHINY_ICON_CLASS.test(tag)) }
}
