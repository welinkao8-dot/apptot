import test from 'node:test'
import assert from 'node:assert/strict'
import { readStoredAdminUser, isAdminSocketAuthRejection } from './adminAuthSession.js'

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

