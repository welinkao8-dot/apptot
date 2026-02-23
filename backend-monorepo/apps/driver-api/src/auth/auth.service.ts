import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/database';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async validateUser(phone: string, pass: string): Promise<any> {
        // Drivers MUST be in profiles for trip compatibility (UUID)
        const profile = await this.prisma.profiles.findFirst({
            where: { phone, role: 'driver' }
        });

        if (profile && profile.password_hash && (await bcrypt.compare(pass, profile.password_hash))) {
            // Check for supplementary driver details
            const driverDetails = await this.prisma.drivers.findUnique({
                where: { id: profile.id as any }
            });

            return {
                ...profile,
                ...driverDetails, // Merges docs, is_online, rating
                id: profile.id // Ensure ID is the UUID
            };
        }
        return null;
    }

    async login(user: any) {
        const payload = { phone: user.phone, sub: user.id, role: 'driver' };
        return {
            token: this.jwtService.sign(payload), // Changed from access_token
            driver: user,
        };
    }

    async register(data: any) {
        const { full_name, phone, email, address, password } = data;

        // Check existing in either table
        const existing = await this.prisma.profiles.findFirst({
            where: { phone }
        });

        if (existing) {
            // If user is already a driver, throw error
            if (existing.role === 'driver') {
                throw new BadRequestException('Motorista já cadastrado com este telefone.');
            }

            // If user is a client, we will upgrade them to driver and create driver details below
            console.log(`[Register] Upgrading existing client ${phone} to driver`);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const profile = await this.prisma.$transaction(async (tx) => {
            let p;
            if (existing) {
                // 1. Upgrade existing Profile to driver
                p = await tx.profiles.update({
                    where: { id: existing.id },
                    data: {
                        role: 'driver',
                        status: 'pending' // Reset status to pending for driver approval
                    }
                });
            } else {
                // 1. Create Profile (Primary entity for trips)
                p = await tx.profiles.create({
                    data: {
                        full_name,
                        phone,
                        password_hash: hashedPassword,
                        role: 'driver',
                        status: 'pending'
                    }
                });
            }

            // 2. Create or Update Driver Details (Using SAME UUID)
            // Using upsert in case a driver record already exists for some reason
            await tx.drivers.upsert({
                where: { id: p.id as any },
                create: {
                    id: p.id as any,
                    full_name,
                    phone,
                    email,
                    address,
                    password: hashedPassword,
                    status: 'pending_docs',
                    is_online: false
                },
                update: {
                    full_name,
                    phone,
                    email,
                    address,
                    password: hashedPassword,
                    status: 'pending_docs',
                    is_online: false
                }
            });

            return p;
        });

        // FIX: Fetch full driver details to ensure we return correct status (pending_docs) not profile status (pending)
        const fullDriver = await this.prisma.drivers.findUnique({
            where: { id: profile.id as any }
        });

        // Merge profile and driver details like validateUser does
        const userToLogin = {
            ...profile,
            ...fullDriver,
            id: profile.id
        };

        return this.login(userToLogin);
    }

    async updateProfile(driverId: string, data: any) {
        const { full_name, email, address } = data;

        return await this.prisma.$transaction(async (tx) => {
            // Update Profile table
            const updatedProfile = await tx.profiles.update({
                where: { id: driverId },
                data: {
                    full_name,
                    email
                }
            });

            // Update Drivers table
            const updatedDriver = await tx.drivers.update({
                where: { id: driverId },
                data: {
                    full_name,
                    email,
                    address
                }
            });

            return {
                ...updatedProfile,
                ...updatedDriver,
                id: updatedProfile.id
            };
        });
    }

    async changePassword(driverId: string, data: any) {
        const { currentPassword, newPassword } = data;

        const profile = await this.prisma.profiles.findUnique({
            where: { id: driverId }
        });

        if (!profile || !profile.password_hash || !(await bcrypt.compare(currentPassword, profile.password_hash))) {
            throw new BadRequestException('Senha atual incorreta');
        }

        const newHashedPassword = await bcrypt.hash(newPassword, 10);

        await this.prisma.$transaction(async (tx) => {
            // Update Profile
            await tx.profiles.update({
                where: { id: driverId },
                data: { password_hash: newHashedPassword }
            });

            // Update Driver
            await tx.drivers.update({
                where: { id: driverId },
                data: { password: newHashedPassword }
            });
        });

        return { success: true };
    }
}
