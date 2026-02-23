import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { AdminGateway } from './admin-api.gateway';

@Injectable()
export class AdminApiService {
  constructor(
    private prisma: PrismaService,
    private adminGateway: AdminGateway
  ) { }

  getHello(): string {
    return 'TOT Admin API';
  }

  async getPendingDrivers() {
    const drivers = await this.prisma.drivers.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'desc' }
    });
    return drivers || [];
  }

  async getAllDrivers() {
    const drivers = await this.prisma.drivers.findMany({
      orderBy: { created_at: 'desc' }
    });
    return drivers || [];
  }

  async getDriverById(id: string) {
    return this.prisma.drivers.findUnique({
      where: { id: id as any }
    });
  }

  async getAllClients() {
    const clients = await this.prisma.profiles.findMany({
      where: { role: 'client' },
      include: {
        _count: {
          select: {
            trips_trips_client_idToprofiles: {
              where: { status: 'completed' }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return clients.map(c => ({
      ...c,
      paidTripsCount: (c as any)._count?.trips_trips_client_idToprofiles || 0
    }));
  }

  async approveDriver(id: string) {
    // Approve both in drivers and profiles
    await this.prisma.drivers.update({
      where: { id: id as any },
      data: { status: 'active' },
    });

    return this.prisma.profiles.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async updateDriverStatus(id: string, status: string) {
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
        console.log(`🔔 Attempting to notify driver ${id} of status: ${status}`);
        const axios = require('axios');
        const response = await axios.post(`http://localhost:3004/notify-driver-status`, {
          driverId: id,
          status
        });
        console.log(`✅ Successfully notified driver ${id}:`, response.data);
      } catch (error) {
        console.error(`❌ Failed to notify driver ${id}:`, error.message);
      }
    }

    return { success: true };
  }

  async getServiceConfigs() {
    const configs = await this.prisma.service_configs.findMany({
      orderBy: { id: 'asc' }
    });
    return configs || [];
  }

  async createServiceConfig(data: any) {
    const created = await this.prisma.service_configs.create({
      data,
    });

    // LOG
    await this.createAuditLog(null, 'CREATE_SERVICE', 'service_config', created.id.toString(), data);

    // REAL-TIME BROADCAST
    this.adminGateway.sendToAdmins('pricing_updated', created);

    return created;
  }

  async updateServiceConfig(id: number, data: any) {
    // Basic validation / cleaning of data if needed
    const { id: _, trips, updated_at, ...cleanData } = data;

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

    // Calculate Total Revenue (completed only)
    const revenueData = await this.prisma.trips.aggregate({
      where: { status: 'completed' },
      _sum: {
        final_fare: true,
      },
    });

    // Calculate Today's Revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRevenueData = await this.prisma.trips.aggregate({
      where: {
        status: 'completed',
        created_at: { gte: today },
      },
      _sum: {
        final_fare: true,
      },
    });

    const result = {
      totalTrips,
      completedTrips,
      activeTrips,
      totalDrivers,
      onlineDrivers,
      totalClients,
      totalRevenue: Number(revenueData._sum.final_fare || 0),
      todayRevenue: Number(todayRevenueData._sum.final_fare || 0),
    };

    console.log('--- DASHBOARD STATS DEBUG ---');
    console.log('Total Trips:', totalTrips);
    console.log('Completed Trips (status="completed"):', completedTrips);
    console.log('Active Trips:', activeTrips);
    console.log('Revenue Raw:', revenueData);
    console.log('Today Revenue Raw:', todayRevenueData);
    console.log('Final Result:', result);

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
        }
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
        status: true,
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

    // Fetch completed trips from last 7 days
    const trips = await this.prisma.trips.findMany({
      where: {
        status: 'completed',
        created_at: { gte: sevenDaysAgo }
      },
      select: {
        created_at: true,
        final_fare: true,
        category: true, // IMPORTANT: Added to allow grouping
        service_configs: {
          select: { vehicle_category: true, service_type: true }
        }
      }
    });

    // Process daily revenue
    const dailyRevenue = last7Days.map(date => {
      const dayTotal = trips
        .filter(t => t.created_at && t.created_at.toISOString().split('T')[0] === date)
        .reduce((sum, t) => sum + Number(t.final_fare || 0), 0);

      return { date, revenue: dayTotal };
    });

    // Category distribution - Corrected to use 'category' field and PT labels
    const categories: { [key: string]: number } = {};
    trips.forEach(t => {
      const catVal = (t as any).category || 'ride'; // Map to category field
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
