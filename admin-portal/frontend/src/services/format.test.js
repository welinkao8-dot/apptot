import test from 'node:test'
import assert from 'node:assert/strict'
import { formatKz, formatKzExact, formatNumber, formatPhone, formatDateTime, formatDayShort } from './format.js'

/* O ICU pode usar espaço normal, espaço inquebrável ou espaço estreito como
   separador de milhares. Normalizar deixa o teste sobre o comportamento
   (agrupar com separador) e não sobre a variante que o ICU escolheu. */
const plain = value => String(value).replace(/[\u00a0\u202f\u2009]/g, ' ')

test('agrupa os milhares em pt-AO, onde o navegador em en-US agruparia com vírgula', () => {
  assert.equal(plain(formatNumber(2022)), '2 022')
  assert.equal(plain(formatNumber(1234567)), '1 234 567')
  assert.equal(plain(formatNumber(0)), '0')
})

test('prefixa a moeda com Kz em vez do sufixo nativo do Intl para AOA', () => {
  assert.equal(plain(formatKz(2022)), 'Kz 2 022')
  assert.equal(plain(formatKzExact(2710.5)), 'Kz 2 710,50')
})

test('nunca devolve NaN para valores em falta ou inválidos', () => {
  for (const value of [undefined, null, '', 'not-money', NaN, {}]) {
    assert.equal(plain(formatKz(value)), 'Kz 0')
  }
})

test('formata telefones angolanos de 9 e 12 dígitos e recusa o resto', () => {
  assert.equal(formatPhone('946880420'), '946 880 420')
  assert.equal(formatPhone('244946880420'), '+244 946 880 420')
  assert.equal(formatPhone('9999999'), '9999999')
  assert.equal(formatPhone(''), 'Sem telefone')
})

test('devolve o marcador de ausência em vez de Invalid Date', () => {
  assert.equal(formatDateTime(null), 'Sem data registada')
  assert.equal(formatDateTime('não é uma data'), 'Sem data registada')
  assert.equal(formatDayShort('2026-10-03'), '03/10')
})
