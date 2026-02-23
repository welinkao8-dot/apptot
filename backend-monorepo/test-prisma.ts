import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Testing Prisma getHistory query...');
    try {
        const userId = '1'; // This is expected to fail if it's not a UUID, let's see why it's 500
        const trips = await prisma.trips.findMany({
            take: 5,
        });
        console.log('Trips found:', trips.length);
        if (trips.length > 0) {
            console.log('Sample Trip ID:', trips[0].id);
            console.log('Sample Trip client_id:', trips[0].client_id);
            console.log('Sample Trip category:', trips[0].category);
        }
    } catch (error) {
        console.error('Prisma query failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
