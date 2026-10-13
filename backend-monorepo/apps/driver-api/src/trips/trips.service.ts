import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { consumeTripQuote, PrismaService } from '@app/database';
import { CreateTripDto } from './dto/create-trip.dto';
import { Prisma } from '@prisma/client';
import { tripTransitionSources } from './trip-state';
import { rankDriversByDistance } from './dispatch';

function sanitizeTrip(trip: any) {
    if (!trip) return trip;
    const {
        profiles_trips_client_idToprofiles,
        profiles_trips_driver_idToprofiles,
        ...safeTrip
    } = trip;
    const sanitizeProfile = (profile: any) => {
        if (!profile) return profile;
        const { password, password_hash, doc_bi_frente, doc_bi_verso, doc_carta_conducao, ...safeProfile } = profile;
        return safeProfile;
    };
    return {
        ...safeTrip,
        profiles_trips_client_idToprofiles: sanitizeProfile(profiles_trips_client_idToprofiles),
        profiles_trips_driver_idToprofiles: sanitizeProfile(profiles_trips_driver_idToprofiles),
    };
}

@Injectable()
export class TripsService {
    constructor(private prisma: PrismaService) { }

    async create(createTripDto: CreateTripDto, clientId: string) {
        return this.prisma.$transaction(async (tx) => {
            const quote = await consumeTripQuote(tx, createTripDto.quoteId, clientId);
            const result = await tx.trips.create({
                data: {
                    client_id: clientId,
                    origin_address: quote.origin_address,
                    origin_lat: quote.origin_lat,
                    origin_lng: quote.origin_lng,
                    dest_address: quote.dest_address,
                    dest_lat: quote.dest_lat,
                    dest_lng: quote.dest_lng,
                    estimated_fare: quote.estimated_fare,
                    status: 'requested',
                    service_config_id: quote.service_config_id,
                    quote_id: quote.id,
                    category: quote.category,
                    delivery_info: (quote.delivery_info ?? undefined) as Prisma.InputJsonValue | undefined,
                },
                include: { profiles_trips_client_idToprofiles: true },
            });
            return sanitizeTrip(result);
        });
    }

    async findOne(id: string) {
        return sanitizeTrip(await this.prisma.trips.findUnique({
            where: { id },
            include: {
                profiles_trips_client_idToprofiles: true,
                profiles_trips_driver_idToprofiles: true,
                service_configs: true,
                trip_quotes: true,
            }
        }));
    }

    async findOneForDriver(id: string, driverId: string) {
        const trip = await this.findOne(id);
        if (!trip) {
            throw new NotFoundException('Viagem não encontrada.');
        }
        if (trip.driver_id !== driverId) {
            throw new ForbiddenException('Sem permissão para aceder a esta viagem.');
        }
        return trip;
    }

    async findAllPending(driverId: string) {
        const pending = await this.prisma.trips.findMany({
            where: { status: 'requested', driver_offers: { some: { driver_id: driverId, status: 'offered', expires_at: { gt: new Date() } } } },
            include: {
                profiles_trips_client_idToprofiles: true,
                service_configs: true,
                trip_quotes: true,
                driver_offers: { where: { driver_id: driverId, status: 'offered', expires_at: { gt: new Date() } }, select: { expires_at: true } },
            },
            orderBy: { created_at: 'desc' }
        });
        return pending.map(trip => this.formatTrip({ ...trip, offerExpiresAt: trip.driver_offers?.[0]?.expires_at ?? null }));
    }

    async findRequestedTripIds() {
        return this.prisma.trips.findMany({ where: { status: 'requested', driver_id: null }, select: { id: true } });
    }

