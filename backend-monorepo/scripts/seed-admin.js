const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    console.log('--- SEEDING ADMIN USER (JS) ---');

    const hashedPassword = await bcrypt.hash('admin123', 10);
    const phone = '900000000';
    const email = 'admin@tot.ao';

    try {
        const profile = await prisma.profiles.upsert({
            where: { phone },
            update: {
                email,
                role: 'admin',
                status: 'active',
                password_hash: hashedPassword,
                full_name: 'Super Admin'
            },
            create: {
                email,
                phone,
                full_name: 'Super Admin',
                password_hash: hashedPassword,
                role: 'admin',
                status: 'active'
            }
        });

        console.log(`Success! Admin created/updated with email: ${email} and password: admin123`);
        console.log('--- SEEDING COMPLETE ---');
    } catch (error) {
        console.error('Error during seeding:', error);
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
