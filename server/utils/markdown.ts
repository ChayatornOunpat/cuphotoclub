import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

// Light sanitize for trusted-admin content: drop dangerous tags, inline handlers, js: urls.
function sanitize(html: string): string {
  return html
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '$1="#"')
}

export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return ''
  const html = marked.parse(md, { async: false }) as string
  return sanitize(html)
}
