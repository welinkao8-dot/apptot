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
import { Inject, OnModuleInit, Optional } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TripsService } from '../trips/trips.service';
import { isImplausibleLocationJump } from './location-validation';
import { CreateTripDto } from '../trips/dto/create-trip.dto';
import { PaymentsService } from '../payments/payments.service';
import { getCorsPolicy } from '@app/auth';
import { DriverPushService } from '../push/driver-push.service';

type ActorRole = 'client' | 'driver';
type SocketActor = { id: string; role: ActorRole };
type ConnectedUser = SocketActor & { socketIds: Set<string>; isOnline: boolean };
export type DriverLocationFix = { lat: number; lng: number; accuracy?: number; timestamp?: number; heading?: number };
export class InvalidDriverLocationError extends Error {}

@WebSocketGateway({
  cors: getCorsPolicy(),
})
export class RidesGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly connectedUsers = new Map<string, ConnectedUser>();
  private readonly lastLocationUpdates = new Map<string, number>();
  private readonly lastLocationFixes = new Map<string, { lat: number; lng: number; timestamp: number }>();

  constructor(
    private readonly tripsService: TripsService,
    private readonly jwtService: JwtService,
    private readonly paymentsService: PaymentsService,
    @Optional() @Inject(DriverPushService) private readonly pushService?: DriverPushService,
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
    setInterval(() => void this.dispatchAvailableTrips(), 10000);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('Missing token');

      const claims = await this.jwtService.verifyAsync<{ sub?: unknown; role?: unknown }>(token);
      if (
        typeof claims.sub !== 'string'
        || !claims.sub.trim()
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
        const pending = await this.tripsService.findAllPending(actor.id);
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
      if (data.isOnline) client.emit('pending_trips', await this.tripsService.findAllPending(actor.id));
      return { success: true };
    } catch (error) {
      return this.failure(error);
    }
  }

  @SubscribeMessage('update_location')
  async handleUpdateLocation(
    @MessageBody() data: DriverLocationFix,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const actor = this.requireRole(client, 'driver');
      return await this.processDriverLocation(actor.id, data);
    } catch (error) {
      return this.failure(error);
    }
  }

  async processDriverLocation(driverId: string, data: DriverLocationFix) {
    if (!Number.isFinite(data?.lat) || !Number.isFinite(data?.lng) || data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
      throw new InvalidDriverLocationError('Coordenadas GPS inválidas.');
    }
    if (data.accuracy !== undefined && (!Number.isFinite(data.accuracy) || data.accuracy < 0 || data.accuracy > 100)) {
      throw new InvalidDriverLocationError('Precisão GPS insuficiente.');
    }
    if (data.timestamp !== undefined && (!Number.isFinite(data.timestamp) || Math.abs(Date.now() - data.timestamp) > 120_000)) {
      throw new InvalidDriverLocationError('Localização GPS desatualizada.');
    }
    if (data.heading !== undefined && (!Number.isFinite(data.heading) || data.heading < 0 || data.heading >= 360)) {
      throw new InvalidDriverLocationError('Direção GPS inválida.');
    }
    const fix = { lat: data.lat, lng: data.lng, timestamp: data.timestamp ?? Date.now() };
    const previousFix = this.lastLocationFixes.get(driverId);
    if (isImplausibleLocationJump(previousFix, fix)) throw new InvalidDriverLocationError('Salto de localização GPS inválido.');
    const trip = await this.tripsService.findActiveByDriver(driverId);
    if (trip?.client_id) {
      this.server.to(this.room('client', trip.client_id)).emit('trip_update', {
        driverId,
        lat: data.lat,
        lng: data.lng,
        coords: { lat: data.lat, lng: data.lng },
        accuracy: data.accuracy ?? null,
        heading: data.heading ?? null,
        timestamp: fix.timestamp,
      });
    }
    const now = Date.now();
    if (now - (this.lastLocationUpdates.get(driverId) || 0) > 30000) {
      await this.tripsService.updateDriverLocation(driverId, data.lat, data.lng, data.accuracy);
      this.lastLocationUpdates.set(driverId, now);
    }
    this.lastLocationFixes.set(driverId, fix);
    return { success: true };
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
      void this.dispatchTrip(trip.id);
      return { success: true, tripId: trip.id, trip: formattedTrip, status: trip.status, committedAt: new Date().toISOString() };
    } catch (error) {
      const result = this.failure(error);
      client.emit('trip_error', { message: result.error });
      return result;
    }
  }

  @SubscribeMessage('accept_trip')
  async handleAcceptTrip(
    @MessageBody() data: { tripId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const actor = this.requireRole(client, 'driver');
      // The service remains authoritative; this read only avoids replaying notifications after a lost ACK.
      const currentTrip = await this.tripsService.findOne(data.tripId);
      const isRetryOfCommittedClaim = currentTrip?.driver_id === actor.id
        && (currentTrip.status === 'accepted' || currentTrip.status === 'ongoing');
      const trip = await this.tripsService.accept(data.tripId, actor.id);
      if (!trip) throw new Error('Trip not found');
      if (isRetryOfCommittedClaim) return { success: true };
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

  @SubscribeMessage('decline_trip')
  async handleDeclineTrip(@MessageBody() data: { tripId: string }, @ConnectedSocket() client: Socket) {
    try {
      const actor = this.requireRole(client, 'driver');
      await this.tripsService.declineOffer(data.tripId, actor.id);
      await this.dispatchTrip(data.tripId);
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

      const cancelledTrip = await this.tripsService.cancel(data.tripId, actor);
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
      await this.tripsService.start(data.tripId, trip.driver_id);
      this.server.to(this.room('client', trip.client_id)).emit('ride_started', { tripId: data.tripId });
      return { success: true };
    } catch (error) {
      return this.failure(error);
    }
  }

  @SubscribeMessage('finish_ride')
  async handleFinishRide(
      @MessageBody() data: { tripId: string; finalFare?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const trip = await this.driverTrip(client, data.tripId, 'ongoing');
      const completedTrip = await this.tripsService.finish(data.tripId, trip.driver_id);
      this.server.to(this.room('client', trip.client_id)).emit('ride_finished', {
        tripId: data.tripId,
        finalFare: completedTrip.final_fare,
      });
      return { success: true };
    } catch (error) {
      return this.failure(error);
    }
  }

  @SubscribeMessage('confirm_cash_payment')
  async handleConfirmCashPayment(
    @MessageBody() data: { tripId: string; amount: string | number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const actor = this.requireRole(client, 'driver');
      const trip = await this.tripsService.findOneForDriver(data.tripId, actor.id);
      const payment = await this.paymentsService.confirmCashPayment(data.tripId, actor.id, data.amount);
      this.server.to(this.room('client', trip.client_id)).emit('payment_confirmed', {
        tripId: trip.id,
        amount: payment.amount.toString(),
        method: 'cash',
      });
      return { success: true, paymentId: payment.id };
    } catch (error) {
      return this.failure(error);
    }
  }

  @SubscribeMessage('trip_progress')
  async handleTripProgress(
      @MessageBody() data: { tripId: string; coords?: { lat?: number; lng?: number }; timestamp?: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const actor = this.requireRole(client, 'driver');
      await this.driverTrip(client, data.tripId, 'ongoing');
      return await this.processDriverLocation(actor.id, {
        lat: typeof data?.coords?.lat === 'number' ? data.coords.lat : Number.NaN,
        lng: typeof data?.coords?.lng === 'number' ? data.coords.lng : Number.NaN,
        timestamp: data?.timestamp,
      });
    } catch (error) {
      return this.failure(error);
    }
  }

  async notifyNewTrip(formattedTrip: any) {
    await this.dispatchTrip(formattedTrip.id);
  }

  private async dispatchAvailableTrips() {
    try {
      const requested = await this.tripsService.findRequestedTripIds();
      for (const trip of requested) await this.dispatchTrip(trip.id);
    } catch (error) {
      console.error('[DISPATCH] Failed to schedule pending trip offers', error);
    }
  }

  private async dispatchTrip(tripId: string) {
    try {
      const offers = await this.tripsService.dispatchNextBatch(tripId, []);
      for (const offer of offers) {
        const offeredTripId = offer.trip?.id;
        if (typeof offeredTripId !== 'string' || !offeredTripId) continue;
        void this.pushService?.sendTripOffer(offer.driverId, offeredTripId).catch((error) => {
          console.error(`[PUSH] Failed to send trip offer ${offeredTripId} to driver ${offer.driverId}`, error);
        });
        this.server.to(this.room('driver', offer.driverId)).emit('new_trip_available', {
          ...offer.trip,
          offerExpiresAt: offer.expiresAt,
          driverDistanceKm: offer.distanceKm,
        });
      }
    } catch (error) {
      console.error(`[DISPATCH] Failed to offer trip ${tripId}`, error);
    }
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
