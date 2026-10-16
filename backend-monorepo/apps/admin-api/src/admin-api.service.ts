import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { AdminGateway } from './admin-api.gateway';
import { ConfigService } from '@nestjs/config';
import { requireInternalServiceToken } from '@app/auth';
import { assertCompatibleServiceRouting } from './service-routing';
import { cleanupServiceImageIfUnreferenced } from './service-image-cleanup';

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
const SENSITIVE_AUDIT_DETAIL_KEY = /(password|secret|token|credential|authorization|cookie|document|^doc_|latitude|longitude|coordinate|location|phone|email|address|(^|_)(lat|lng)(_|$))/i;

function sanitizeAuditDetails(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (/^data:image\//i.test(value)) return '[redacted]';
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (depth >= 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeAuditDetails(item, depth + 1));
  if (!value || typeof value !== 'object') return undefined;

  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .slice(0, 50)
    .filter(([key]) => !SENSITIVE_AUDIT_DETAIL_KEY.test(key))
    .map(([key, item]) => [key, sanitizeAuditDetails(item, depth + 1)]));
}

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

  async getAllDrivers(page = 1, limit = 20, status = 'all', search = '') {
    const where: any = {};
    if (status !== 'all') where.status = status;
    if (search) where.OR = [
      { full_name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
    const [drivers, total] = await Promise.all([
      this.prisma.drivers.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] }),
      this.prisma.drivers.count({ where }),
    ]);
    return { items: (drivers || []).map(publicDriver), total, page, pageSize: limit };
  }

  async getClientTrips(clientId: string, page = 1, limit = 20) {
    const where = { client_id: clientId };
    const [items, total, spend] = await Promise.all([
      this.prisma.trips.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        include: {
          profiles_trips_driver_idToprofiles: { select: { full_name: true, phone: true } },
          trip_payment: true,
          invoices: true,
        },
      }),
      this.prisma.trips.count({ where }),
      this.prisma.trip_payments.aggregate({
        where: { status: 'confirmed', trips: { is: { client_id: clientId } } },
        _sum: { amount: true },
      }),
    ]);
    return {
      items: items || [], total, page, pageSize: limit,
      summary: { confirmedSpend: Number(spend._sum.amount || 0) },
    };
  }

  async getDriverTrips(driverId: string, page = 1, limit = 20) {
    const where = { driver_id: driverId };
    const [items, total, earnings] = await Promise.all([
      this.prisma.trips.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        include: {
          profiles_trips_client_idToprofiles: { select: { full_name: true, phone: true } },
          trip_payment: true,
          invoices: true,
        },
      }),
      this.prisma.trips.count({ where }),
      this.prisma.trips.aggregate({ where: { driver_id: driverId, status: 'completed' }, _sum: { final_fare: true } }),
    ]);
    return {
      items: items || [], total, page, pageSize: limit,
      summary: { completedEarnings: Number(earnings._sum.final_fare || 0) },
    };
  }

  async getDriverById(id: string) {
    return publicDriver(await this.prisma.drivers.findUnique({
      where: { id: id as any }
    }));
  }

  async getDriverDocuments(id: string) {
    const driver = await this.prisma.drivers.findUnique({
      where: { id: id as any },
      select: { id: true, doc_bi_frente: true, doc_bi_verso: true, doc_carta_conducao: true },
    });
    if (!driver) throw new NotFoundException('Motorista não encontrado.');
    return driver;
  }

  async updateDriverVehicleCategory(id: string, vehicleCategory: 'car' | 'moto' | 'truck', adminId: string | null = null) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT id FROM drivers WHERE id = $1::uuid FOR UPDATE', id);
      const activeTrips = await tx.trips.count({ where: { driver_id: id, status: { in: ['accepted', 'ongoing'] } } });
      if (activeTrips > 0) throw new ConflictException('Não é possível alterar o veículo durante uma corrida ativa.');
      const driver = await tx.drivers.update({
        where: { id: id as any },
        data: { vehicle_category: vehicleCategory, is_online: false },
      });
      await tx.audit_logs.create({ data: {
        admin_id: adminId,
        action: 'UPDATE_DRIVER_VEHICLE_CATEGORY',
        target: 'driver',
        target_id: id,
        details: { vehicle_category: vehicleCategory, forced_offline: true },
      } });
      return publicDriver(driver);
    });
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

  async getAllInvoices(page = 1, pageSize = 20, type = 'all', search = '') {
    const where: any = {};
    if (type !== 'all') where.invoice_type = type;
    if (search) where.OR = [
      { id: { contains: search, mode: 'insensitive' } },
      { profiles: { is: { full_name: { contains: search, mode: 'insensitive' } } } },
    ];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [items, total, receiptTotal, monthlyReceiptCount, typeRows] = await Promise.all([
      this.prisma.invoices.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
      include: {
        trips: {
          select: {
            id: true,
            origin_address: true,
            dest_address: true,
            status: true,
            created_at: true,
            trip_payment: { select: { method: true, amount: true, status: true, confirmed_at: true } },
          }
        },
        profiles: {
          select: { full_name: true, phone: true, email: true, role: true }
        }
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.invoices.count({ where }),
      this.prisma.invoices.aggregate({ _sum: { amount: true } }),
      this.prisma.invoices.count({ where: { created_at: { gte: monthStart } } }),
      this.prisma.invoices.findMany({ distinct: ['invoice_type'], select: { invoice_type: true } }),
    ]);
    return {
      items: items || [], total, page, pageSize,
      summary: {
        receiptTotal: Number(receiptTotal._sum.amount || 0),
        monthlyReceiptCount,
        invoiceTypes: typeRows.map(row => row.invoice_type).filter((value): value is string => Boolean(value)),
      },
    };
  }

  async getAllPayments(page = 1, pageSize = 20, status = 'all', search = '') {
    const where: any = {};
    if (status !== 'all') where.status = status;
    if (search) where.OR = [
      { trip_id: { contains: search, mode: 'insensitive' } },
      { trips: { is: { profiles_trips_client_idToprofiles: { is: { full_name: { contains: search, mode: 'insensitive' } } } } } },
      { trips: { is: { profiles_trips_driver_idToprofiles: { is: { full_name: { contains: search, mode: 'insensitive' } } } } } },
      { profiles: { is: { full_name: { contains: search, mode: 'insensitive' } } } },
    ];
    const [items, total, pendingCount, confirmedCount, confirmedCash, pendingCash] = await Promise.all([
      this.prisma.trip_payments.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
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
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.trip_payments.count({ where }),
      this.prisma.trip_payments.count({ where: { status: 'pending' } }),
      this.prisma.trip_payments.count({ where: { status: 'confirmed' } }),
      this.prisma.trip_payments.aggregate({ where: { status: 'confirmed', method: 'cash' }, _sum: { amount: true } }),
      this.prisma.trip_payments.aggregate({ where: { status: 'pending', method: 'cash' }, _sum: { amount: true } }),
    ]);
    return {
      items: items || [], total, page, pageSize,
      summary: {
        pendingCount, confirmedCount,
        confirmedCashTotal: Number(confirmedCash._sum.amount || 0),
        cashPendingTotal: Number(pendingCash._sum.amount || 0),
      },
    };
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
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }]
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
    return { stats: { totalDrivers, activeDrivers, totalClients, totalTrips } };
  }

  async getAllClients(page = 1, limit = 20, search = '') {
    const where: any = { role: 'client' };
    if (search) where.OR = [
      { full_name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
    const [clients, total] = await Promise.all([this.prisma.profiles.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: {
            trips_trips_client_idToprofiles: {
              where: { trip_payment: { is: { status: 'confirmed' } } }
            }
          }
        }
      },
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }]
    }), this.prisma.profiles.count({ where })]);

    const items = clients.map(c => ({
      ...publicProfile(c),
      paidTripsCount: (c as any)._count?.trips_trips_client_idToprofiles || 0
    }));
    return { items, total, page, pageSize: limit };
  }

  async approveDriver(id: string, adminId: string | null = null) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT id FROM drivers WHERE id = $1::uuid FOR UPDATE', id);
      await tx.drivers.update({
        where: { id: id as any },
        data: { status: 'active' },
      });

      const approvedProfile = await tx.profiles.update({
        where: { id },
        data: { status: 'active' },
      });
      await tx.audit_logs.create({
        data: {
          admin_id: adminId,
          action: 'APPROVE_DRIVER',
          target: 'driver',
          target_id: id,
          details: {},
        },
      });

      return publicProfile(approvedProfile);
    });
  }

  async updateDriverStatus(id: string, status: string, adminId: string | null = null, reason?: string) {
    const internalServiceToken = (status === 'suspended' || status === 'active')
      ? requireInternalServiceToken(this.config)
      : undefined;
    const driverApiUrl = this.config.get<string>('DRIVER_API_URL')
      || (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3004');
    if ((status === 'suspended' || status === 'active') && !driverApiUrl) {
      throw new Error('DRIVER_API_URL must be configured in production.');
    }

    await this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT id FROM drivers WHERE id = $1::uuid FOR UPDATE', id);
      await tx.drivers.update({
        where: { id: id as any },
        data: {
          status,
          // If suspending, force driver offline
          ...(status === 'suspended' && { is_online: false })
        },
      });

      await tx.profiles.update({
        where: { id },
        data: { status },
      });

      await tx.audit_logs.create({
        data: {
          admin_id: adminId,
          action: `UPDATE_STATUS_${status.toUpperCase()}`,
          target: 'driver',
          target_id: id,
          details: reason ? { reason } : {},
        },
      });
    });

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

  async updateClientStatus(id: string, status: string, adminId: string | null = null, reason?: string) {
    await this.prisma.$transaction(async tx => {
      await tx.profiles.update({
        where: { id },
        data: { status },
      });

      await tx.audit_logs.create({
        data: {
          admin_id: adminId,
          action: `UPDATE_CLIENT_STATUS_${status.toUpperCase()}`,
          target: 'client',
          target_id: id,
          details: reason ? { reason } : {},
        },
      });
    });

    return { success: true };
  }

  async getServiceConfigs() {
    const configs = await this.prisma.service_configs.findMany({
      orderBy: { id: 'asc' }
    });
    return configs || [];
  }

  async createServiceConfig(data: any, adminId: string | null = null) {
    const createData = { ...data, routing_mode: data.routing_mode ?? 'car' };
    assertServiceRoutingMode(createData.routing_mode);
    assertCompatibleServiceRouting(createData.vehicle_category, createData.routing_mode);
    const created = await this.prisma.service_configs.create({
      data: createData,
    });

    // LOG
    await this.createAuditLog(adminId, 'CREATE_SERVICE', 'service_config', created.id.toString(), createData);

    // REAL-TIME BROADCAST
    this.adminGateway.sendToAdmins('pricing_updated', created);

    return created;
  }

  async updateServiceConfig(id: number, data: any, adminId: string | null = null) {
    // Basic validation / cleaning of data if needed
    const { id: _, trips, updated_at, ...cleanData } = data;
    if (cleanData.routing_mode !== undefined) assertServiceRoutingMode(cleanData.routing_mode);
    const result = await this.prisma.$transaction(async tx => {
      const lockedServices = await tx.$queryRawUnsafe<Array<{
        id: number;
        image_url: string | null;
        vehicle_category: string | null;
        routing_mode: string;
      }>>(
        'SELECT "id", "image_url", "vehicle_category", "routing_mode" FROM "service_configs" WHERE "id" = $1 FOR UPDATE',
        Number(id),
      );
      const existing = lockedServices[0];
      if (!existing) throw new NotFoundException('Serviço não encontrado.');
      assertCompatibleServiceRouting(
        cleanData.vehicle_category ?? existing.vehicle_category,
        cleanData.routing_mode ?? existing.routing_mode,
      );

      const updated = await tx.service_configs.update({
        where: { id: Number(id) },
        data: cleanData,
      });
      return { updated, previousImageUrl: existing.image_url };
    });

    // LOG
    await this.createAuditLog(adminId, 'UPDATE_PRICING', 'service_config', id.toString(), cleanData);

    if (cleanData.image_url !== undefined && result.previousImageUrl && result.previousImageUrl !== result.updated.image_url) {
      await cleanupServiceImageIfUnreferenced(result.previousImageUrl, async imageUrl => (
        await this.prisma.service_configs.count({ where: { image_url: imageUrl } }) > 0
      ));
    }

    // REAL-TIME BROADCAST
    this.adminGateway.sendToAdmins('pricing_updated', result.updated);

    return result.updated;
  }

  async deleteServiceConfig(id: number, adminId: string) {
    const result = await this.prisma.$transaction(async tx => {
      const lockedService = await tx.$queryRaw<Array<{ id: number; image_url: string | null }>>`
        SELECT "id", "image_url" FROM "service_configs" WHERE "id" = ${id} FOR UPDATE
      `;
      if (lockedService.length === 0) throw new NotFoundException('Serviço não encontrado.');

      const tripCount = await tx.trips.count({ where: { service_config_id: id } });
      if (tripCount > 0) throw new ConflictException('Não é possível excluir um serviço que já possui viagens registradas.');

      const activeQuoteCount = await tx.trip_quotes.count({
        where: { service_config_id: id, consumed_at: null, expires_at: { gt: new Date() } },
      });
      if (activeQuoteCount > 0) throw new ConflictException('Aguarde as cotações deste serviço expirarem antes de o excluir.');

      const deleted = await tx.service_configs.delete({ where: { id } });
      await tx.audit_logs.create({
        data: { admin_id: adminId, action: 'DELETE_SERVICE', target: 'service_config', target_id: id.toString(), details: {} },
      });
      return { ...deleted, image_url: lockedService[0].image_url };
    });
    await cleanupServiceImageIfUnreferenced(result.image_url, async imageUrl => (
      await this.prisma.service_configs.count({ where: { image_url: imageUrl } }) > 0
    ));
    this.adminGateway.sendToAdmins('pricing_updated', { id, deleted: true });
    return { success: true, id: result.id };
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

  async getAllTrips(page = 1, pageSize = 20, status = 'all', search = '') {
    const where: any = {};
    if (status === 'live') where.status = { in: ['requested', 'accepted', 'arrived', 'ongoing'] };
    else if (status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { profiles_trips_client_idToprofiles: { is: { full_name: { contains: search, mode: 'insensitive' } } } },
        { profiles_trips_driver_idToprofiles: { is: { full_name: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    const [items, total] = await Promise.all([this.prisma.trips.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
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
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }]
    }), this.prisma.trips.count({ where })]);
    return { items: items || [], total, page, pageSize };
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
        current_accuracy: true,
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

  async getAuditLogs(page = 1, pageSize = 20, filters: { action?: string; target?: string; search?: string } = {}) {
    const where: any = {};
    if (filters.action) where.action = filters.action;
    if (filters.target) where.target = filters.target;
    if (filters.search) {
      where.OR = [
        { action: { contains: filters.search, mode: 'insensitive' } },
        { target_id: { contains: filters.search, mode: 'insensitive' } },
        { profiles: { is: { full_name: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          action: true,
          target: true,
          target_id: true,
          created_at: true,
          details: true,
          profiles: { select: { full_name: true } },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.audit_logs.count({ where }),
    ]);
    return {
      items: (rows || []).map(row => ({ ...row, details: sanitizeAuditDetails(row.details) })),
      total,
      page,
      pageSize,
    };
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
