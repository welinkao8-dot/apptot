const assert = require('node:assert/strict');
const fs = require('node:fs');

function trace(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  if (process.env.PLAN01_TRACE_PATH) fs.appendFileSync(process.env.PLAN01_TRACE_PATH, `${line}\n`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const clientPath = process.env.PLAN01_TEST_CLIENT_PATH;
  const parsedUrl = databaseUrl ? new URL(databaseUrl) : null;
  assert(parsedUrl && ['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname), 'Refusing to run outside a local PostgreSQL instance.');
  assert(parsedUrl.pathname.toLowerCase().includes('test'), 'Refusing to run unless the database name contains "test".');
  assert(clientPath, 'PLAN01_TEST_CLIENT_PATH must point to the temporary generated Prisma Client.');

  const { PrismaClient } = require(clientPath);
  const { TripsService: ClientTripsService } = require('../apps/client-api/src/trips/trips.service');
  const { QuotesService } = require('../apps/client-api/src/quotes/quotes.service');
  const { TripsService: DriverTripsService } = require('../apps/driver-api/src/trips/trips.service');
  const { PaymentsService } = require('../apps/driver-api/src/payments/payments.service');
  const prisma = new PrismaClient();
  const ids = {
    client: '10000000-0000-4000-8000-000000000001',
    secondClient: '10000000-0000-4000-8000-000000000002',
    deliveryClient: '10000000-0000-4000-8000-000000000003',
    admin: '10000000-0000-4000-8000-000000000004',
    drivers: [
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000004',
    ],
    trips: [],
    quotes: [],
    serviceConfigs: [],
  };

  try {
    trace('Connecting to isolated PostgreSQL.');
    await prisma.$connect();
    trace('Connected; seeding test identities.');
    await prisma.profiles.create({ data: { id: ids.client, full_name: 'Plan 01 client', phone: '+244900000101', role: 'client', status: 'active' } });
    await prisma.profiles.create({ data: { id: ids.secondClient, full_name: 'Plan 01 second client', phone: '+244900000100', role: 'client', status: 'active' } });
    await prisma.profiles.create({ data: { id: ids.deliveryClient, full_name: 'Plan 01 delivery client', phone: '+244900000099', role: 'client', status: 'active' } });
    await prisma.profiles.create({ data: { id: ids.admin, full_name: 'Plan 04 admin', phone: '+244900000098', role: 'admin', status: 'active' } });
    for (const [index, id] of ids.drivers.entries()) {
      await prisma.profiles.create({ data: { id, full_name: `Plan 01 driver ${index + 1}`, phone: `+24490000010${index + 2}`, role: 'driver', status: 'active' } });
      await prisma.drivers.create({ data: { id, full_name: `Plan 01 driver ${index + 1}`, phone: `+24490000010${index + 2}`, status: 'active', is_online: true, vehicle_category: 'car' } });
    }

    const serviceConfig = await prisma.service_configs.create({ data: {
      name: 'Plan 01 car', category: 'ride', service_type: 'standard', vehicle_category: 'car', routing_mode: 'car',
      base_fare: '500.00', price_per_km: '300.00', price_per_min: '10.00', min_fare: '700.00', platform_fee_value: '0.00',
    } });
    ids.serviceConfigs.push(serviceConfig.id);
    const createQuote = async (category = 'ride', serviceConfigId = null, clientId = ids.client) => {
      const quote = await prisma.trip_quotes.create({ data: {
        client_id: clientId,
        service_config_id: serviceConfigId,
        category,
        origin_address: 'Plan 01 origin', origin_lat: -8.83, origin_lng: 13.24,
        dest_address: 'Plan 01 destination', dest_lat: -8.84, dest_lng: 13.25,
        delivery_info: category === 'delivery' ? { recipientName: 'Test recipient', recipientPhone: '+244900000999', packageDescription: 'Envelope' } : undefined,
        distance_meters: 1800, duration_seconds: 420, estimated_fare: '1234.50',
        pricing_snapshot: { baseFare: 500, pricePerKm: 300, pricePerMin: 10, route: { polyline: 'test-polyline' } },
        expires_at: new Date(Date.now() + 10 * 60_000),
      } });
      ids.quotes.push(quote.id);
      return quote;
    };
    const createTrip = async (status = 'requested', category = 'ride', driverId = null, clientId = ids.client) => {
      const trip = await prisma.trips.create({ data: {
        client_id: clientId, driver_id: driverId, status, category,
        origin_address: 'Plan 01 origin', origin_lat: -8.83, origin_lng: 13.24,
        dest_address: 'Plan 01 destination', dest_lat: -8.84, dest_lng: 13.25,
        estimated_fare: '1234.50', delivery_info: category === 'delivery'
          ? { recipientName: 'Test recipient', recipientPhone: '+244900000999', packageDescription: 'Envelope' }
          : undefined,
        accepted_at: status === 'accepted' || status === 'ongoing' ? new Date() : undefined,
        started_at: status === 'ongoing' ? new Date() : undefined,
      } });
      ids.trips.push(trip.id);
      return trip;
    };

    const clientTrips = new ClientTripsService(prisma, new QuotesService(prisma, {}));
    trace('Checking Admin API price update flows into Client API quotes while old pricing snapshots stay immutable.');
    const firstQuote = await createQuote('ride', serviceConfig.id);
    const { AdminApiService } = require('../apps/admin-api/src/admin-api.service');
    const adminApi = new AdminApiService(prisma, { sendToAdmins: () => {} }, {});
    await adminApi.updateServiceConfig(serviceConfig.id, {
      base_fare: 600, price_per_km: 120, price_per_min: 10, min_fare: 700,
    }, ids.admin);
    const clientQuotes = new QuotesService(prisma, {
      getRoute: async () => ({ distanceMeters: 1800, durationSeconds: 420, polyline: 'plan04-updated-route' }),
    });
    const newQuotes = await clientQuotes.create(ids.secondClient, {
      serviceConfigId: serviceConfig.id, category: 'ride',
      originAddress: 'Plan 04 origin', destAddress: 'Plan 04 destination',
      originLat: -8.83, originLng: 13.24, destLat: -8.84, destLng: 13.25,
    });
    const updatedQuote = newQuotes.find((quote) => quote.serviceConfigId === serviceConfig.id);
    assert(updatedQuote, 'Client API should return a quote for the updated service');
    assert.equal(Number(updatedQuote.estimatedFare).toFixed(2), '886.00', 'new quote should calculate using the service price saved through Admin API');
    const updatedQuoteRow = await prisma.trip_quotes.findUnique({ where: { id: updatedQuote.id } });
    assert.deepEqual(updatedQuoteRow.pricing_snapshot, {
      baseFare: 600, pricePerKm: 120, pricePerMin: 10, minFare: 700,
      serviceConfigId: serviceConfig.id, serviceName: 'Plan 01 car', routingMode: 'car',
      route: { polyline: 'plan04-updated-route' },
    });
    const pricingAudit = await prisma.audit_logs.findFirst({ where: { action: 'UPDATE_PRICING', target_id: String(serviceConfig.id) } });
    assert.equal(pricingAudit.admin_id, ids.admin, 'Admin API pricing audit should identify the acting admin');
    assert.equal(Number(pricingAudit.details.before.base_fare), 500);
    assert.equal(Number(pricingAudit.details.after.base_fare), 600);
    const oldQuoteRow = await prisma.trip_quotes.findUnique({ where: { id: firstQuote.id } });
    assert.equal(oldQuoteRow.estimated_fare.toFixed(2), '1234.50');
    assert.equal(oldQuoteRow.pricing_snapshot.baseFare, 500, 'existing quote snapshot should remain unchanged after Admin API update');

    trace('Checking quote idempotency.');
    const sameQuoteResults = await Promise.all([
      clientTrips.create({ quoteId: firstQuote.id }, ids.client),
      clientTrips.create({ quoteId: firstQuote.id }, ids.client),
    ]);
    assert.equal(sameQuoteResults[0].id, sameQuoteResults[1].id, 'same-quote retries should resolve to the same persisted trip');
    assert.equal(sameQuoteResults[0].estimated_fare.toFixed(2), '1234.50', 'trip fare must use the immutable quote snapshot after live pricing changes');
    ids.trips.push(sameQuoteResults[0].id);
    assert.equal(await prisma.trips.count({ where: { quote_id: firstQuote.id } }), 1);

    trace('Checking one-active-trip rule.');
    const [secondQuote, thirdQuote] = await Promise.all([createQuote(), createQuote()]);
    const differentQuoteResults = await Promise.allSettled([
      clientTrips.create({ quoteId: secondQuote.id }, ids.client),
      clientTrips.create({ quoteId: thirdQuote.id }, ids.client),
    ]);
    assert.equal(differentQuoteResults.filter((result) => result.status === 'fulfilled').length, 0, 'existing active client trip should block additional quote creation');
    assert.equal(await prisma.trips.count({ where: { client_id: ids.client, status: 'requested' } }), 1);

    const driverTrips = new DriverTripsService(prisma);
    trace('Checking concurrent driver acceptance.');
    const offeredTrip = await prisma.trips.findUnique({ where: { quote_id: firstQuote.id } });
    const expiresAt = new Date(Date.now() + 60_000);
    await prisma.trip_driver_offers.createMany({ data: ids.drivers.slice(0, 2).map((driverId) => ({ trip_id: offeredTrip.id, driver_id: driverId, status: 'offered', expires_at: expiresAt })) });
    const acceptResults = await Promise.allSettled(ids.drivers.slice(0, 2).map((driverId) => driverTrips.accept(offeredTrip.id, driverId)));
    assert.equal(acceptResults.filter((result) => result.status === 'fulfilled').length, 1, 'only one driver may claim a trip under contention');
    assert.equal(acceptResults.filter((result) => result.status === 'rejected').length, 1);
    const acceptedTrip = await prisma.trips.findUnique({ where: { id: offeredTrip.id } });
    assert.equal(acceptedTrip.status, 'accepted');
    assert(ids.drivers.slice(0, 2).includes(acceptedTrip.driver_id));

    const cancellationRaceTrip = acceptedTrip;
    const cancellationRace = await Promise.allSettled([
      clientTrips.cancel(cancellationRaceTrip.id, ids.client),
      driverTrips.start(cancellationRaceTrip.id, cancellationRaceTrip.driver_id),
    ]);
    assert.equal(cancellationRace.filter((result) => result.status === 'fulfilled').length, 1, 'start and cancel may not both win');
    const cancellationRaceState = await prisma.trips.findUnique({ where: { id: cancellationRaceTrip.id }, select: { status: true } });
    assert(['cancelled', 'ongoing'].includes(cancellationRaceState.status));

    trace('Checking concurrent client cancellation versus driver acceptance.');
    const requestedTrip = await createTrip('requested', 'ride', null, ids.secondClient);
    await prisma.trip_driver_offers.create({ data: { trip_id: requestedTrip.id, driver_id: ids.drivers[2], status: 'offered', expires_at: new Date(Date.now() + 60_000) } });
    const cancelAcceptRace = await Promise.allSettled([
      clientTrips.cancel(requestedTrip.id, ids.secondClient),
      driverTrips.accept(requestedTrip.id, ids.drivers[2]),
    ]);
    assert.equal(cancelAcceptRace.filter((result) => result.status === 'fulfilled').length, 1, 'cancel and accept may not both win');
    const cancelAcceptState = await prisma.trips.findUnique({ where: { id: requestedTrip.id }, select: { status: true, driver_id: true } });
    assert(['cancelled', 'accepted'].includes(cancelAcceptState.status));
    if (cancelAcceptState.status === 'cancelled') assert.equal(cancelAcceptState.driver_id, null);
    else assert.equal(cancelAcceptState.driver_id, ids.drivers[2]);

    trace('Checking the full delivery request, acceptance, start, completion, invoice and payment flow.');
    const deliveryQuote = await createQuote('delivery', serviceConfig.id, ids.deliveryClient);
    const deliveryTrip = await clientTrips.create({ quoteId: deliveryQuote.id }, ids.deliveryClient);
    ids.trips.push(deliveryTrip.id);
    await prisma.trip_driver_offers.create({ data: { trip_id: deliveryTrip.id, driver_id: ids.drivers[3], status: 'offered', expires_at: new Date(Date.now() + 60_000) } });
    await driverTrips.accept(deliveryTrip.id, ids.drivers[3]);
    await driverTrips.start(deliveryTrip.id, ids.drivers[3]);
    const driverPayments = new PaymentsService(prisma);
    const finishResults = await Promise.allSettled([
      driverTrips.finish(deliveryTrip.id, ids.drivers[3]),
      driverTrips.finish(deliveryTrip.id, ids.drivers[3]),
    ]);
    assert.equal(finishResults.filter((result) => result.status === 'fulfilled').length, 2, 'duplicate finish acknowledgement should be idempotent');
    const storedTrip = await prisma.trips.findUnique({ where: { id: deliveryTrip.id } });
    const pendingPayment = await prisma.trip_payments.findUnique({ where: { trip_id: deliveryTrip.id } });
    assert.equal(storedTrip.status, 'completed');
    assert.equal(storedTrip.final_fare.toFixed(2), '1234.50');
    assert.equal(pendingPayment.amount.toFixed(2), storedTrip.final_fare.toFixed(2));
    assert.equal(pendingPayment.status, 'pending', 'trip completion must not imply payment confirmation');
    assert.equal(await prisma.invoices.count({ where: { trip_id: deliveryTrip.id } }), 1);

    trace('Checking concurrent cash confirmation and audit idempotency.');
    const paymentResults = await Promise.allSettled([
      driverPayments.confirmCashPayment(deliveryTrip.id, ids.drivers[3], '1234.50'),
      driverPayments.confirmCashPayment(deliveryTrip.id, ids.drivers[3], '1234.50'),
    ]);
    assert.equal(paymentResults.filter((result) => result.status === 'fulfilled').length, 2, 'duplicate cash confirmation by the same driver should be idempotent');
    const confirmedPayment = await prisma.trip_payments.findUnique({ where: { trip_id: deliveryTrip.id } });
    assert.equal(confirmedPayment.status, 'confirmed');
    assert.equal(confirmedPayment.confirmed_by, ids.drivers[3]);
    assert.equal(confirmedPayment.amount.toFixed(2), '1234.50');
    assert.equal(await prisma.audit_logs.count({ where: { action: 'cash_payment_confirmed', target_id: confirmedPayment.id } }), 1);

    trace('PostgreSQL concurrency verified: immutable quote pricing, quote retry idempotency, one active trip per client, one driver claim, cancel/start and cancel/accept winners, idempotent finish/payment, and one durable invoice/payment.');
  } finally {
    trace('Cleaning seeded PostgreSQL rows.');
    const tripIds = [...new Set(ids.trips)];
    if (tripIds.length) {
      await prisma.trip_driver_offers.deleteMany({ where: { trip_id: { in: tripIds } } }).catch(() => {});
      await prisma.trip_payments.deleteMany({ where: { trip_id: { in: tripIds } } }).catch(() => {});
      await prisma.invoices.deleteMany({ where: { trip_id: { in: tripIds } } }).catch(() => {});
      await prisma.trips.deleteMany({ where: { id: { in: tripIds } } }).catch(() => {});
    }
    if (ids.quotes.length) await prisma.trip_quotes.deleteMany({ where: { id: { in: ids.quotes } } }).catch(() => {});
    if (ids.serviceConfigs.length) await prisma.service_configs.deleteMany({ where: { id: { in: ids.serviceConfigs } } }).catch(() => {});
    await prisma.driver_documents.deleteMany({ where: { driver_id: { in: ids.drivers } } }).catch(() => {});
    await prisma.drivers.deleteMany({ where: { id: { in: ids.drivers } } }).catch(() => {});
    await prisma.profiles.deleteMany({ where: { id: { in: [ids.client, ids.secondClient, ids.deliveryClient, ...ids.drivers] } } }).catch(() => {});
    await prisma.$disconnect();
    trace('Disconnected from isolated PostgreSQL.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
