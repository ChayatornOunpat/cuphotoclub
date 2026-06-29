import { readdirSync, readFileSync } from 'node:fs'
import { join, parse } from 'node:path'
import type { Album, AlbumCell, AlbumRow, AlbumStyle, CellSpan, Placement } from '~~/shared/types'

const albumDir = join(process.cwd(), 'content', 'albums')

function stripQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function readScalar(lines: string[], index: number) {
  const line = lines[index]
  const [, raw = ''] = line.match(/^[^:]+:\s*(.*)$/) ?? []
  const value = raw.trim()

  if (value === '>-' || value === '|') {
    const parts: string[] = []
    for (let i = index + 1; i < lines.length; i++) {
      const next = lines[i]
      if (/^\w[^:]*:/.test(next)) break
      if (next.trim()) parts.push(next.trim())
    }
    return parts.join(' ')
  }

  return stripQuotes(value)
}

function readInlineObject(line: string): Record<string, string> {
  const object = line.match(/\{(.+)\}/)?.[1] ?? ''
  const entries = object.match(/(\w+):\s*('[^']*'|"[^"]*"|[^,}]+)/g) ?? []

  return entries.reduce<Record<string, string>>((acc, entry) => {
    const [, key, raw] = entry.match(/^(\w+):\s*(.+)$/) ?? []
    if (key && raw) acc[key] = stripQuotes(raw)
    return acc
  }, {})
}

// Convert a flat images array + coverIndex into AlbumRows using the legacy recipe.
// Each recipe step maps to one row; pair steps produce two span-3 cells per row.
function imagesToRows(images: { src: string, caption?: string }[], coverIndex: number): { rows: AlbumRow[], coverSrc: string } {
  const recipe: CellSpan[][] = [
    [4],    // was 'single'
    [6],    // was 'bleed'
    [3, 3], // was 'pair'
    [4],    // was 'single-right'
    [6],    // was 'bleed'
  ]

  const rows: AlbumRow[] = []
  let i = 0
  let r = 0

  while (i < images.length) {
    let spans = recipe[r % recipe.length]!
    if (spans.length > images.length - i) spans = [6]

    const cells: AlbumCell[] = spans.map((span, k) => ({
      type: 'image' as const,
      span,
      src: images[i + k]!.src,
      caption: images[i + k]!.caption
    }))

    rows.push({ cells })
    i += spans.length
    r++
  }

  const coverSrc = images[coverIndex]?.src ?? images[0]?.src ?? ''
  return { rows, coverSrc }
}

function parseAlbumMarkdown(filename: string, source: string): Album | null {
  const match = source.match(/^\s*---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null

  const lines = match[1].split(/\r?\n/)
  const data: Record<string, string | number | { src: string, caption?: string }[]> = {}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim() || line.trim().startsWith('#')) continue

    if (line.startsWith('images:')) {
      const images: { src: string, caption?: string }[] = []
      for (let j = i + 1; j < lines.length; j++) {
        const imageLine = lines[j].trim()
        if (!imageLine.startsWith('-')) break
        const image = readInlineObject(imageLine)
        if (image.src) images.push({ src: image.src, caption: image.caption })
        i = j
      }
      data.images = images
      continue
    }

    const key = line.match(/^([^:]+):/)?.[1]
    if (!key) continue
    const value = readScalar(lines, i)
    data[key] = key === 'coverIndex' ? Number(value) : value
  }

  if (!data.title || !data.category || !data.date || !data.published || !data.excerpt || !Array.isArray(data.images)) {
    return null
  }

  const { rows, coverSrc } = imagesToRows(data.images, Number(data.coverIndex) || 0)

  return {
    id: parse(filename).name,
    title: String(data.title),
    category: String(data.category),
    date: String(data.date),
    published: String(data.published),
    location: data.location ? String(data.location) : undefined,
    excerpt: String(data.excerpt),
    style: (data.style as AlbumStyle | undefined) ?? 'essay',
    placement: (data.placement as Placement | undefined) ?? 'gallery',
    coverSrc,
    rows
  }
}

export function readContentAlbums(): Album[] {
  const files = (() => {
    try {
      return readdirSync(albumDir)
    } catch {
      return []
    }
  })()

  const albums = files
    .filter(file => file.endsWith('.md'))
    .map(file => parseAlbumMarkdown(file, readFileSync(join(albumDir, file), 'utf8')))

  return albums
    .filter((album): album is Album => Boolean(album))
    .sort((a, b) => b.published.localeCompare(a.published))
}
