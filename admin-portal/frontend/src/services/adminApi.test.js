import test from 'node:test'
import assert from 'node:assert/strict'
import { createAdminApi } from './adminApi.js'

test('attaches the current admin token to each request without mutating axios defaults', () => {
  let requestInterceptor
  const instance = { interceptors: { request: { use: callback => { requestInterceptor = callback } }, response: { use: () => {} } } }
  const axios = { create: options => { assert.equal(options.baseURL, 'https://admin.example'); return instance } }
  const storage = { getItem: key => key === 'tot_token' ? 'current-token' : null }

  const api = createAdminApi({ axios, storage, baseURL: 'https://admin.example' })
  const config = requestInterceptor({ headers: { Accept: 'application/json' } })

  assert.equal(config.headers.Authorization, 'Bearer current-token')
  assert.equal(config.headers.Accept, 'application/json')
  assert.equal(api, instance)
})

test('omits the authorization header after signout and tolerates inaccessible storage', () => {
  let requestInterceptor
  const instance = { interceptors: { request: { use: callback => { requestInterceptor = callback } }, response: { use: () => {} } } }
  const axios = { create: () => instance }
  const api = createAdminApi({ axios, storage: { getItem: () => { throw new Error('storage unavailable') } } })

  assert.deepEqual(requestInterceptor({ headers: {} }).headers, {})
  assert.equal(api, instance)
})

test('expires the session on REST 401 responses only', async () => {
  let responseRejected
  let expired = 0
  const instance = { interceptors: { request: { use: () => {} }, response: { use: (_success, reject) => { responseRejected = reject } } } }
  const axios = { create: () => instance }
  const api = createAdminApi({ axios, onAuthExpired: () => { expired += 1 } })
  const unauthorized = { response: { status: 401 } }
  const forbidden = { response: { status: 403 } }
  const networkFailure = { request: {} }

  await assert.rejects(responseRejected(unauthorized), error => error === unauthorized)
  await assert.rejects(responseRejected(forbidden), error => error === forbidden)
  await assert.rejects(responseRejected(networkFailure), error => error === networkFailure)
  assert.equal(expired, 1)
  assert.equal(api, instance)
})

