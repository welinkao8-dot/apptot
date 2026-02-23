import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('--- SEEDING COMPLETED TRIPS FOR DASHBOARD ---');

    try {
        // 1. Ensure we have a client and driver
        const hashedPassword = await bcrypt.hash('123456', 10);

        // Client
        const client = await prisma.profiles.upsert({
            where: { phone: '923111111' },
            update: {},
            create: {
                phone: '923111111',
                full_name: 'Cliente Demo',
                password_hash: hashedPassword,
                role: 'client',
                status: 'active'
            }
        });

        // Driver (Reuse or create)
        const driverProfile = await prisma.profiles.upsert({
            where: { phone: '923000000' },
            update: {},
            create: {
                phone: '923000000',
                full_name: 'Motorista de Teste',
                password_hash: hashedPassword,
                role: 'driver',
                status: 'active'
            }
        });

        await prisma.drivers.upsert({
            where: { id: driverProfile.id },
            update: { is_online: true }, // Ensure online for "Active Drivers"
            create: {
                id: driverProfile.id,
                full_name: 'Motorista de Teste',
                phone: '923000000',
                status: 'active',
                is_online: true,
                password: hashedPassword
            }
        });

        // 2. Ensure Service Config
        const serviceConfig = await prisma.service_configs.upsert({
            where: { id: 1 },
            update: {},
            create: {
                service_type: 'Ride',
                vehicle_category: 'Comfort',
                base_fare: 500,
                price_per_km: 200,
                price_per_min: 50,
                platform_fee_type: 'percent',
                platform_fee_value: 20,
                updated_at: new Date()
            }
        });

        // 3. Create Completed Trips (Different Dates for Charts)
        const tripsToCreate = [
            // TODAY (for "Revenue Today" card)
            { fare: 2500, date: new Date(), status: 'completed' },
            { fare: 1800, date: new Date(), status: 'completed' },
            { fare: 3200, date: new Date(new Date().setHours(new Date().getHours() - 2)), status: 'completed' },

            // YESTERDAY
            { fare: 4000, date: new Date(new Date().setDate(new Date().getDate() - 1)), status: 'completed' },

            // 2 DAYS AGO
            { fare: 1500, date: new Date(new Date().setDate(new Date().getDate() - 2)), status: 'completed' },

            // ACTIVE TRIPS (for "Active Trips" card)
            { fare: 0, date: new Date(), status: 'started' },
            { fare: 0, date: new Date(), status: 'ongoing' }
        ];

        for (const t of tripsToCreate) {
            await prisma.trips.create({
                data: {
                    client_id: client.id,
                    driver_id: driverProfile.id,
                    service_config_id: serviceConfig.id,
                    status: t.status,
                    origin_address: 'Rua A',
                    dest_address: 'Rua B',
                    final_fare: t.fare > 0 ? t.fare : undefined,
                    created_at: t.date,
                    completed_at: t.status === 'completed' ? t.date : undefined,
                    payment_method: 'cash'
                }
            });
        }

        console.log(`Success! Created ${tripsToCreate.length} trips.`);
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
