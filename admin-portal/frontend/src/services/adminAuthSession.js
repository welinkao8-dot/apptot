export const ADMIN_AUTH_EXPIRED_EVENT = 'admin:auth-expired'
export const ADMIN_AUTH_REFRESHED_EVENT = 'admin:auth-refreshed'

let adminAccessToken = null
let restoreSessionPromise = null

export function setAdminAccessToken(token) {
  adminAccessToken = typeof token === 'string' && token.trim() ? token : null
}

export function getAdminAccessToken() {
  return adminAccessToken
}

export function restoreAdminSession(adminApi) {
  if (restoreSessionPromise) return restoreSessionPromise
  restoreSessionPromise = adminApi.post('/admin/auth/refresh')
    .then(response => {
      const { token, user } = response?.data ?? {}
      if (typeof token !== 'string' || !token || !user || typeof user !== 'object' || Array.isArray(user)) {
        throw new Error('Resposta de renovação de sessão inválida.')
      }
      setAdminAccessToken(token)
      return user
    })
    .finally(() => { restoreSessionPromise = null })
  return restoreSessionPromise
}

export function notifyAdminSessionRefreshed(user, eventTarget = getBrowserWindow()) {
  if (!eventTarget) return
  const event = typeof CustomEvent === 'function'
    ? new CustomEvent(ADMIN_AUTH_REFRESHED_EVENT, { detail: { user } })
    : new Event(ADMIN_AUTH_REFRESHED_EVENT)
  if (!('detail' in event)) Object.defineProperty(event, 'detail', { value: { user } })
  eventTarget.dispatchEvent(event)
}

export function readStoredAdminUser(storage) {
  try {
    const rawUser = storage?.getItem('tot_user')
    if (!rawUser) return null
    const user = JSON.parse(rawUser)
    return user && typeof user === 'object' && !Array.isArray(user) ? user : null
  } catch {
    return null
  }
}

export function clearAdminSession(storage = getBrowserStorage(), eventTarget = getBrowserWindow()) {
  adminAccessToken = null
  try {
    storage?.removeItem('tot_user')
    storage?.removeItem('tot_token')
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }

  try {
    eventTarget?.dispatchEvent(new Event(ADMIN_AUTH_EXPIRED_EVENT))
  } catch {
    // The session can still be cleared when custom events are unavailable.
  }
}

export function isAdminSocketAuthRejection(error) {
  if (error === 'io server disconnect') return true

  const status = error?.data?.statusCode ?? error?.data?.status ?? error?.status
  if (status === 401) return true

  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''
  return /authentication failed|unauthori[sz]ed|unauthenticated|invalid token|token expired|missing token|invalid actor/.test(message)
}

export function bindAdminSocketAuth(socket, onAuthExpired = clearAdminSession) {
  const handleConnectError = error => {
    if (isAdminSocketAuthRejection(error)) onAuthExpired()
  }
  const handleDisconnect = reason => {
    if (isAdminSocketAuthRejection(reason)) onAuthExpired()
  }

  socket.on('connect_error', handleConnectError)
  socket.on('disconnect', handleDisconnect)
  return () => {
    socket.off('connect_error', handleConnectError)
    socket.off('disconnect', handleDisconnect)
  }
}

function getBrowserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function getBrowserWindow() {
  return typeof window === 'undefined' ? null : window
}

