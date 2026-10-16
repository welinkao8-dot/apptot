import axios from 'axios'
import { clearAdminSession } from './adminAuthSession.js'

export function createAdminApi({ axios: axiosClient = axios, storage = null, baseURL, onAuthExpired = () => clearAdminSession(storage) } = {}) {
  const client = axiosClient.create({
    baseURL,
    timeout: 15000,
  })

  client.interceptors.request.use(config => {
    let token = null
    try {
      token = storage?.getItem('tot_token') || null
    } catch {
      token = null
    }

    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  client.interceptors.response.use(
    response => response,
    error => {
      if (error?.response?.status === 401) onAuthExpired()
      return Promise.reject(error)
    },
  )

  return client
}

function getBrowserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const adminApi = createAdminApi({
  storage: getBrowserStorage(),
  baseURL: import.meta.env?.VITE_API_URL || 'http://localhost:3000',
})

export default adminApi
