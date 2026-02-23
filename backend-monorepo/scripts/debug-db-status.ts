
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DEEP DATABASE INSPECTION ---');

    // 1. Check TRIPS
    const totalTrips = await prisma.trips.count();
    console.log(`\nTotal Trips: ${totalTrips}`);

    if (totalTrips > 0) {
        const statuses = await prisma.trips.groupBy({
            by: ['status'],
            _count: { status: true }
        });
        console.log('Trips by Status:', statuses);

        const sampleTrips = await prisma.trips.findMany({
            take: 3,
            orderBy: { created_at: 'desc' },
            select: { id: true, status: true, final_fare: true, created_at: true }
        });
        console.log('Sample Trips (Latest 3):', sampleTrips);
    }

    // 2. Check DRIVERS
    const totalDrivers = await prisma.drivers.count();
    console.log(`\nTotal Drivers: ${totalDrivers}`);

    if (totalDrivers > 0) {
        const onlineDrivers = await prisma.drivers.count({ where: { is_online: true } });
        console.log(`Drivers Online (is_online: true): ${onlineDrivers}`);

        const sampleDrivers = await prisma.drivers.findMany({
            take: 3,
            select: { id: true, is_online: true, status: true, full_name: true }
        });
        console.log('Sample Drivers:', sampleDrivers);
    }

    // 3. Test Revenue Aggregation Logic
    const revenue = await prisma.trips.aggregate({
        where: { status: 'completed' },
        _sum: { final_fare: true }
    });
    console.log('\nRevenue Query Check:', revenue);
    console.log('Revenue Number Value:', Number(revenue._sum.final_fare || 0));

    console.log('--- INSPECTION COMPLETE ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