    async dispatchNextBatch(tripId: string, connectedDriverIds: string[], batchSize = 5) {
        return this.prisma.$transaction(async (tx) => {
        await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', tripId);
        const trip = await tx.trips.findFirst({
            where: { id: tripId, status: 'requested', driver_id: null },
            include: { profiles_trips_client_idToprofiles: true, service_configs: true, trip_quotes: true },
        });
        if (!trip || !Number.isFinite(trip.origin_lat) || !Number.isFinite(trip.origin_lng) || connectedDriverIds.length === 0) return [];
        const now = new Date();
        await tx.trip_driver_offers.updateMany({
            where: { trip_id: tripId, status: 'offered', expires_at: { lte: now } },
            data: { status: 'expired', responded_at: now },
        });
        const activeOffer = await tx.trip_driver_offers.findFirst({ where: { trip_id: tripId, status: 'offered', expires_at: { gt: now } } });
        if (activeOffer) return [];
        const [drivers, priorOffers, busyTrips] = await Promise.all([
            tx.drivers.findMany({
                where: { id: { in: connectedDriverIds }, status: 'active', is_online: true, current_lat: { not: null }, current_lng: { not: null }, last_location_update: { gte: new Date(now.getTime() - 120_000) } },
                select: { id: true, current_lat: true, current_lng: true },
            }),
            tx.trip_driver_offers.findMany({ where: { trip_id: tripId }, select: { driver_id: true } }),
            tx.trips.findMany({ where: { driver_id: { in: connectedDriverIds }, status: { in: ['accepted', 'ongoing'] } }, select: { driver_id: true } }),
        ]);
        const alreadyOffered = new Set(priorOffers.map((offer) => offer.driver_id));
        const busy = new Set(busyTrips.map((active) => active.driver_id));
        const eligible = rankDriversByDistance(
            { lat: trip.origin_lat!, lng: trip.origin_lng! },
            drivers.filter((driver) => !alreadyOffered.has(driver.id) && !busy.has(driver.id)).map((driver) => ({ id: driver.id, lat: driver.current_lat, lng: driver.current_lng })),
        ).slice(0, batchSize);
        if (!eligible.length) return [];
        const expiresAt = new Date(now.getTime() + 15_000);
        await tx.trip_driver_offers.createMany({
            data: eligible.map(({ id }) => ({ trip_id: tripId, driver_id: id, status: 'offered', offered_at: now, expires_at: expiresAt })),
            skipDuplicates: true,
        });
        return eligible.map(({ id, distanceKm }) => ({ driverId: id, distanceKm, expiresAt, trip: this.formatTrip(trip) }));
        });
    }

    async declineOffer(tripId: string, driverId: string) {
        const now = new Date();
        const result = await this.prisma.trip_driver_offers.updateMany({
            where: { trip_id: tripId, driver_id: driverId, status: 'offered', expires_at: { gt: now } },
            data: { status: 'rejected', responded_at: now },
        });
        if (result.count !== 1) throw new BadRequestException('Esta oferta já expirou ou não pertence a este motorista.');
        return { success: true };
    }

    public formatTrip(trip: any) {
        try {
            if (!trip) return null;

            const formatted = {
                id: trip.id,
                clientId: trip.client_id || null,
                userName: trip.profiles_trips_client_idToprofiles?.full_name || 'Cliente',
                pickupAddress: trip.origin_address || 'Endereço não especificado',
                destAddress: trip.dest_address || 'Destino não especificado',
                price: trip.estimated_fare || '0',
                status: trip.status || 'requested',
                coords: {
                    lat: trip.origin_lat ?? null,
                    lng: trip.origin_lng ?? null
                },
                destPos: {
                    lat: trip.dest_lat ?? null,
                    lng: trip.dest_lng ?? null
                },
                routeDistanceKm: trip.trip_quotes?.distance_meters != null ? trip.trip_quotes.distance_meters / 1000 : null,
                routeDurationMinutes: trip.trip_quotes?.duration_seconds != null ? Math.ceil(trip.trip_quotes.duration_seconds / 60) : null,
                offerExpiresAt: trip.offerExpiresAt || null,
                current_fare: trip.final_fare || trip.estimated_fare || '0',
                driver_id: trip.driver_id || null,
                driver_name: trip.profiles_trips_driver_idToprofiles?.full_name || 'Motorista',
                service: {
                    name: trip.service_configs?.name || 'Padrão',
                    category: trip.service_configs?.vehicle_category || 'car'
                },
                category: trip.category || 'ride',
                deliveryInfo: trip.delivery_info || null,
                price_per_min: trip.service_configs?.price_per_min || 50,
                price_per_km: trip.service_configs?.price_per_km || 100,
                base_fare: trip.service_configs?.base_fare || 500,
                created_at: trip.created_at,
                accepted_at: trip.accepted_at || null,
                started_at: trip.started_at || null
            };

            return formatted;
        } catch (error) {
            console.error(`❌ [FORMAT_TRIP] ERRO:`, error);
            throw error;
        }
    }

    async findActiveByDriver(driverId: string) {
        return sanitizeTrip(await this.prisma.trips.findFirst({
            where: {
                driver_id: driverId,
                OR: [
                    { status: { in: ['accepted', 'ongoing'] } },
                    { status: 'completed', trip_payment: { is: { status: 'pending' } } },
                ],
            },
            orderBy: { created_at: 'desc' },
            include: {
                profiles_trips_client_idToprofiles: true,
                profiles_trips_driver_idToprofiles: true,
                service_configs: true,
                trip_quotes: true,
            }
        }));
    }

