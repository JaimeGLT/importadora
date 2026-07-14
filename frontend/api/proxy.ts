export const runtime = 'edge'

const BACKEND = 'https://importadora-posn.onrender.com'
// const BACKEND = "http://localhost:5120"

function rewriteSetCookie(setCookieValue: string | null, targetDomain: string): string {
  if (!setCookieValue) return ''

  return setCookieValue.split(', ').map(cookie => {
    const domainMatch = cookie.match(/domain=([^;]+)/i)
    if (domainMatch) {
      return cookie.replace(`domain=${domainMatch[1]}`, `domain=${targetDomain}`)
    }
    return `${cookie}; domain=${targetDomain}`
  }).join(', ')
}

async function proxyRequest(request: Request, path: string): Promise<Response> {
  const url = new URL(request.url)
  const queryString = url.search

  const response = await fetch(`${BACKEND}${path}${queryString}`, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    credentials: 'include',
    body: ['POST', 'PUT', 'PATCH'].includes(request.method) ? await request.text() : undefined,
  })

  const newHeaders = new Headers()
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      newHeaders.set(key, rewriteSetCookie(value, '.snakil.com'))
    } else {
      newHeaders.set(key, value)
    }
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api/, '')
  return proxyRequest(request, `/api${path}`)
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api/, '')
  return proxyRequest(request, `/api${path}`)
}

export async function PUT(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api/, '')
  return proxyRequest(request, `/api${path}`)
}

export async function PATCH(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api/, '')
  return proxyRequest(request, `/api${path}`)
}

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api/, '')
  return proxyRequest(request, `/api${path}`)
}