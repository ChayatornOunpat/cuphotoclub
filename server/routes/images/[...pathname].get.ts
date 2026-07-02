import type { H3Event } from 'h3'

// Serves blobs from R2 (view-only). Public URL: /images/<r2Key>
export default defineEventHandler(async (event) => {
  const pathname = getRouterParam(event, 'pathname')
  if (!pathname) throw createError({ statusCode: 400, message: 'ไม่พบรูปภาพ' })

  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  if (shouldProxyRemoteImages()) {
    const remoteOrigin = getRemoteImageOrigin()
    if (remoteOrigin) {
      const response = await fetchRemoteImage(event, remoteOrigin, pathname)
      if (response) return response
    }
  }

  return blob.serve(event, pathname)
})

function shouldProxyRemoteImages() {
  return process.env.NODE_ENV !== 'production' && realDataOnly()
}

function getRemoteImageOrigin() {
  const siteUrl = useRuntimeConfig().public.siteUrl
  if (typeof siteUrl !== 'string' || !siteUrl) return null

  try {
    const url = new URL(siteUrl)
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) return null
    return url.origin
  }
  catch {
    return null
  }
}

async function fetchRemoteImage(event: H3Event, origin: string, pathname: string) {
  const remotePath = pathname.split('/').map(segment => encodeURIComponent(segment)).join('/')
  const remoteUrl = `${origin}/images/${remotePath}`

  try {
    const response = await fetch(remoteUrl, {
      headers: {
        accept: getHeader(event, 'accept') || '*/*'
      }
    })

    if (!response.ok || !response.body) return null

    const headers = new Headers(response.headers)
    headers.delete('connection')
    headers.delete('content-encoding')
    headers.delete('content-length')
    headers.delete('transfer-encoding')
    headers.set('cache-control', 'public, max-age=31536000, immutable')

    return new Response(response.body, {
      status: response.status,
      headers
    })
  }
  catch {
    return null
  }
}
