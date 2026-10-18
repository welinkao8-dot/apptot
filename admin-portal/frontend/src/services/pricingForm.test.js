import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPricingServicePayload, isPricingServiceDirty, normalizePricingService, normalizeVehicleCategory, formatVehicleCategory } from './pricingForm.js'

const validService = {
    name: 'Moto',
    category: 'ride',
    vehicle_category: 'moto',
    routing_mode: 'scooter',
    platform_fee_type: 'percentage',
    base_fare: '500',
    price_per_km: '150.25',
    price_per_min: '10',
    min_fare: '700',
    platform_fee_value: '15.5',
}

test('normalizes valid monetary fields as numbers with database precision', () => {
    const normalized = normalizePricingService(validService)

    assert.deepEqual(
        Object.fromEntries(['base_fare', 'price_per_km', 'price_per_min', 'min_fare', 'platform_fee_value'].map((key) => [key, normalized[key]])),
        { base_fare: 500, price_per_km: 150.25, price_per_min: 10, min_fare: 700, platform_fee_value: 15.5 },
    )
})

test('normalizes decimal strings returned by the server before display', () => {
    const normalized = normalizePricingService({
        ...validService,
        base_fare: '500.00',
        price_per_km: '150.25',
        price_per_min: '10.00',
        min_fare: '700.00',
        platform_fee_value: '15.50',
    })
    assert.equal(normalized.base_fare, 500)
    assert.equal(normalized.platform_fee_value, 15.5)
})

test('normalizes the legacy percent fee type returned by existing services', () => {
    const normalized = normalizePricingService({ ...validService, platform_fee_type: 'percent' })
    assert.equal(normalized.platform_fee_type, 'percentage')
})

test('builds an API payload without read-only metadata and normalizes the fee type', () => {
    const payload = buildPricingServicePayload({
        ...validService,
        id: 7,
        updated_at: '2026-10-17T10:00:00.000Z',
        created_at: '2026-10-01T10:00:00.000Z',
        platform_fee_type: 'percent',
    })

    assert.equal(payload.platform_fee_type, 'percentage')
    assert.equal(Object.hasOwn(payload, 'id'), false)
    assert.equal(Object.hasOwn(payload, 'updated_at'), false)
    assert.equal(Object.hasOwn(payload, 'created_at'), false)
})

test('rejects empty, negative, non-finite, over-precision and out-of-range amounts', () => {
    for (const invalid of ['', '-1', '1.001', '1e3', '100000000']) {
        assert.throws(
            () => normalizePricingService({ ...validService, base_fare: invalid }),
            /Base \(Kz\)/,
            `expected ${invalid || 'empty'} to be rejected`,
        )
    }
})

test('rejects a route mode incompatible with a recognizable vehicle category', () => {
    assert.throws(
        () => normalizePricingService({ ...validService, vehicle_category: 'moto', routing_mode: 'car' }),
        /incompatível/,
    )
})

test('rejects percentage fees above 100 percent', () => {
    assert.throws(
        () => normalizePricingService({ ...validService, platform_fee_value: '100.01' }),
        /Taxa percentual não pode exceder 100%/,
    )
})

test('accepts the exact database maximum and fixed fees above 100 Kz', () => {
    assert.equal(normalizePricingService({ ...validService, base_fare: '99999999.99' }).base_fare, 99999999.99)
    assert.equal(normalizePricingService({ ...validService, platform_fee_type: 'fixed', platform_fee_value: '100.01' }).platform_fee_value, 100.01)
})

test('compares edited monetary values by their submitted decimal value', () => {
    const original = { ...validService, base_fare: '500.00' }
    assert.equal(isPricingServiceDirty(original, { ...validService, base_fare: 500 }), false)
    assert.equal(isPricingServiceDirty(original, { ...validService, base_fare: '500.01' }), true)
    assert.equal(isPricingServiceDirty({ ...original, base_fare: '' }, { ...validService, base_fare: 0 }), true)
    assert.equal(isPricingServiceDirty(null, validService), true)
})

test('normalizes and formats vehicle categories accurately', () => {
    assert.equal(normalizeVehicleCategory('moto'), 'moto')
    assert.equal(normalizeVehicleCategory('Motorcycle'), 'moto')
    assert.equal(normalizeVehicleCategory('Scooter'), 'moto')
    assert.equal(normalizeVehicleCategory('car'), 'car')
    assert.equal(normalizeVehicleCategory('Carro'), 'car')
    assert.equal(normalizeVehicleCategory('Automóvel'), 'car')
    assert.equal(normalizeVehicleCategory('van'), 'van')
    assert.equal(normalizeVehicleCategory('Carrinha'), 'van')
    assert.equal(normalizeVehicleCategory('truck'), 'truck')
    assert.equal(normalizeVehicleCategory('Camião'), 'truck')

    assert.equal(formatVehicleCategory('moto'), 'Moto')
    assert.equal(formatVehicleCategory('car'), 'Carro')
    assert.equal(formatVehicleCategory('van'), 'Carrinha')
    assert.equal(formatVehicleCategory('truck'), 'Camião')
})
