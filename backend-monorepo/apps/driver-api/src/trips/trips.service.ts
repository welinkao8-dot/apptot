import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

@Injectable()
export class TripsService {
    constructor(private prisma: PrismaService) { }

    async create(createTripDto: CreateTripDto) {
        console.log(`\n[DEBUG-SERVICE] >>> Entrou em TripsService.create`);
        // Validation COMPLETELY REMOVED as per user order. All requests allowed.
        const category = createTripDto.category || 'ride';
        const configId = createTripDto.serviceConfigId || (createTripDto as any).serviceId;

        console.log(`[DEBUG-SERVICE] Dados para criação: category=${category}, configId=${configId}, client=${createTripDto.clientId}`);

        try {
            const result = await this.prisma.trips.create({
                data: {
                    client_id: createTripDto.clientId,
                    origin_address: createTripDto.originAddress,
                    origin_lat: createTripDto.originLat,
                    origin_lng: createTripDto.originLng,
                    dest_address: createTripDto.destAddress,
                    dest_lat: createTripDto.destLat,
                    dest_lng: createTripDto.destLng,
                    estimated_fare: createTripDto.price?.toString() || (createTripDto as any).estimatedFare?.toString(),
                    status: 'requested',
                    service_config_id: configId,
                    category: category,
                    delivery_info: createTripDto.deliveryInfo || null
                },
                include: {
                    profiles_trips_client_idToprofiles: true
                }
            });
            console.log(`[DEBUG-SERVICE] <<< Prisma.trips.create SUCESSO. ID=${result.id}`);
            return result;
        } catch (error) {
            console.error(`[DEBUG-SERVICE] !!! ERROR NO PRISMA.CREATE:`, error);
            throw error;
        }
    }

    async findOne(id: string) {
        return this.prisma.trips.findUnique({
            where: { id },
            include: {
                profiles_trips_client_idToprofiles: true,
                profiles_trips_driver_idToprofiles: true,
                service_configs: true
            }
        });
    }

    async findAllPending() {
        const pending = await this.prisma.trips.findMany({
            where: { status: 'requested' },
            include: {
                profiles_trips_client_idToprofiles: true,
                service_configs: true
            },
            orderBy: { created_at: 'desc' }
        });
        return pending.map(trip => this.formatTrip(trip));
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
                    lat: trip.origin_lat || -8.839,
                    lng: trip.origin_lng || 13.289
                },
                destPos: {
                    lat: trip.dest_lat || -8.839,
                    lng: trip.dest_lng || 13.289
                },
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
        return this.prisma.trips.findFirst({
            where: {
                driver_id: driverId,
                status: { in: ['accepted', 'ongoing'] }
            },
            orderBy: { created_at: 'desc' },
            include: {
                profiles_trips_client_idToprofiles: true,
                profiles_trips_driver_idToprofiles: true,
                service_configs: true
            }
        });
    }

    async findActiveByClient(clientId: string) {
        return this.prisma.trips.findFirst({
            where: {
                client_id: clientId,
                status: { in: ['requested', 'accepted', 'ongoing'] }
            },
            include: { profiles_trips_driver_idToprofiles: true },
            orderBy: { created_at: 'desc' }
        });
    }

    async findAll() {
        return this.prisma.trips.findMany({
            include: {
                profiles_trips_client_idToprofiles: true,
                profiles_trips_driver_idToprofiles: true,
                service_configs: true
            },
            orderBy: { created_at: 'desc' }
        });
    }

    async getHistory(userId: string, role: 'client' | 'driver', limit = 20, status?: string, month?: number, year?: number) {
        const where: any = {};
        if (role === 'client') where.client_id = userId;
        else where.driver_id = userId;

        if (status) where.status = status;

        if (month !== undefined || year !== undefined) {
            const now = new Date();
            const y = year || now.getFullYear();
            const m = month !== undefined ? month - 1 : now.getMonth();
            const start = new Date(y, m, 1);
            const end = new Date(y, m + 1, 0, 23, 59, 59);
            where.created_at = { gte: start, lte: end };
        }

        return this.prisma.trips.findMany({
            where,
            include: {
                profiles_trips_client_idToprofiles: true,
                profiles_trips_driver_idToprofiles: true,
                service_configs: true
            },
            orderBy: { created_at: 'desc' },
            take: limit
        });
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
        const result = await this.prisma.trips.updateMany({
            where: { id: tripId, driver_id: null, status: 'requested' },
            data: { driver_id: driverId, status: 'accepted', accepted_at: new Date() }
        });

        if (result.count === 0) {
            throw new BadRequestException('Trip already accepted by another driver');
        }

        return this.prisma.trips.findUnique({
            where: { id: tripId },
            include: {
                profiles_trips_client_idToprofiles: true,
                profiles_trips_driver_idToprofiles: true
            }
        });
    }

    async cancel(tripId: string) {
        return this.prisma.trips.update({
            where: { id: tripId },
            data: { status: 'cancelled' },
            include: { profiles_trips_driver_idToprofiles: true }
        });
    }

    async start(tripId: string) {
        return this.prisma.trips.update({
            where: { id: tripId },
            data: { status: 'ongoing', started_at: new Date() }
        });
    }

    async finish(tripId: string, finalFare: string) {
        return this.prisma.trips.update({
            where: { id: tripId },
            data: { status: 'completed', final_fare: finalFare, completed_at: new Date() }
        });
    }

    async updateFare(tripId: string, currentFare: number) {
        return this.prisma.trips.update({
            where: { id: tripId },
            data: { final_fare: currentFare.toString() }
        });
    }

    async cancelOrphanTrips(): Promise<Array<{ tripId: string, clientId: string | null }>> {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const orphanTrips = await this.prisma.trips.findMany({
            where: { status: 'requested', created_at: { lt: fiveMinutesAgo } }
        });

        const cancelledIds: Array<{ tripId: string, clientId: string | null }> = [];
        for (const trip of orphanTrips) {
            await this.cancel(trip.id);
            cancelledIds.push({ tripId: trip.id, clientId: trip.client_id });
        }
        return cancelledIds;
    }

    async updateDriverStatus(driverId: string, isOnline: boolean) {
        return this.prisma.drivers.update({
            where: { id: driverId },
            data: { is_online: isOnline }
        });
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
