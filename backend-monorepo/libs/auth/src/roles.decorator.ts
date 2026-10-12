import { SetMetadata } from '@nestjs/common';
import type { Role } from './auth-user';

export const ROLES_KEY = 'auth:roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
