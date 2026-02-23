import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Updating all drivers and profiles to active using RAW SQL...');

    try {
        // Force status to active for all drivers and their associated profiles
        // We use raw SQL to avoid type mismatches with legacy data (e.g. integer IDs)
        await prisma.$executeRaw`UPDATE drivers SET status = 'active'`;

        // Update profiles that have role 'driver'
        await prisma.$executeRaw`UPDATE profiles SET status = 'active' WHERE role = 'driver'`;

        // Update profiles that match IDs in drivers table (even if role is different)
        // We use ::text to handle potential UUID/Text mismatches in some DB versions
        await prisma.$executeRaw`
            UPDATE profiles 
            SET status = 'active' 
            WHERE id::text IN (SELECT id::text FROM drivers)
        `;

        console.log('Successfully activated all drivers and profiles.');
    } catch (error) {
        console.error('Error during activation:', error);
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
