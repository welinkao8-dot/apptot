import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('--- SEEDING SYSTEM AFTER RESET ---');

    const hashedPassword = await bcrypt.hash('123456', 10);
    const phone = '923000000';

    try {
        // 1. Create Profile
        const profile = await prisma.profiles.create({
            data: {
                phone,
                full_name: 'Motorista de Teste',
                password_hash: hashedPassword,
                role: 'driver',
                status: 'active'
            }
        });

        // 2. Create Driver Details
        await prisma.drivers.create({
            data: {
                id: profile.id,
                full_name: 'Motorista de Teste',
                phone,
                status: 'active',
                is_online: false,
                password: hashedPassword
            }
        });

        console.log(`Success! Driver created with phone: ${phone} and password: 123456`);
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
