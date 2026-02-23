const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProfiles() {
    const profiles = await prisma.profiles.findMany({
        where: { role: 'admin' }
    });
    console.log(JSON.stringify(profiles, null, 2));
    await prisma.$disconnect();
}

checkProfiles();