    async findActiveByClient(clientId: string) {
        return sanitizeTrip(await this.prisma.trips.findFirst({
            where: {
                client_id: clientId,
                OR: [
                    { status: { in: ['requested', 'accepted', 'ongoing'] } },
                    { status: 'completed', trip_payment: { is: { status: 'pending' } } },
                ],
            },
            include: { profiles_trips_driver_idToprofiles: true, trip_quotes: true },
            orderBy: { created_at: 'desc' }
        }));
    }

    async findAll() {
        const trips = await this.prisma.trips.findMany({
            include: {
                profiles_trips_client_idToprofiles: true,
                profiles_trips_driver_idToprofiles: true,
                service_configs: true
                ,trip_quotes: true
            },
            orderBy: { created_at: 'desc' }
        });
        return trips.map(sanitizeTrip);
    }

    async findAllForDriver(driverId: string) {
        const trips = await this.prisma.trips.findMany({
            where: { driver_id: driverId },
            include: {
                profiles_trips_client_idToprofiles: true,
                profiles_trips_driver_idToprofiles: true,
                service_configs: true
            },
            orderBy: { created_at: 'desc' }
        });
        return trips.map(sanitizeTrip);
    }

    async getHistory(userId: string, role: 'client' | 'driver', limit = 20, status?: string, month?: number, year?: number) {
        const where: any = {};
        if (role === 'client') where.client_id = userId;
        else where.driver_id = userId;

        if (status && status !== 'all') where.status = status;

        if (month !== undefined || year !== undefined) {
            const now = new Date();
            const y = year || now.getFullYear();
            const m = month !== undefined ? month - 1 : now.getMonth();
            const start = new Date(y, m, 1);
            const end = new Date(y, m + 1, 0, 23, 59, 59);
            where.created_at = { gte: start, lte: end };
        }

        const trips = await this.prisma.trips.findMany({
            where,
            include: {
                profiles_trips_client_idToprofiles: true,
                profiles_trips_driver_idToprofiles: true,
                service_configs: true
            },
            orderBy: { created_at: 'desc' },
            take: limit
        });
        return trips.map(sanitizeTrip);
    }

    async getMonthlyStats(userId: string, role: 'client' | 'driver') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const where: any = {
            created_at: { gte: startOfMonth },
            status: 'completed'
        };
        if (role === 'client') where.client_id = userId;
        else where.driver_id = userId;

        const trips = await this.prisma.trips.findMany({ where });
        const totalFare = trips.reduce((acc, trip) => acc + Number(trip.final_fare || 0), 0);

