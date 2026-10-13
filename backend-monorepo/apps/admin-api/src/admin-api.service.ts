import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { AdminGateway } from './admin-api.gateway';
import { ConfigService } from '@nestjs/config';
import { requireInternalServiceToken } from '@app/auth';

function publicDriver(driver: any) {
  if (!driver) return driver;
  const { password, password_hash, doc_bi_frente, doc_bi_verso, doc_carta_conducao, ...safeDriver } = driver;
  return safeDriver;
}

function publicProfile(profile: any) {
  if (!profile) return profile;
  const { password, password_hash, doc_bi_frente, doc_bi_verso, doc_carta_conducao, ...safeProfile } = profile;
  return safeProfile;
}

const SERVICE_ROUTING_MODES = new Set(['car', 'scooter', 'truck']);

function assertServiceRoutingMode(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !SERVICE_ROUTING_MODES.has(value)) {
    throw new BadRequestException('routing_mode deve ser car, scooter ou truck.');
  }
}

@Injectable()
export class AdminApiService {
  constructor(
    private prisma: PrismaService,
    private adminGateway: AdminGateway,
    private readonly config: ConfigService,
  ) { }

  getHello(): string {
    return 'TOT Admin API';
  }

  async getPendingDrivers() {
    const drivers = await this.prisma.drivers.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'desc' }
    });
    return (drivers || []).map(publicDriver);
  }

  async getAllDrivers() {
    const drivers = await this.prisma.drivers.findMany({
      orderBy: { created_at: 'desc' }
    });
    return (drivers || []).map(publicDriver);
  }

  async getDriverById(id: string) {
    return publicDriver(await this.prisma.drivers.findUnique({
      where: { id: id as any }
    }));
  }

  async getTripById(id: string) {
    return this.prisma.trips.findUnique({
      where: { id },
      include: {
        profiles_trips_client_idToprofiles: {
          select: { full_name: true, phone: true, email: true, avatar_url: true }
        },
        profiles_trips_driver_idToprofiles: {
          select: { full_name: true, phone: true, email: true }
        },
        service_configs: {
          select: { name: true, vehicle_category: true, service_type: true }
        },
        invoices: true
      }
    });
  }

  async getAllInvoices() {
    return this.prisma.invoices.findMany({
      include: {
        trips: {
          select: {
            id: true,
            origin_address: true,
            dest_address: true,
            status: true,
            created_at: true
          }
        },
        profiles: {
          select: { full_name: true, phone: true, email: true, role: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async getAllPayments() {
    return this.prisma.trip_payments.findMany({
      include: {
        trips: {
          select: {
            id: true,
            category: true,
            status: true,
            final_fare: true,
            created_at: true,
            profiles_trips_client_idToprofiles: { select: { id: true, full_name: true, phone: true } },
            profiles_trips_driver_idToprofiles: { select: { id: true, full_name: true, phone: true } },
          },
        },
        profiles: { select: { id: true, full_name: true, role: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getInvoicesByUser(userId: string) {
    return this.prisma.invoices.findMany({
      where: { user_id: userId },
      include: {
        trips: {
          select: {
            id: true,
            origin_address: true,
            dest_address: true,
            status: true,
            created_at: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async getAppSettings() {
    // Return global platform parameters derived from current state
    const [totalDrivers, activeDrivers, totalClients, totalTrips] = await Promise.all([
      this.prisma.drivers.count(),
      this.prisma.drivers.count({ where: { status: 'active' } }),
      this.prisma.profiles.count({ where: { role: 'client' } }),
      this.prisma.trips.count()
    ]);
    return {
      platform_name: 'TOT Angola',
      platform_version: '1.0.0',
      max_driver_radius_km: 10,
      trip_timeout_minutes: 5,
      default_commission_pct: 15,
      currency: 'AOA',
      currency_symbol: 'Kz',
      country: 'Angola',
      support_phone: '+244 900 000 000',
      support_email: 'suporte@tot.ao',
      stats: { totalDrivers, activeDrivers, totalClients, totalTrips }
    };
  }

  async getAllClients() {
    const clients = await this.prisma.profiles.findMany({
      where: { role: 'client' },
      include: {
        _count: {
          select: {
            trips_trips_client_idToprofiles: {
              where: { trip_payment: { is: { status: 'confirmed' } } }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return clients.map(c => ({
      ...publicProfile(c),
      paidTripsCount: (c as any)._count?.trips_trips_client_idToprofiles || 0
    }));
  }

  async approveDriver(id: string) {
    // Approve both in drivers and profiles
    await this.prisma.drivers.update({
      where: { id: id as any },
      data: { status: 'active' },
    });

    return publicProfile(await this.prisma.profiles.update({
      where: { id },
      data: { status: 'active' },
    }));
  }

  async updateDriverStatus(id: string, status: string) {
    const internalServiceToken = (status === 'suspended' || status === 'active')
      ? requireInternalServiceToken(this.config)
      : undefined;
    const driverApiUrl = this.config.get<string>('DRIVER_API_URL')
      || (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3004');
    if ((status === 'suspended' || status === 'active') && !driverApiUrl) {
      throw new Error('DRIVER_API_URL must be configured in production.');
    }

    // Update both drivers and profiles tables to keep them in sync
    await this.prisma.drivers.update({
      where: { id: id as any },
      data: {
        status,
        // If suspending, force driver offline
        ...(status === 'suspended' && { is_online: false })
      },
    });

    try {
      await this.prisma.profiles.update({
        where: { id },
        data: { status },
      });
    } catch (e) {
      console.error('Profile not found for driver:', id);
    }

    // LOG
    await this.createAuditLog(null, `UPDATE_STATUS_${status.toUpperCase()}`, 'driver', id);

    // REAL-TIME BROADCAST TO ADMINS
    this.adminGateway.sendToAdmins('driver_status_updated', { id, status });

    // CRITICAL: Notify driver in real-time via Driver API
    // Make HTTP call to Driver API endpoint that triggers WebSocket emission
    if (status === 'suspended' || status === 'active') {
      try {
        const axios = require('axios');
        await axios.post(
          `${driverApiUrl}/notify-driver-status`,
          { driverId: id, status },
          { headers: { 'x-internal-service-token': internalServiceToken } },
        );
      } catch (error) {
        console.error('Failed to notify driver status');
      }
    }

    return { success: true };
  }

  async updateClientStatus(id: string, status: string) {
    await this.prisma.profiles.update({
      where: { id },
      data: { status },
    });

    await this.createAuditLog(null, `UPDATE_CLIENT_STATUS_${status.toUpperCase()}`, 'client', id);

    return { success: true };
  }

  async getServiceConfigs() {
    const configs = await this.prisma.service_configs.findMany({
      orderBy: { id: 'asc' }
    });
    return configs || [];
  }

  async createServiceConfig(data: any) {
    const createData = { ...data, routing_mode: data.routing_mode ?? 'car' };
    assertServiceRoutingMode(createData.routing_mode);
    const created = await this.prisma.service_configs.create({
      data: createData,
    });

    // LOG
    await this.createAuditLog(null, 'CREATE_SERVICE', 'service_config', created.id.toString(), createData);

    // REAL-TIME BROADCAST
    this.adminGateway.sendToAdmins('pricing_updated', created);

    return created;
  }

  async updateServiceConfig(id: number, data: any) {
    // Basic validation / cleaning of data if needed
    const { id: _, trips, updated_at, ...cleanData } = data;
    if (cleanData.routing_mode !== undefined) assertServiceRoutingMode(cleanData.routing_mode);

    const updated = await this.prisma.service_configs.update({
      where: { id: Number(id) },
      data: cleanData,
    });

    // LOG
    await this.createAuditLog(null, 'UPDATE_PRICING', 'service_config', id.toString(), cleanData);

    // REAL-TIME BROADCAST
    this.adminGateway.sendToAdmins('pricing_updated', updated);

    return updated;
  }

  async deleteServiceConfig(id: number) {
    // Check if there are trips associated with this config
    const tripCount = await this.prisma.trips.count({
      where: { service_config_id: id }
    });

    if (tripCount > 0) {
      throw new Error('Não é possível excluir um serviço que já possui viagens registradas.');
    }

    await this.prisma.service_configs.delete({
      where: { id }
    });

    // LOG
    await this.createAuditLog(null, 'DELETE_SERVICE', 'service_config', id.toString());

    return { success: true };
  }

  async getDashboardStats() {
    const totalTrips = await this.prisma.trips.count();
    const completedTrips = await this.prisma.trips.count({
      where: { status: 'completed' },
    });

    const activeTrips = await this.prisma.trips.count({
      where: { status: { in: ['requested', 'accepted', 'arrived', 'ongoing'] } },
    });

    const totalDrivers = await this.prisma.drivers.count();
    const onlineDrivers = await this.prisma.drivers.count({
      where: { is_online: true },
    });

    const totalClients = await this.prisma.profiles.count({
      where: { role: 'client' }
    });

    // Revenue means cash persisted as collected, not merely a completed trip or issued invoice.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const [revenueData, todayRevenueData, monthlyRevenueData] = await Promise.all([
      this.prisma.trip_payments.aggregate({ where: { status: 'confirmed' }, _sum: { amount: true } }),
      this.prisma.trip_payments.aggregate({ where: { status: 'confirmed', confirmed_at: { gte: today } }, _sum: { amount: true } }),
      this.prisma.trip_payments.aggregate({ where: { status: 'confirmed', confirmed_at: { gte: startOfMonth } }, _sum: { amount: true } }),
    ]);

    // Count Today's Trips (all created today)
    const todayTrips = await this.prisma.trips.count({
      where: {
        created_at: { gte: today },
      },
    });

    // Count Total Deliveries (all-time delivery trips)
    const totalDeliveries = await this.prisma.trips.count({
      where: {
        category: 'delivery',
      },
    });

    const result = {
      totalTrips,
      completedTrips,
      activeTrips,
      totalDrivers,
      onlineDrivers,
      totalClients,
      totalRevenue: Number(revenueData._sum.amount || 0),
      todayRevenue: Number(todayRevenueData._sum.amount || 0),
      monthlyRevenue: Number(monthlyRevenueData._sum.amount || 0),
      todayTrips,
      totalDeliveries,
    };

    return result;
  }

  async getAllTrips() {
    const trips = await this.prisma.trips.findMany({
      include: {
        profiles_trips_client_idToprofiles: {
          select: { full_name: true, phone: true }
        },
        profiles_trips_driver_idToprofiles: {
          select: { full_name: true, phone: true }
        },
        trip_payment: true,
        invoices: true,
      },
      orderBy: { created_at: 'desc' }
    });
    return trips || [];
  }

  async getOnlineDriversLocations() {
    return this.prisma.drivers.findMany({
      where: { is_online: true },
      select: {
        id: true,
        full_name: true,
        phone: true,
        status: true,
        current_lat: true,
        current_lng: true,
        last_location_update: true,
        rating: true
      }
    });
  }

  async createAuditLog(adminId: string | null, action: string, target: string, targetId?: string, details?: any) {
    return this.prisma.audit_logs.create({
      data: {
        admin_id: adminId,
        action,
        target,
        target_id: targetId,
        details: details || {}
      }
    });
  }

  async getAuditLogs() {
    return this.prisma.audit_logs.findMany({
      include: {
        profiles: {
          select: { full_name: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 100
    });
  }

  async getAnalytics() {
    const today = new Date();
    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      last7Days.push(d.toISOString().split('T')[0]);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Daily revenue and categories count only persisted, confirmed payment records.
    const payments = await this.prisma.trip_payments.findMany({
      where: {
        status: 'confirmed',
        confirmed_at: { gte: sevenDaysAgo }
      },
      select: {
        amount: true,
        confirmed_at: true,
        trips: { select: { category: true } },
      }
    });

    // Process daily revenue
    const dailyRevenue = last7Days.map(date => {
      const dayTotal = payments
        .filter(payment => payment.confirmed_at && payment.confirmed_at.toISOString().split('T')[0] === date)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      return { date, revenue: dayTotal };
    });

    // Category distribution - Corrected to use 'category' field and PT labels
    const categories: { [key: string]: number } = {};
    payments.forEach(payment => {
      const catVal = payment.trips?.category || 'ride';
      const label = catVal === 'delivery' ? 'Entregas' : 'Corridas';
      categories[label] = (categories[label] || 0) + 1;
    });

    const categoryStats = Object.keys(categories).map(name => ({
      name,
      value: categories[name]
    }));

    return {
      dailyRevenue,
      categoryStats
    };
  }
}
