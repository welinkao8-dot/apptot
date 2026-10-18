import test from 'node:test'
import assert from 'node:assert/strict'
import * as authSession from './adminAuthSession.js'

const { readStoredAdminUser, isAdminSocketAuthRejection } = authSession

test('keeps the access token in memory and clears legacy persistent tokens on logout', () => {
  assert.equal(typeof authSession.setAdminAccessToken, 'function')
  assert.equal(typeof authSession.getAdminAccessToken, 'function')
  const removed = []
  const storage = { removeItem: key => removed.push(key) }
  const events = []
  const eventTarget = { dispatchEvent: event => events.push(event.type) }

  authSession.setAdminAccessToken('short-lived-token')
  assert.equal(authSession.getAdminAccessToken(), 'short-lived-token')
  authSession.clearAdminSession(storage, eventTarget)
  assert.equal(authSession.getAdminAccessToken(), null)
  assert.deepEqual(removed.sort(), ['tot_token', 'tot_user'])
  assert.deepEqual(events, [authSession.ADMIN_AUTH_EXPIRED_EVENT])
})

test('restores an admin by refreshing the HttpOnly cookie and keeps the new access token in memory', async () => {
  assert.equal(typeof authSession.restoreAdminSession, 'function')
  const user = { id: 'admin-1', full_name: 'Admin' }
  let refreshPath
  const restoredUser = await authSession.restoreAdminSession({
    post: async path => { refreshPath = path; return { data: { token: 'renewed-token', user } } },
  })

  assert.equal(refreshPath, '/admin/auth/refresh')
  assert.deepEqual(restoredUser, user)
  assert.equal(authSession.getAdminAccessToken(), 'renewed-token')
  authSession.clearAdminSession(null, null)
})

test('shares one in-flight restore to avoid rotating the same refresh cookie twice', async () => {
  assert.equal(typeof authSession.restoreAdminSession, 'function')
  let calls = 0
  let resolveRefresh
  const api = { post: () => {
    calls += 1
    return new Promise(resolve => { resolveRefresh = resolve })
  } }
  const first = authSession.restoreAdminSession(api)
  const second = authSession.restoreAdminSession(api)
  assert.equal(calls, 1)
  resolveRefresh({ data: { token: 'shared-token', user: { id: 'admin-1' } } })
  assert.deepEqual(await Promise.all([first, second]), [{ id: 'admin-1' }, { id: 'admin-1' }])
  authSession.clearAdminSession(null, null)
})

test('invalid stored user JSON is treated as an unauthenticated bootstrap', () => {
  const storage = { getItem: key => key === 'tot_user' ? '{broken json' : 'token' }
  assert.equal(readStoredAdminUser(storage), null)
})

test('socket auth errors are classified without treating transport failures as expiry', () => {
  assert.equal(isAdminSocketAuthRejection({ message: 'Authentication failed' }), true)
  assert.equal(isAdminSocketAuthRejection({ data: { statusCode: 401 } }), true)
  assert.equal(isAdminSocketAuthRejection({ message: 'websocket error' }), false)
  assert.equal(isAdminSocketAuthRejection({ message: 'transport close' }), false)
  assert.equal(isAdminSocketAuthRejection('io server disconnect'), true)
  assert.equal(isAdminSocketAuthRejection({ data: { statusCode: 403 } }), false)
})

