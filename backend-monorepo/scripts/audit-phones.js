
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- Checking Profiles (Drivers) ---');
    const profiles = await prisma.profiles.findMany({
        where: { role: 'driver' },
        select: { phone: true, id: true }
    });
    console.log(profiles.map(p => `${p.phone} (ID: ${p.id})`));

    console.log('\n--- Checking Drivers Table ---');
    const drivers = await prisma.drivers.findMany({
        select: { phone: true, id: true, email: true }
    });
    console.log(drivers.map(d => `${d.phone} (Email: ${d.email})`));
}

check()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
