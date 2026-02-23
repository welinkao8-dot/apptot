const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectUsers() {
    const phones = ['946880423', '946880427'];

    console.log('--- STARTING DATABASE INSPECTION ---');

    for (const phone of phones) {
        console.log(`\n=========================================`);
        console.log(`PHONE NUMBER: [${phone}]`);

        try {
            // 1. Search in profiles
            const profiles = await prisma.profiles.findMany({
                where: {
                    OR: [
                        { phone: phone },
                        { phone: phone.trim() },
                        { phone: { contains: phone } }
                    ]
                }
            });
            console.log(`PROFILES FOUND: ${profiles.length}`);
            profiles.forEach((p, i) => {
                console.log(`  Profile ${i + 1}:`);
                console.log(`    ID: ${p.id}`);
                console.log(`    Phone: [${p.phone}]`);
                console.log(`    Role: ${p.role}`);
                console.log(`    Status: ${p.status}`);
            });

            // 2. Search in drivers
            const drivers = await prisma.drivers.findMany({
                where: {
                    OR: [
                        { phone: phone },
                        { phone: phone.trim() },
                        { phone: { contains: phone } }
                    ]
                }
            });
            console.log(`DRIVERS FOUND: ${drivers.length}`);
            drivers.forEach((d, i) => {
                console.log(`  Driver ${i + 1}:`);
                console.log(`    ID: ${d.id}`);
                console.log(`    Phone: [${d.phone}]`);
                console.log(`    Status: ${d.status}`);
            });

        } catch (err) {
            console.error(`Error inspecting phone ${phone}:`, err.message);
        }
    }
    console.log('\n--- INSPECTION COMPLETE ---');
}

inspectUsers()
    .catch(e => {
        console.error('Fatal script error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
