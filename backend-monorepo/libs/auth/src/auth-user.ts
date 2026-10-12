export type Role = 'admin' | 'client' | 'driver';

export interface AuthUser {
  sub: string;
  role: Role;
}
