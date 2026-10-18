import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOperationalTripRecordHtml, fetchConfirmedTripRecord, openOperationalTripRecord } from './operationalTripRecord.js';

const trip = {
  id: '48F3BEC5-0000-4000-8000-000000000001',
  status: 'completed',
  created_at: '2026-10-15T10:36:00.000Z',
  origin_address: 'Ango Belo, Viana, Angola',
  dest_address: '<script>alert(1)</script>',
  final_fare: 2710,
  trip_payment: { status: 'confirmed', method: 'cash', amount: 2710, confirmed_at: '2026-10-15T11:00:00.000Z' },
};

test('builds a non-fiscal trip record with payment state and escaped route data', () => {
  const html = buildOperationalTripRecordHtml(trip);
  assert.match(html, /RECIBO OPERACIONAL/);
  assert.match(html, /TOT-48F3BEC5/);
  assert.match(html, /Kz 2[\s\u00a0]?710/);
  assert.match(html, /Dinheiro · Confirmado/);
  assert.match(html, /não é uma factura fiscal/i);
  assert.doesNotMatch(html, /<script>alert/);
});

test('opens a browser document and invokes the native print/save dialog', () => {
  const calls = [];
  const popup = {
    document: {
      open: () => calls.push('document.open'),
      write: html => calls.push(['document.write', html]),
      close: () => calls.push('document.close'),
    },
    focus: () => calls.push('focus'),
    print: () => calls.push('print'),
    setTimeout: callback => callback(),
  };
  const browser = { open: () => popup };

  openOperationalTripRecord(trip, browser);

  assert.equal(popup.opener, null);
  assert.deepEqual(calls.map(call => Array.isArray(call) ? call[0] : call), [
    'document.open', 'document.write', 'document.close', 'focus', 'print',
  ]);
});

test('reports when the browser blocks the print window', () => {
  assert.throws(() => openOperationalTripRecord(trip, { open: () => null }), /permita a janela de impressão/i);
});
test('does not open or generate a PDF until the payment is confirmed', () => {
  let opened = 0;
  const popup = { document: { open() {}, write() {}, close() {} }, setTimeout() {}, focus() {}, print() {} };
  const browser = { open: () => { opened += 1; return popup; } };
  const pendingTrip = { ...trip, trip_payment: { status: 'pending', method: 'cash', amount: 2710 } };

  assert.throws(() => openOperationalTripRecord(pendingTrip, browser), /após a confirmação do pagamento pelo servidor/i);
  assert.equal(opened, 0);
});

test('loads the latest trip from the server and accepts only confirmed payment', async () => {
  let requestedId;
  const confirmedTrip = { ...trip, trip_payment: { status: 'confirmed', amount: 2710, confirmed_at: '2026-10-15T11:00:00.000Z' } };
  const result = await fetchConfirmedTripRecord(trip.id, async id => {
    requestedId = id;
    return { data: confirmedTrip };
  });

  assert.equal(requestedId, trip.id);
  assert.equal(result, confirmedTrip);
});

test('rejects a server response while payment remains pending', async () => {
  await assert.rejects(
    fetchConfirmedTripRecord(trip.id, async () => ({ data: { ...trip, trip_payment: { status: 'pending' } } })),
    /após a confirmação do pagamento pelo servidor/i,
  );
});

test('rejects canceled trips even when a payment record claims confirmation', () => {
  assert.throws(
    () => buildOperationalTripRecordHtml({ ...trip, status: 'cancelled' }),
    /após a confirmação do pagamento pelo servidor/i,
  );
});