        return {
            count: trips.length,
            totalFare
        };
    }

    async getDailyStats(userId: string) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const trips = await this.prisma.trips.findMany({
            where: {
                driver_id: userId,
                created_at: { gte: startOfDay },
                status: 'completed'
            }
        });

        const totalFare = trips.reduce((acc, trip) => acc + Number(trip.final_fare || 0), 0);

        return {
            count: trips.length,
            totalFare
        };
    }

    async accept(tripId: string, driverId: string) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const now = new Date();
                const offer = await tx.trip_driver_offers.updateMany({
                    where: { trip_id: tripId, driver_id: driverId, status: 'offered', expires_at: { gt: now } },
                    data: { status: 'accepted', responded_at: now },
                });
                if (offer.count !== 1) throw new BadRequestException('Esta oferta expirou ou não pertence a este motorista.');
                const result = await tx.trips.updateMany({
                    where: { id: tripId, driver_id: null, status: { in: tripTransitionSources('accepted') } },
                    data: { driver_id: driverId, status: 'accepted', accepted_at: now }
                });
                if (result.count !== 1) throw new BadRequestException('Trip already accepted by another driver');
                await tx.trip_driver_offers.updateMany({ where: { trip_id: tripId, status: 'offered' }, data: { status: 'cancelled', responded_at: now } });
                return sanitizeTrip(await tx.trips.findUnique({
                    where: { id: tripId },
                    include: { profiles_trips_client_idToprofiles: true, profiles_trips_driver_idToprofiles: true },
                }));
            });
        } catch (error) {
            await this.prisma.trip_driver_offers.updateMany({
                where: { trip_id: tripId, driver_id: driverId, status: 'offered', expires_at: { gt: new Date() } },
                data: { status: 'rejected', responded_at: new Date() },
            });
            throw error;
        }
    }

    async cancel(tripId: string, actor: { role: 'client' | 'driver'; id: string }) {
        const ownership = actor.role === 'client' ? { client_id: actor.id } : { driver_id: actor.id };
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.trips.updateMany({
                where: { id: tripId, ...ownership, status: { in: tripTransitionSources('cancelled') } },
                data: { status: 'cancelled' },
            });
            if (result.count !== 1) throw new BadRequestException('A viagem não pode ser cancelada neste estado.');
            await tx.trip_driver_offers.updateMany({ where: { trip_id: tripId, status: { in: ['offered', 'accepted'] } }, data: { status: 'cancelled', responded_at: new Date() } });
            return sanitizeTrip(await tx.trips.findUnique({
                where: { id: tripId },
                include: { profiles_trips_driver_idToprofiles: true },
            }));
        });
    }

    async start(tripId: string, driverId: string) {
        const result = await this.prisma.trips.updateMany({
            where: { id: tripId, driver_id: driverId, status: { in: tripTransitionSources('ongoing') } },
            data: { status: 'ongoing', started_at: new Date() },
        });
        if (result.count !== 1) throw new BadRequestException('A viagem não pode ser iniciada neste estado.');
        return this.prisma.trips.findUnique({ where: { id: tripId } });
    }

    async finish(tripId: string, driverId: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.trips.updateMany({
                where: { id: tripId, driver_id: driverId, status: { in: tripTransitionSources('completed') } },
                data: { status: 'completed', payment_method: 'cash', completed_at: new Date() },
            });
            if (result.count !== 1) throw new BadRequestException('A viagem não pode ser concluída neste estado.');
            const trip = await tx.trips.findUnique({ where: { id: tripId } });
            if (!trip) throw new NotFoundException('Viagem não encontrada.');
            const finalFare = trip.estimated_fare;
            if (!finalFare || new Prisma.Decimal(finalFare).lte(0)) throw new BadRequestException('A viagem não possui uma tarifa confirmada.');
            // The final amount is the persisted server quote; a driver payload cannot change it.
            await tx.trips.update({ where: { id: tripId }, data: { final_fare: finalFare } });
            trip.final_fare = finalFare;

            const existingInvoice = await tx.invoices.findFirst({ where: { trip_id: tripId } });
            if (!existingInvoice) {
                await tx.invoices.create({
                    data: {
                        trip_id: tripId,
                        user_id: trip.client_id,
                        amount: trip.final_fare || trip.estimated_fare || 0,
                        invoice_type: trip.category === 'delivery' ? 'delivery_receipt' : 'ride_receipt'
                    }
                });
            }

            await tx.trip_payments.create({
                data: {
                    trip_id: tripId,
                    method: 'cash',
                    amount: finalFare,
                    status: 'pending',
                },
            });

            return trip;
        });
    }

    async cancelOrphanTrips(): Promise<Array<{ tripId: string, clientId: string | null }>> {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const orphanTrips = await this.prisma.trips.findMany({
            where: { status: 'requested', created_at: { lt: fiveMinutesAgo } }
        });

        const cancelledIds: Array<{ tripId: string, clientId: string | null }> = [];
        for (const trip of orphanTrips) {
            const result = await this.prisma.trips.updateMany({
                where: { id: trip.id, status: 'requested', created_at: { lt: fiveMinutesAgo } },
                data: { status: 'cancelled' },
            });
            if (result.count === 1) cancelledIds.push({ tripId: trip.id, clientId: trip.client_id });
            if (result.count === 1) {
                await this.prisma.trip_driver_offers.updateMany({ where: { trip_id: trip.id, status: { in: ['offered', 'accepted'] } }, data: { status: 'cancelled', responded_at: new Date() } });
            }
        }
        return cancelledIds;
    }

    async updateDriverStatus(driverId: string, isOnline: boolean) {
        const result = await this.prisma.drivers.updateMany({
            where: { id: driverId, status: 'active' },
            data: { is_online: isOnline }
        });
        if (result.count === 0) {
            throw new ForbiddenException('Apenas motoristas ativos podem alterar a disponibilidade.');
        }
        return result;
    }

    async getDriverStatus(driverId: string) {
        const d = await this.prisma.drivers.findUnique({ where: { id: driverId } });
        return d?.is_online || false;
    }

    async updateDriverLocation(driverId: string, lat: number, lng: number) {
        return this.prisma.drivers.update({
            where: { id: driverId },
            data: { current_lat: lat, current_lng: lng, last_location_update: new Date() }
        });
    }

    async createInvoice(tripId: string) {
        const trip = await this.findOne(tripId);
        if (!trip) throw new BadRequestException('Trip not found');
        const existing = await this.prisma.invoices.findFirst({ where: { trip_id: tripId } });
        if (existing) return existing;

        return this.prisma.invoices.create({
            data: {
                trip_id: tripId,
                user_id: trip.client_id,
                amount: trip.final_fare || trip.estimated_fare || 0,
                invoice_type: 'ride_receipt'
            }
        });
    }
}
