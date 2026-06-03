import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const drivers = await prisma.drivers.findMany();
        console.log('--- ALL DRIVERS IN DATABASE ---');
        drivers.forEach(d => {
            console.log(`Driver ID: ${d.id}, Name: ${d.full_name}, Status: ${d.status}`);
        });
    } catch (error) {
        console.error('Error querying drivers:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
