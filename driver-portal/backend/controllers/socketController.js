const db = require('../db');

const SocketController = {
    // 1. JOIN LOGIC (RESTORE STATE)
    handleJoin: async (socket, io, data, activeUsers) => {
        const { userId, role } = data;
        const room = `${role}_${userId}`;
        socket.join(room);
        activeUsers.set(userId, { socketId: socket.id, role, room });
        console.log(`[${role.toUpperCase()}] Joined room: ${room}`);

        if (role === 'driver') {
            await SocketController.restoreDriverState(socket, userId);
        } else if (role === 'client') {
            await SocketController.restoreClientState(socket, userId);
        }
    },

    // 2. RESTORE DRIVER
    restoreDriverState: async (socket, driverId) => {
        try {
            // 1. Get current status from DB
            const driverResult = await db.query('SELECT is_online FROM drivers WHERE id = $1', [driverId]);
            const isOnline = driverResult.rows.length > 0 ? driverResult.rows[0].is_online : false;

            // 2. Emit current status (DO NOT FORCE TRUE)
            socket.emit('login_status', { isOnline });

            // 3. Restore trips ONLY if online or active
            const activeTrip = await db.query(`
                SELECT t.*, p.full_name as client_name, p.phone as client_phone 
                FROM trips t
                JOIN profiles p ON t.client_id = p.id
                WHERE t.driver_id = $1 
                ORDER BY t.created_at DESC LIMIT 1
            `, [driverId]);

            if (activeTrip.rows.length > 0) {
                const trip = activeTrip.rows[0];
                if (['accepted', 'ongoing'].includes(trip.status)) {
                    socket.emit('restore_ride', SocketController.formatTrip(trip));
                    return;
                }
            }

            // If no active trip, check for pending requests
            const pendingTrips = await db.query(`
                SELECT t.*, p.full_name as client_name 
                FROM trips t
                JOIN profiles p ON t.client_id = p.id
                WHERE t.status = 'requested'
                ORDER BY t.created_at DESC
            `);

            if (pendingTrips.rows.length > 0) {
                socket.emit('pending_trips', pendingTrips.rows);
            }

        } catch (err) {
            console.error('Error restoring driver:', err);
        }
    },

    // 3. RESTORE CLIENT (FIXED GHOST TRIP BUG)
    restoreClientState: async (socket, clientId) => {
        try {
            // Get the ABSOLUTE LATEST trip, regardless of status
            const latestTripResult = await db.query(`
                SELECT t.*, d.full_name as driver_name, d.id as driver_id
                FROM trips t
                LEFT JOIN profiles d ON t.driver_id = d.id
                WHERE t.client_id = $1
                ORDER BY t.created_at DESC LIMIT 1
            `, [clientId]);

            if (latestTripResult.rows.length > 0) {
                const trip = latestTripResult.rows[0];
                // Only restore if it is effectively 'live'
                if (['requested', 'accepted', 'ongoing'].includes(trip.status)) {
                    console.log(`Restoring client trip ${trip.id} (Status: ${trip.status})`);
                    socket.emit('restore_trip', trip);
                } else {
                    console.log(`Last trip ${trip.id} is ${trip.status}. Staying in idle.`);
                }
            }
        } catch (err) {
            console.error('Error restoring client:', err);
        }
    },

    // 4. REQUEST TRIP
    handleRequestTrip: async (socket, io, tripData) => {
        console.log('Requesting Trip:', tripData);
        try {
            const { clientId, originAddress, destAddress, price, originLat, originLng } = tripData;

            // Check for existing active trip first
            const activeCheck = await db.query(`
                SELECT id, status FROM trips 
                WHERE client_id = $1 
                ORDER BY created_at DESC LIMIT 1
            `, [clientId]);

            if (activeCheck.rows.length > 0) {
                const lastTrip = activeCheck.rows[0];
                if (['requested', 'accepted', 'ongoing'].includes(lastTrip.status)) {
                    console.warn(`Preventing duplicate trip. Client ${clientId} already has trip ${lastTrip.id}`);
                    // Simply restore the old one instead of creating new
                    const fullLastTrip = await db.query('SELECT * FROM trips WHERE id = $1', [lastTrip.id]);
                    socket.emit('restore_trip', fullLastTrip.rows[0]);
                    return;
                }
            }

            const result = await db.query(`
                INSERT INTO trips (client_id, origin_address, dest_address, estimated_fare, status, origin_lat, origin_lng)
                VALUES ($1, $2, $3, $4, 'requested', $5, $6)
                RETURNING id, created_at
            `, [clientId, originAddress, destAddress, price, originLat || 0, originLng || 0]);

            const newTrip = { ...tripData, id: result.rows[0].id };

            // Notify drivers and confirm to client
            io.emit('new_trip_available', newTrip);
            socket.emit('new_trip_available', newTrip); // Confirm to sender so they can save ID

        } catch (err) {
            console.error('Error creating trip:', err);
        }
    },

    // 5. HELPER: Format Trip
    formatTrip: (trip) => {
        return {
            id: trip.id,
            clientId: trip.client_id,
            userName: trip.client_name,
            pickupAddress: trip.origin_address,
            destAddress: trip.dest_address,
            price: trip.estimated_fare,
            status: trip.status,
            coords: { lat: trip.origin_lat, lng: trip.origin_lng },
            current_fare: trip.current_fare
        };
    },

    // 6. ACCEPT TRIP
    handleAcceptTrip: async (io, data) => {
        const { tripId, driverId, clientId, driverName } = data;
        try {
            await db.query(`
                UPDATE trips 
                SET driver_id = $1, status = 'accepted', accepted_at = NOW()
                WHERE id = $2
            `, [driverId, tripId]);

            console.log(`Driver ${driverId} accepted trip ${tripId}`);

            // Notify Client
            io.to(`client_${clientId}`).emit('trip_accepted', {
                tripId,
                driver: { id: driverId, name: driverName }
            });

            // Remove from global pending list
            io.emit('trip_taken', { tripId });

        } catch (err) {
            console.error('Error accepting trip:', err);
        }
    },

    // 7. CANCEL TRIP
    handleCancelTrip: async (io, data) => {
        const { tripId, reason } = data;
        console.log('Cancelling trip:', tripId);
        try {
            const tripResult = await db.query('SELECT driver_id FROM trips WHERE id = $1', [tripId]);

            if (tripResult.rows.length > 0) {
                const { driver_id } = tripResult.rows[0];
                await db.query("UPDATE trips SET status = 'cancelled' WHERE id = $1", [tripId]);

                if (driver_id) {
                    io.to(`driver_${driver_id}`).emit('trip_cancelled', { tripId });
                }
                io.emit('trip_cancelled_global', { tripId });
            }
        } catch (err) {
            console.error('Error cancelling trip:', err);
        }
    },

    // 8. START RIDE
    handleStartRide: async (io, data) => {
        const { tripId, clientId } = data;
        try {
            await db.query(`UPDATE trips SET status = 'ongoing', started_at = NOW() WHERE id = $1`, [tripId]);
            console.log(`Ride ${tripId} started`);
            io.to(`client_${clientId}`).emit('ride_started', { tripId });
        } catch (err) { }
    },

    // 9. PROGRESS
    handleTripProgress: async (io, data) => {
        const { clientId, tripId, coords, currentFare, distance, duration } = data;
        try {
            // Optional: Save to DB less frequently or use a rides_log table
            await db.query(`
                UPDATE trips 
                SET current_fare = $1, last_lat = $2, last_lng = $3 
                WHERE id = $4
            `, [currentFare, coords.lat, coords.lng, tripId]);
        } catch (e) { }

        io.to(`client_${clientId}`).emit('trip_update', { coords, currentFare, distance, duration });
    },

    // 10. FINISH RIDE
    handleFinishRide: async (io, data) => {
        const { tripId, clientId, finalFare } = data;
        try {
            await db.query(`
                UPDATE trips 
                SET status = 'completed', final_fare = $1, completed_at = NOW() 
                WHERE id = $2
            `, [finalFare, tripId]);
            io.to(`client_${clientId}`).emit('ride_finished', { tripId, finalFare });
        } catch (err) { }
    },

    // 11. CONFIRM PAYMENT
    handleConfirmPayment: async (io, data) => {
        const { tripId, clientId, receiptData } = data;
        try {
            await db.query(`
                INSERT INTO invoices (trip_id, user_id, amount, invoice_type)
                VALUES ($1, $2, $3, 'passenger_receipt')
            `, [tripId, clientId, receiptData.total]);
            io.to(`client_${clientId}`).emit('payment_confirmed', { tripId, receiptData });
        } catch (err) { }
    },

    // 12. TOGGLE ONLINE
    handleToggleOnline: async (data) => {
        const { userId, isOnline } = data;
        try {
            await db.query('UPDATE drivers SET is_online = $1 WHERE id = $2', [isOnline, userId]);
        } catch (e) { }
    }
};

module.exports = SocketController;
