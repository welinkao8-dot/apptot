import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- SYSTEM RESET STARTED ---');

    try {
        // 1. Cancel/Clear all trips
        console.log('Cancelling all trips...');
        await prisma.$executeRaw`UPDATE trips SET status = 'cancelled'`;

        // 2. Clear current driver assignments if any
        await prisma.$executeRaw`UPDATE trips SET driver_id = NULL WHERE status = 'requested'`;

        // 3. Force all existing drivers to ACTIVE
        console.log('Activating all drivers and profiles...');
        await prisma.$executeRaw`UPDATE drivers SET status = 'active'`;
        await prisma.$executeRaw`UPDATE profiles SET status = 'active' WHERE role = 'driver'`;

        // Ensure drivers table uses DB status if available
        // In the schema it is 'status', so we match it.

        console.log('--- DB CLEANUP COMPLETE ---');
    } catch (error) {
        console.error('Error during reset:', error);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
