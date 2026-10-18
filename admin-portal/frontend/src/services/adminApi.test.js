import test from 'node:test'
import assert from 'node:assert/strict'
import * as adminApiModule from './adminApi.js'
import { clearAdminSession, setAdminAccessToken } from './adminAuthSession.js'

const { createAdminApi } = adminApiModule

test('validates and normalizes the admin API base URL', () => {
  assert.equal(typeof adminApiModule.resolveAdminApiBaseUrl, 'function')
  assert.equal(adminApiModule.resolveAdminApiBaseUrl(' https://admin.example/api/ ', 'production'), 'https://admin.example/api')
  assert.equal(adminApiModule.resolveAdminApiBaseUrl(undefined, 'development'), 'http://localhost:3000')
  assert.throws(() => adminApiModule.resolveAdminApiBaseUrl(undefined, 'production'), /VITE_API_URL/)
  assert.throws(() => adminApiModule.resolveAdminApiBaseUrl('http://admin.example', 'production'), /HTTPS/)
  assert.throws(() => adminApiModule.resolveAdminApiBaseUrl('javascript:alert(1)', 'development'), /http ou https/)
  assert.throws(() => adminApiModule.resolveAdminApiBaseUrl('https://user:pass@admin.example', 'production'), /credenciais/)
})

test('normalizes HTTP, network and offline errors consistently', () => {
  assert.equal(typeof adminApiModule.normalizeAdminApiError, 'function')
  assert.deepEqual(adminApiModule.normalizeAdminApiError({ response: { status: 403, data: { message: 'Acesso negado' } } }), {
    kind: 'http', status: 403, code: null, message: 'Acesso negado', retryable: false,
  })
  assert.deepEqual(adminApiModule.normalizeAdminApiError({ request: {}, code: 'ECONNABORTED' }), {
    kind: 'network', status: null, code: 'ECONNABORTED', message: 'Não foi possível contactar a API.', retryable: true,
  })
  assert.deepEqual(adminApiModule.normalizeAdminApiError(new Error('Unexpected')), {
    kind: 'unknown', status: null, code: null, message: 'Ocorreu um erro inesperado.', retryable: false,
  })
})

test('attaches the in-memory admin token to each request without mutating axios defaults', () => {
  let requestInterceptor
  const instance = { interceptors: { request: { use: callback => { requestInterceptor = callback } }, response: { use: () => {} } } }
  const axios = { create: options => { assert.equal(options.baseURL, 'https://admin.example'); return instance } }

  setAdminAccessToken('current-token')
  const api = createAdminApi({ axios, baseURL: 'https://admin.example' })
  const config = requestInterceptor({ headers: { Accept: 'application/json' } })

  assert.equal(config.headers.Authorization, 'Bearer current-token')
  assert.equal(config.headers.Accept, 'application/json')
  assert.equal(api, instance)
  clearAdminSession(null, null)
})

test('omits the authorization header after signout', () => {
  let requestInterceptor
  const instance = { interceptors: { request: { use: callback => { requestInterceptor = callback } }, response: { use: () => {} } } }
  const axios = { create: () => instance }
  setAdminAccessToken('temporary-token')
  clearAdminSession(null, null)
  const api = createAdminApi({ axios })

  assert.deepEqual(requestInterceptor({ headers: {} }).headers, {})
  assert.equal(api, instance)
})

test('expires the session on REST 401 responses only', async () => {
  let responseRejected
  let expired = 0
  const instance = { interceptors: { request: { use: () => {} }, response: { use: (_success, reject) => { responseRejected = reject } } } }
  const axios = { create: () => instance }
  const api = createAdminApi({ axios, onAuthExpired: () => { expired += 1 } })
  const unauthorized = { response: { status: 401 }, config: { url: '/admin/auth/refresh' } }
  const forbidden = { response: { status: 403 } }
  const networkFailure = { request: {} }

  await assert.rejects(responseRejected(unauthorized), error => error === unauthorized)
  await assert.rejects(responseRejected(forbidden), error => {
    assert.deepEqual(error.adminApiError, {
      kind: 'http', status: 403, code: null, message: 'A API recusou o pedido.', retryable: false,
    })
    return error === forbidden
  })
  await assert.rejects(responseRejected(networkFailure), error => error === networkFailure)
  assert.equal(expired, 1)
  assert.equal(api, instance)
})

test('renews an expired access token once and retries the request with the current token', async () => {
  let responseRejected
  let replayedRequest
  let refreshedUser
  const client = {
    interceptors: {
      request: { use: () => {} },
      response: { use: (_success, reject) => { responseRejected = reject } },
    },
    request: request => { replayedRequest = request; return Promise.resolve('retried') },
  }
  const authClient = {
    post: async (url, body, options) => {
      assert.equal(url, '/admin/auth/refresh')
      assert.deepEqual(body, {})
      assert.equal(options.withCredentials, true)
      return { data: { token: 'new-token', user: { id: 'admin-1' } } }
    },
  }
  const instances = [client, authClient]
  const axios = { create: options => { assert.equal(options.withCredentials, true); return instances.shift() } }
  const onAuthExpired = () => assert.fail('A sessão válida não deve ser expirada')
  const onSessionRefreshed = user => { refreshedUser = user }
  createAdminApi({ axios, onAuthExpired, onSessionRefreshed })
  const originalRequest = { url: '/admin/trips', headers: {} }

  const result = await responseRejected({ response: { status: 401 }, config: originalRequest })

  assert.equal(result, 'retried')
  assert.equal(replayedRequest.headers.Authorization, 'Bearer new-token')
  assert.equal(replayedRequest.__adminAuthRetried, true)
  assert.deepEqual(refreshedUser, { id: 'admin-1' })
})

