import test from 'node:test'
import assert from 'node:assert/strict'
import { describeInvoiceType, formatInvoiceType } from './invoiceType.js'

test('traduz ride_receipt e outros enums para português', () => {
    assert.equal(describeInvoiceType('ride_receipt').label, 'Recibo de Corrida')
    assert.equal(describeInvoiceType('ride').label, 'Corrida')
    assert.equal(describeInvoiceType('delivery_receipt').label, 'Recibo de Entrega')
    assert.equal(describeInvoiceType('delivery').label, 'Entrega')
    assert.equal(describeInvoiceType('topup').label, 'Carregamento')
    assert.equal(describeInvoiceType('driver').label, 'Motorista')
    assert.equal(describeInvoiceType('client').label, 'Cliente')
})

test('nunca devolve strings cruas em snake_case ou nulas', () => {
    assert.equal(describeInvoiceType(null).label, 'Geral')
    assert.equal(describeInvoiceType('').label, 'Geral')
    assert.equal(formatInvoiceType('ride_receipt'), 'Recibo de Corrida')
    assert.equal(describeInvoiceType('custom_fee').label, 'Custom Fee')
})
