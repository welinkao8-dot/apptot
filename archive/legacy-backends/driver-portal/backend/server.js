const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const activeUsers = new Map(); // userId -> socketId
const db = require('./db');
const SocketController = require('./controllers/socketController');

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // DELEGATE ALL EVENTS TO CONTROLLER
    socket.on('join', (data) => SocketController.handleJoin(socket, io, data, activeUsers));
    socket.on('request_trip', (data) => SocketController.handleRequestTrip(socket, io, data));
    socket.on('accept_trip', (data) => SocketController.handleAcceptTrip(io, data));
    socket.on('cancel_trip', (data) => SocketController.handleCancelTrip(io, data));
    socket.on('start_ride', (data) => SocketController.handleStartRide(io, data));
    socket.on('trip_progress', (data) => SocketController.handleTripProgress(io, data));
    socket.on('finish_ride', (data) => SocketController.handleFinishRide(io, data));
    socket.on('confirm_payment', (data) => SocketController.handleConfirmPayment(io, data));
    socket.on('toggle_online', (data) => SocketController.handleToggleOnline(data));

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('TOT HUB is active');
});

const PORT = 3004;
server.listen(PORT, () => {
    console.log(`TOT HUB running on port ${PORT}`);
});
