import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TripsService } from '../trips/trips.service';
import { CreateTripDto } from '../trips/dto/create-trip.dto';

type ActorRole = 'client' | 'driver';
type SocketActor = { id: string; role: ActorRole };
type ConnectedUser = SocketActor & { socketIds: Set<string>; isOnline: boolean };

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? allowedOrigins
      : (allowedOrigins.length ? allowedOrigins : true),
  },
})
export class RidesGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly connectedUsers = new Map<string, ConnectedUser>();
  private readonly lastLocationUpdates = new Map<string, number>();

  constructor(
    private readonly tripsService: TripsService,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    setInterval(async () => {
      const cancelled = await this.tripsService.cancelOrphanTrips();
      for (const { tripId, clientId } of cancelled) {
        if (clientId) {
          this.server.to(this.room('client', clientId)).emit('trip_timeout', {
            tripId,
            message: 'Nenhum motorista disponível no momento. Tente novamente.',
          });
        }
      }
    }, 60000);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('Missing token');

      const claims = await this.jwtService.verifyAsync<{ sub?: unknown; role?: unknown }>(token);
      if (
        typeof claims.sub !== 'string'
        || (claims.role !== 'client' && claims.role !== 'driver')
      ) {
        throw new Error('Invalid actor');
      }

      const actor: SocketActor = { id: claims.sub, role: claims.role };
      client.data.actor = actor;
      await client.join(this.room(actor.role, actor.id));
      const connected = this.connectedUsers.get(this.actorKey(actor));
      if (connected) connected.socketIds.add(client.id);
      else this.connectedUsers.set(this.actorKey(actor), { ...actor, socketIds: new Set([client.id]), isOnline: false });
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const actor = this.actor(client);
    const key = actor ? this.actorKey(actor) : undefined;
    const connected = key ? this.connectedUsers.get(key) : undefined;
    if (key && connected) {
      connected.socketIds.delete(client.id);
      if (connected.socketIds.size === 0) this.connectedUsers.delete(key);
    }
  }

  @SubscribeMessage('join')
  async handleJoin(@MessageBody() _data: unknown, @ConnectedSocket() client: Socket) {
    const actor = this.requireActor(client);
    const connected = this.connectedUsers.get(this.actorKey(actor));
    if (!connected) return { success: false, error: 'Unauthorized' };

    if (actor.role === 'driver') {
      const isOnline = await this.tripsService.getDriverStatus(actor.id);
      connected.isOnline = isOnline;
      client.emit('login_status', { isOnline });

      const activeTrip = await this.tripsService.findActiveByDriver(actor.id);
      if (activeTrip) {
        client.emit('restore_ride', this.tripsService.formatTrip(activeTrip));
      } else if (isOnline) {
        const pending = await this.tripsService.findAllPending();
        if (pending.length) client.emit('pending_trips', pending);
      }
    } else {
      const activeTrip = await this.tripsService.findActiveByClient(actor.id);
      if (activeTrip) client.emit('restore_trip', this.tripsService.formatTrip(activeTrip));
    }

    return { success: true };
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    if (this.actor(client)) client.emit('pong');
  }

  @SubscribeMessage('toggle_online')
  async handleToggleOnline(
    @MessageBody() data: { isOnline: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const actor = this.requireRole(client, 'driver');
      if (typeof data?.isOnline !== 'boolean') throw new Error('Invalid availability value');
      await this.tripsService.updateDriverStatus(actor.id, data.isOnline);
      const connected = this.connectedUsers.get(this.actorKey(actor));
      if (connected) connected.isOnline = data.isOnline;
      if (data.isOnline) client.emit('pending_trips', await this.tripsService.findAllPending());
      return { success: true };
    } catch (error) {
      return this.failure(error);
    }
  }

  @SubscribeMessage('update_location')
  async handleUpdateLocation(
    @MessageBody() data: { lat: number; lng: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const actor = this.requireRole(client, 'driver');
      const trip = await this.tripsService.findActiveByDriver(actor.id);
      if (trip?.client_id) {
        this.server.to(this.room('client', trip.client_id)).emit('driver_location_update', {
          driverId: actor.id,
          lat: data.lat,
          lng: data.lng,
        });
      }
      const now = Date.now();
      if (now - (this.lastLocationUpdates.get(actor.id) || 0) > 30000) {
        await this.tripsService.updateDriverLocation(actor.id, data.lat, data.lng);
        this.lastLocationUpdates.set(actor.id, now);
      }
      return { success: true };
    } catch (error) {
      return this.failure(error);
    }
  }

  notifyDriverAccountStatus(driverId: string, status: 'suspended' | 'active') {
    const event = status === 'suspended' ? 'account_suspended' : 'account_activated';
    const message = status === 'suspended'
      ? 'Sua conta foi suspensa pelo administrador'
      : 'Sua conta foi reativada';
    this.server.to(this.room('driver', driverId)).emit(event, { message });
  }

  @SubscribeMessage('request_trip')
  async handleRequestTrip(@MessageBody() dto: CreateTripDto, @ConnectedSocket() client: Socket) {
    try {
      const actor = this.requireRole(client, 'client');
      const trip = await this.tripsService.create(dto, actor.id);
      const formattedTrip = this.tripsService.formatTrip(trip);
      client.emit('trip_created', { tripId: trip.id, trip: formattedTrip });
      this.notifyNewTrip(formattedTrip);
      return { success: true, tripId: trip.id };
    } catch (error) {
      client.emit('trip_error', { message: 'Não foi possível criar a viagem.' });
      return this.failure(error);
    }
  }

  @SubscribeMessage('accept_trip')
  async handleAcceptTrip(
    @MessageBody() data: { tripId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const actor = this.requireRole(client, 'driver');
      const trip = await this.tripsService.accept(data.tripId, actor.id);
      if (!trip) throw new Error('Trip not found');
      this.server.to(this.room('client', trip.client_id)).emit('trip_accepted', {
        tripId: trip.id,
        driver: { id: actor.id, name: trip.profiles_trips_driver_idToprofiles?.full_name || 'Motorista' },
      });
      this.emitToOnlineDrivers('trip_taken', { tripId: trip.id, acceptedBy: actor.id });
      return { success: true };
    } catch (error) {
      return this.failure(error);
    }
  }

  @SubscribeMessage('cancel_trip')
  async handleCancelTrip(@MessageBody() data: { tripId: string }, @ConnectedSocket() client: Socket) {
    try {
      const actor = this.requireActor(client);
      const trip = await this.tripsService.findOne(data.tripId);
      if (!trip) throw new Error('Trip not found');
      if (trip.status === 'ongoing') throw new Error('Cannot cancel trip in progress');
      if (trip.status === 'completed' || trip.status === 'cancelled') throw new Error('Trip already finished');
      if (actor.role === 'client' && trip.client_id !== actor.id) throw new Error('Forbidden');
      if (actor.role === 'driver' && trip.driver_id !== actor.id) throw new Error('Forbidden');

      const cancelledTrip = await this.tripsService.cancel(data.tripId);
      if (cancelledTrip.driver_id) {
        this.server.to(this.room('driver', cancelledTrip.driver_id)).emit(
          actor.role === 'driver' ? 'trip_cancelled_confirmed' : 'trip_cancelled',
          { tripId: cancelledTrip.id },
        );
      }
      if (cancelledTrip.client_id) {
        this.server.to(this.room('client', cancelledTrip.client_id)).emit(
          actor.role === 'client' ? 'trip_cancelled_confirmed' : 'trip_cancelled',
          { tripId: cancelledTrip.id },
        );
      }
      this.emitToOnlineDrivers('trip_cancelled', { tripId: cancelledTrip.id });
      return { success: true, tripId: cancelledTrip.id };
    } catch (error) {
      return this.failure(error);
    }
  }

  @SubscribeMessage('start_ride')
  async handleStartRide(@MessageBody() data: { tripId: string }, @ConnectedSocket() client: Socket) {
    try {
      const trip = await this.driverTrip(client, data.tripId, 'accepted');
      await this.tripsService.start(data.tripId);
      this.server.to(this.room('client', trip.client_id)).emit('ride_started', { tripId: data.tripId });
      return { success: true };
    } catch (error) {
      return this.failure(error);
    }
  }

  @SubscribeMessage('finish_ride')
  async handleFinishRide(
    @MessageBody() data: { tripId: string; finalFare: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const trip = await this.driverTrip(client, data.tripId, 'ongoing');
      await this.tripsService.finish(data.tripId, data.finalFare);
      this.server.to(this.room('client', trip.client_id)).emit('ride_finished', {
        tripId: data.tripId,
        finalFare: data.finalFare,
      });
      return { success: true };
    } catch (error) {
      return this.failure(error);
    }
  }

  @SubscribeMessage('trip_progress')
  async handleTripProgress(
    @MessageBody() data: { tripId: string; currentFare: number; coords: { lat: number; lng: number } },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const trip = await this.driverTrip(client, data.tripId, 'ongoing');
      await this.tripsService.updateFare(data.tripId, data.currentFare);
      this.server.to(this.room('client', trip.client_id)).emit('trip_update', {
        currentFare: data.currentFare,
        coords: data.coords,
      });
      return { success: true };
    } catch (error) {
      return this.failure(error);
    }
  }

  notifyNewTrip(formattedTrip: any) {
    this.emitToOnlineDrivers('new_trip_available', formattedTrip);
  }

  private room(role: ActorRole, id: string) {
    return `${role}_${id}`;
  }

  private actorKey(actor: SocketActor) {
    return `${actor.role}:${actor.id}`;
  }

  private actor(client: Socket): SocketActor | undefined {
    const actor = client.data.actor as SocketActor | undefined;
    return actor?.id && (actor.role === 'client' || actor.role === 'driver') ? actor : undefined;
  }

  private requireActor(client: Socket): SocketActor {
    const actor = this.actor(client);
    if (!actor) throw new Error('Unauthorized');
    return actor;
  }

  private requireRole(client: Socket, role: ActorRole): SocketActor {
    const actor = this.requireActor(client);
    if (actor.role !== role) throw new Error('Forbidden');
    return actor;
  }

  private async driverTrip(client: Socket, tripId: string, expectedStatus: 'accepted' | 'ongoing') {
    const actor = this.requireRole(client, 'driver');
    const trip = await this.tripsService.findOneForDriver(tripId, actor.id);
    if (trip.status !== expectedStatus) throw new Error('Invalid trip status');
    return trip;
  }

  private emitToOnlineDrivers(event: string, data: unknown) {
    for (const connected of this.connectedUsers.values()) {
      if (connected.role === 'driver' && connected.isOnline) {
        this.server.to(this.room('driver', connected.id)).emit(event, data);
      }
    }
  }

  private failure(error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Request failed' };
  }
}
