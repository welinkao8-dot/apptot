import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { OnModuleInit } from '@nestjs/common';
import { TripsService } from '../trips/trips.service';
import { Server, Socket } from 'socket.io';
import { CreateTripDto } from '../trips/dto/create-trip.dto';

@WebSocketGateway({ cors: { origin: '*' } })
export class RidesGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  // Track connected users
  private connectedUsers = new Map<string, { socketId: string, role: string, userId: string }>();
  // Throttling for DB updates
  private lastLocationUpdates = new Map<string, number>();

  constructor(private readonly tripsService: TripsService) { }

  onModuleInit() {
    // Check for orphan trips every minute
    setInterval(async () => {
      const cancelled = await this.tripsService.cancelOrphanTrips();
      for (const { tripId, clientId } of cancelled) {
        this.server.to(`client_${clientId}`).emit('trip_timeout', {
          tripId,
          message: 'Nenhum motorista disponível no momento. Tente novamente.'
        });
      }
    }, 60000); // Every 1 minute
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);

    // Find and remove from connected users
    for (const [userId, data] of this.connectedUsers.entries()) {
      if (data.socketId === client.id) {
        console.log(`User ${userId} (${data.role}) disconnected`);

        // REMOVED: Automatic offline status change on disconnect.
        // Status is now strictly manual (DB source of truth).

        this.connectedUsers.delete(userId);
        break;
      }
    }
  }

  @SubscribeMessage('join')
  async handleJoin(@MessageBody() data: { userId: string, role: string }, @ConnectedSocket() client: Socket) {
    const { userId, role } = data;
    const room = `${role}_${userId}`;
    client.join(room);
    console.log(`${role} joined room: ${room}`);

    // Track connected user
    this.connectedUsers.set(userId, { socketId: client.id, role, userId });

    if (role === 'driver') {
      const isOnline = await this.tripsService.getDriverStatus(userId);
      client.emit('login_status', { isOnline });

      // Restore active trip
      const activeTrip = await this.tripsService.findActiveByDriver(userId);
      if (activeTrip) {
        client.emit('restore_ride', this.tripsService.formatTrip(activeTrip));
      } else {
        // If online and no active trip, show pending
        if (isOnline) {
          const pending = await this.tripsService.findAllPending();
          if (pending.length > 0) {
            client.emit('pending_trips', pending);
          }
        }
      }
    } else if (role === 'client') {
      const activeTrip = await this.tripsService.findActiveByClient(userId);
      if (activeTrip) {
        // Format trip for client restoration
        client.emit('restore_trip', this.tripsService.formatTrip(activeTrip));
      }
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    // Heartbeat mechanism
    client.emit('pong');
  }

  @SubscribeMessage('toggle_online')
  async handleToggleOnline(@MessageBody() data: { userId: string, isOnline: boolean }, @ConnectedSocket() client: Socket) {
    await this.tripsService.updateDriverStatus(data.userId, data.isOnline);

    // CRITICAL: If going online, explicitly fetch all pending trips from DB
    if (data.isOnline) {
      const pending = await this.tripsService.findAllPending();
      client.emit('pending_trips', pending);
      console.log(`Driver ${data.userId} went online, sent ${pending.length} pending trips.`);
    }
  }

  @SubscribeMessage('update_location')
  async handleUpdateLocation(@MessageBody() data: { driverId: string, lat: number, lng: number, activeClientId?: string }) {
    const { driverId, lat, lng, activeClientId } = data;

    // 1. Send to specific Client (if in a ride)
    if (activeClientId) {
      this.server.to(`client_${activeClientId}`).emit('driver_location_update', { driverId, lat, lng });
    }

    // 2. Persist to DB (Throttled: 30s) to avoid overloading Postgres
    const now = Date.now();
    const lastUpdate = this.lastLocationUpdates.get(driverId) || 0;

    if (now - lastUpdate > 30000) { // 30 seconds
      await this.tripsService.updateDriverLocation(driverId, lat, lng);
      this.lastLocationUpdates.set(driverId, now);
    }
  }

  @SubscribeMessage('force_suspend_driver')
  handleForceSuspend(@MessageBody() data: { driverId: string, message: string }) {
    console.log(`🔴 Forcing suspension for driver ${data.driverId}`);
    this.server.to(`driver_${data.driverId}`).emit('account_suspended', {
      message: data.message
    });
  }

  @SubscribeMessage('force_activate_driver')
  handleForceActivate(@MessageBody() data: { driverId: string, message: string }) {
    console.log(`🟢 Forcing activation for driver ${data.driverId}`);
    this.server.to(`driver_${data.driverId}`).emit('account_activated', {
      message: data.message
    });
  }

  // Public method that can be called by other services (like Admin API)
  notifyDriverAccountStatus(driverId: string, status: 'suspended' | 'active') {
    const message = status === 'suspended'
      ? 'Sua conta foi suspensa pelo administrador'
      : 'Sua conta foi reativada';

    const event = status === 'suspended' ? 'account_suspended' : 'account_activated';

    console.log(`📢 Notifying driver ${driverId}: ${event}`);
    this.server.to(`driver_${driverId}`).emit(event, { message });
  }

  @SubscribeMessage('request_trip')
  async handleRequestTrip(@MessageBody() createTripDto: CreateTripDto, @ConnectedSocket() client: Socket) {
    console.log(`🔵 [REQUEST_TRIP] Recebido de cliente ${createTripDto.clientId}`);

    const trip = await this.tripsService.create(createTripDto);
    console.log(`✅ [REQUEST_TRIP] Viagem criada: ID=${trip.id}`);

    const formattedTrip = this.tripsService.formatTrip(trip);
    console.log(`📦 [REQUEST_TRIP] Viagem formatada:`, JSON.stringify(formattedTrip, null, 2));

    // CRITICAL: Return trip to client immediately (acknowledgment)
    // This gives client the tripId for cancellation
    client.emit('trip_created', { tripId: trip.id, trip: formattedTrip });

    // Broadcast to all drivers
    const connectedSockets = await this.server.fetchSockets();
    console.log(`📡 [BROADCAST] Emitindo new_trip_available para ${connectedSockets.length} sockets conectados`);
    this.server.emit('new_trip_available', formattedTrip);
    console.log(`✅ [BROADCAST] new_trip_available emitido com sucesso`);

    return { success: true, tripId: trip.id };
  }

  @SubscribeMessage('accept_trip')
  async handleAcceptTrip(@MessageBody() data: { tripId: string, driverId: string, clientId: string, driverName: string }) {
    console.log(`🔵 [ACCEPT_TRIP] Motorista ${data.driverId} aceitando viagem ${data.tripId}`);

    try {
      const trip = await this.tripsService.accept(data.tripId, data.driverId);

      if (!trip) {
        throw new Error('Trip not found after accept');
      }

      console.log(`✅ [ACCEPT_TRIP] Viagem ${trip.id} aceita com sucesso`);

      // Notify Client
      this.server.to(`client_${trip.client_id}`).emit('trip_accepted', {
        tripId: trip.id,
        driver: { id: data.driverId, name: data.driverName }
      });
      console.log(`📡 [ACCEPT_TRIP] Cliente ${trip.client_id} notificado`);

      // Remove from global list - BUT NOT for the driver who accepted
      console.log(`📡 [ACCEPT_TRIP] Emitindo trip_taken para remover da lista global`);
      this.server.emit('trip_taken', { tripId: trip.id, acceptedBy: data.driverId });

      return { success: true };
    } catch (error) {
      console.error(`❌ [ACCEPT_TRIP] Erro:`, error.message);
      // If already accepted, notify driver
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('cancel_trip')
  async handleCancelTrip(@MessageBody() data: { tripId: string, userId?: string, role?: string }, @ConnectedSocket() client: Socket) {
    try {
      // Fetch trip first to validate cancellation rules
      const trip = await this.tripsService.findOne(data.tripId);

      if (!trip) {
        return { success: false, error: 'Trip not found' };
      }

      // Cancellation Rules:
      // - Client can cancel if status is 'requested' or 'accepted'
      // - Driver can cancel if status is 'accepted' (before starting)
      // - Nobody can cancel if status is 'ongoing' or 'completed'

      if (trip.status === 'ongoing') {
        return { success: false, error: 'Cannot cancel trip in progress' };
      }

      if (trip.status === 'completed' || trip.status === 'cancelled') {
        return { success: false, error: 'Trip already finished' };
      }

      // Perform cancellation
      const cancelledTrip = await this.tripsService.cancel(data.tripId);
      const isDriver = data.role === 'driver';

      // Notify driver
      if (cancelledTrip.driver_id) {
        if (isDriver) {
          this.server.to(`driver_${cancelledTrip.driver_id}`).emit('trip_cancelled_confirmed', { tripId: cancelledTrip.id });
        } else {
          this.server.to(`driver_${cancelledTrip.driver_id}`).emit('trip_cancelled', { tripId: cancelledTrip.id });
        }
      }

      // Notify client
      if (cancelledTrip.client_id) {
        if (!isDriver) {
          this.server.to(`client_${cancelledTrip.client_id}`).emit('trip_cancelled_confirmed', { tripId: cancelledTrip.id });
        } else {
          this.server.to(`client_${cancelledTrip.client_id}`).emit('trip_cancelled', { tripId: cancelledTrip.id });
        }
      }

      // Remove from global pending list
      this.server.emit('trip_cancelled_global', { tripId: cancelledTrip.id });

      return { success: true, tripId: cancelledTrip.id };
    } catch (error) {
      console.error('Cancel trip error:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('start_ride')
  async handleStartRide(@MessageBody() data: { tripId: string, clientId: string }) {
    await this.tripsService.start(data.tripId);
    this.server.to(`client_${data.clientId}`).emit('ride_started', { tripId: data.tripId });
  }

  @SubscribeMessage('finish_ride')
  async handleFinishRide(@MessageBody() data: { tripId: string, clientId: string, finalFare: string }) {
    await this.tripsService.finish(data.tripId, data.finalFare);
    this.server.to(`client_${data.clientId}`).emit('ride_finished', { tripId: data.tripId, finalFare: data.finalFare });
  }

  @SubscribeMessage('trip_progress')
  async handleTripProgress(@MessageBody() data: { tripId: string, clientId: string, currentFare: number, coords: { lat: number, lng: number } }) {
    // CRITICAL: Persist current fare in database
    // This ensures fare is not lost on disconnect/refresh
    await this.tripsService.updateFare(data.tripId, data.currentFare);

    // Real-time updates to client
    this.server.to(`client_${data.clientId}`).emit('trip_update', {
      currentFare: data.currentFare,
      coords: data.coords
    });
  }

  @SubscribeMessage('confirm_payment')
  async handleConfirmPayment(@MessageBody() data: { tripId: string, clientId: string, receiptData: any }) {
    // 1. Persist invoice in database
    const invoice = await this.tripsService.createInvoice(data.tripId);

    // 2. Driver confirms payment received, send updated receipt info to client
    this.server.to(`client_${data.clientId}`).emit('payment_confirmed', {
      receiptData: {
        ...data.receiptData,
        invoiceId: invoice.id
      }
    });
  }

  notifyNewTrip(formattedTrip: any) {
    console.log(`📢 Broadcasting new trip from external source: ${formattedTrip.id}`);
    this.server.emit('new_trip_available', formattedTrip);
  }
}
