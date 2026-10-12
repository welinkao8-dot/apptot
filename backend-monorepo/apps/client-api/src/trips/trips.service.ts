import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateTripDto } from './dto/create-trip.dto';
import axios from 'axios';

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

    async create(createTripDto: CreateTripDto, userId: string) {
        // Validation COMPLETELY REMOVED as per user order.

        // 2. Create new
        const trip = await this.prisma.trips.create({
            data: {
                client_id: userId,
                origin_address: createTripDto.originAddress,
                dest_address: createTripDto.destAddress,
                estimated_fare: createTripDto.price,
                status: 'requested',
                origin_lat: createTripDto.originLat,
                origin_lng: createTripDto.originLng,
                dest_lat: createTripDto.destLat,
                dest_lng: createTripDto.destLng,
                service_config_id: createTripDto.serviceConfigId,
                category: createTripDto.category || 'ride',
                delivery_info: createTripDto.deliveryInfo || null
            },
        });

        return trip;
    }

    async getHistory(userId: string, limit: number = 20, status?: string, month?: number, year?: number, category?: string) {
        try {
            let where: any = { client_id: userId };

            if (status && status !== 'all') {
                where.status = status;
            } else {
                where.status = { in: ['completed', 'cancelled'] };
            }

            if (category) {
                where.category = category;
            }

            if (month !== undefined && year !== undefined) {
                const startDate = new Date(year, month, 1);
                const endDate = new Date(year, month + 1, 0, 23, 59, 59);
                where.created_at = {
                    gte: startDate,
                    lte: endDate
                };
            }

            const trips = await this.prisma.trips.findMany({
                where,
                orderBy: { created_at: 'desc' },
                take: limit,
                include: {
                    profiles_trips_driver_idToprofiles: true,
                    invoices: true
                }
            });

            return trips.map(sanitizeTrip);
        } catch (error) {
            console.error(`❌ [HISTORY_ERROR] User: ${userId}`, error);
            throw error;
        }
    }

    async getMonthlyStats(userId: string) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const trips = await this.prisma.trips.findMany({
            where: {
                client_id: userId,
                status: 'completed',
                created_at: { gte: startOfMonth }
            },
            select: { final_fare: true }
        });

        const totalSpent = trips.reduce((sum, trip) => {
            return sum + (trip.final_fare ? parseFloat(trip.final_fare.toString()) : 0);
        }, 0);

        return {
            count: trips.length,
            total: totalSpent
        };
    }

    async findActive(userId: string) {
        const trips = await this.prisma.trips.findMany({
            where: {
                client_id: userId,
                OR: [
                    { status: { in: ['requested', 'accepted', 'ongoing'] } },
                    {
                        status: 'completed',
                        invoices: { none: {} }
                    }
                ]
            },
            orderBy: { created_at: 'desc' },
            include: {
                profiles_trips_driver_idToprofiles: true,
                invoices: true
            }
        });
        return trips.map(sanitizeTrip);
    }

    async findOne(id: string) {
        return sanitizeTrip(await this.prisma.trips.findUnique({
            where: { id },
            include: {
                profiles_trips_driver_idToprofiles: true,
                invoices: true
            }
        }));
    }

    async findOneForClient(id: string, clientId: string) {
        const trip = await this.findOne(id);
        if (!trip) {
            throw new NotFoundException('Viagem não encontrada.');
        }
        if (trip.client_id !== clientId) {
            throw new ForbiddenException('Sem permissão para aceder a esta viagem.');
        }
        return trip;
    }

    async cancel(tripId: string, userId: string) {
        const result = await this.prisma.trips.updateMany({
            where: { id: tripId, client_id: userId },
            data: { status: 'cancelled' }
        });
        if (result.count === 0) {
            throw new ForbiddenException('Sem permissão para cancelar esta viagem.');
        }
        return result;
    }
}
