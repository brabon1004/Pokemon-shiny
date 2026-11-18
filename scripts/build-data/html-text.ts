const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const TAG_PATTERN = /<[^<>]*>/g

/**
 * Plain text from an HTML fragment. Tags become spaces (so `</span><span>` cannot glue two words together), a few
 * common entities are decoded, then tags are removed again so an encoded `&lt;img&gt;` cannot turn into markup.
 * Whitespace is collapsed last.
 */
export function htmlToPlainText(html: string): string {
  const decoded = decodeHtmlEntities(html.replace(TAG_PATTERN, ' '))
  return decoded.replace(TAG_PATTERN, ' ').replace(/\s+/g, ' ').trim()
}

/** Decodes `&amp;`-style named entities from a short list plus numeric ones; unknown entities are left as written. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => decodeEntity(body) ?? entity)
}

function decodeEntity(body: string): string | undefined {
  if (body[0] !== '#') return NAMED_ENTITIES[body.toLowerCase()]
  const codePoint = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1))
  return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : undefined
}
