import axios from 'axios'
import {
  clearAdminSession,
  getAdminAccessToken,
  notifyAdminSessionRefreshed,
  setAdminAccessToken,
} from './adminAuthSession.js'

export function resolveAdminApiBaseUrl(baseUrl, mode = 'development') {
  const configuredUrl = typeof baseUrl === 'string' ? baseUrl.trim() : ''
  if (!configuredUrl && mode === 'production') {
    throw new Error('VITE_API_URL é obrigatório no build de produção.')
  }

  const value = configuredUrl || 'http://localhost:3000'
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('VITE_API_URL deve ser uma URL absoluta válida.')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('VITE_API_URL deve usar http ou https.')
  }
  if (parsed.username || parsed.password) {
    throw new Error('VITE_API_URL não pode incluir credenciais.')
  }
  if (parsed.search || parsed.hash) {
    throw new Error('VITE_API_URL não pode incluir query ou fragmento.')
  }
  if (mode === 'production' && parsed.protocol !== 'https:') {
    throw new Error('VITE_API_URL deve usar HTTPS em produção.')
  }

  return parsed.href.replace(/\/$/, '')
}

export function normalizeAdminApiError(error) {
  const response = error?.response
  const status = Number.isInteger(response?.status) ? response.status : null
  const code = typeof error?.code === 'string' ? error.code : null
  const responseMessage = response?.data?.message
  const message = typeof responseMessage === 'string'
    ? responseMessage
    : Array.isArray(responseMessage) && responseMessage.every(item => typeof item === 'string')
      ? responseMessage.join(' ')
      : response ? 'A API recusou o pedido.'
        : error?.request ? 'Não foi possível contactar a API.'
          : 'Ocorreu um erro inesperado.'

  return {
    kind: response ? 'http' : error?.request ? 'network' : 'unknown',
    status,
    code,
    message,
    retryable: !response ? Boolean(error?.request) : status === 429 || status >= 500,
  }
}

export function createAdminApi({ axios: axiosClient = axios, baseURL, mode = 'development', onAuthExpired = () => clearAdminSession(), onSessionRefreshed = notifyAdminSessionRefreshed } = {}) {
  const resolvedBaseURL = resolveAdminApiBaseUrl(baseURL, mode)
  const clientOptions = { baseURL: resolvedBaseURL, timeout: 15000, withCredentials: true }
  const client = axiosClient.create({
    ...clientOptions,
  })
  const authClient = axiosClient.create(clientOptions)
  let refreshPromise = null

  client.interceptors.request.use(config => {
    const token = getAdminAccessToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  client.interceptors.response.use(
    response => response,
    async error => {
      if (error && typeof error === 'object') error.adminApiError = normalizeAdminApiError(error)
      if (error?.response?.status !== 401) return Promise.reject(error)

      const request = error.config
      const url = typeof request?.url === 'string' ? request.url : ''
      const isRefreshRequest = url.endsWith('/admin/auth/refresh')
      const isAuthRequest = /\/admin\/auth\/(login|refresh|logout)$/.test(url)
      if (isRefreshRequest) {
        onAuthExpired()
        return Promise.reject(error)
      }
      if (isAuthRequest || !request || request.__adminAuthRetried) return Promise.reject(error)

      request.__adminAuthRetried = true
      try {
        if (!refreshPromise) {
          refreshPromise = authClient.post('/admin/auth/refresh', {}, { withCredentials: true })
            .then(response => {
              const { token, user } = response.data ?? {}
              if (typeof token !== 'string' || !token || !user || typeof user !== 'object') {
                throw new Error('Resposta de renovação de sessão inválida.')
              }
              setAdminAccessToken(token)
              onSessionRefreshed(user)
              return token
            })
            .finally(() => { refreshPromise = null })
        }
        const token = await refreshPromise
        request.headers = request.headers || {}
        request.headers.Authorization = `Bearer ${token}`
        return client.request(request)
      } catch (refreshError) {
        if (refreshError?.response?.status === 401) onAuthExpired()
        return Promise.reject(error)
      }
    },
  )

  return client
}

export const adminApi = createAdminApi({
  baseURL: import.meta.env?.VITE_API_URL,
  mode: import.meta.env?.MODE,
})

export default adminApi
