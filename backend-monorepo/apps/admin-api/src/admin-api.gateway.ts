import {
  Injectable,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? allowedOrigins
      : (allowedOrigins.length ? allowedOrigins : true),
  },
  namespace: 'admin',
})
export class AdminGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('Missing token');
      const claims = await this.jwtService.verifyAsync<{ sub?: unknown; role?: unknown }>(token);
      if (typeof claims.sub !== 'string' || claims.role !== 'admin') throw new Error('Invalid actor');
      client.data.actor = { id: claims.sub, role: 'admin' };
      await client.join('admins');
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {}

  sendToAdmins(event: string, data: unknown) {
    this.server.to('admins').emit(event, data);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    if (client.data.actor?.role === 'admin') {
      return { event: 'pong', data: new Date().toISOString() };
    }
  }
}
