const GQL_URL = import.meta.env.VITE_GQL_URL ?? '/graphql'

let refreshFn: (() => Promise<boolean>) | null = null
let logoutFn: (() => Promise<void>) | null = null
let refreshPromise: Promise<boolean> | null = null

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  retry = false,
): Promise<T> {
  const response = await fetch(GQL_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })

  if (response.status === 401 && !retry && refreshFn) {
    if (!refreshPromise) {
      refreshPromise = refreshFn().finally(() => { refreshPromise = null })
    }
    const refreshed = await refreshPromise
    if (refreshed) {
      return gql<T>(query, variables, true)
    }
    if (logoutFn) {
      await logoutFn()
      window.location.href = '/login'
    }
    throw new Error('Sesión expirada')
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const json = (await response.json()) as {
    data?: T
    errors?: { message: string; extensions?: { code?: string } }[]
  }

  const isAuthError = !retry && refreshFn && json.errors?.some(
    e => e.extensions?.code === 'AUTH_NOT_AUTHENTICATED' || e.extensions?.code === 'AUTH_NOT_AUTHORIZED'
  )

  if (isAuthError) {
    if (!refreshPromise) {
      refreshPromise = refreshFn!().finally(() => { refreshPromise = null })
    }
    const refreshed = await refreshPromise
    if (refreshed) return gql<T>(query, variables, true)
    if (logoutFn) { await logoutFn(); window.location.href = '/login' }
    throw new Error('Sesión expirada')
  }

  if (json.errors?.length) throw new Error(json.errors[0].message)

  return json.data as T
}

export function initGqlCallbacks(refresh: () => Promise<boolean>, logout: () => Promise<void>) {
  refreshFn = refresh
  logoutFn = logout
}

export function clearGqlCallbacks() {
  refreshFn = null
  logoutFn = null
  refreshPromise = null
}