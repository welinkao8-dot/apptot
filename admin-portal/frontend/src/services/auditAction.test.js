import test from 'node:test'
import assert from 'node:assert/strict'
import { describeAuditAction } from './auditAction.js'

test('traduz as ações registadas e dá-lhes um tom', () => {
  assert.deepEqual(describeAuditAction('UPDATE STATUS ACTIVE'), { label: 'Conta de motorista ativada', tone: 'positive' })
  assert.deepEqual(describeAuditAction('update_status_suspended'), { label: 'Conta de motorista suspensa', tone: 'negative' })
  assert.deepEqual(describeAuditAction('pricing_updated'), { label: 'Tarifas atualizadas', tone: 'info' })
})

test('nunca mostra o valor cru do enum em inglês', () => {
  const raw = 'UPDATE STATUS ACTIVE'
  const { label } = describeAuditAction(raw)
  assert.ok(!label.includes('UPDATE'))
  assert.ok(!label.toUpperCase().includes('STATUS'))
  assert.match(label, /[a-zà-ú]/)
})

test('classifica ações desconhecidas pelo verbo, sem inventar um nome exato', () => {
  assert.deepEqual(describeAuditAction('driver_suspended_by_admin'), { label: 'Ação administrativa restritiva', tone: 'negative' })
  assert.deepEqual(describeAuditAction('driver_approved'), { label: 'Motorista aprovado', tone: 'positive' })
  assert.deepEqual(describeAuditAction('some_unknown_thing'), { label: 'Ação administrativa registada', tone: 'neutral' })
})

test('cobre a ausência de ação', () => {
  assert.deepEqual(describeAuditAction(''), { label: 'Registo de auditoria', tone: 'neutral' })
  assert.deepEqual(describeAuditAction(undefined), { label: 'Registo de auditoria', tone: 'neutral' })
})
