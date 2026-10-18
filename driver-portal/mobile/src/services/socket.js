import io from 'socket.io-client';
import mobileUrls from '../config/mobileUrls';

export const SOCKET_URL = mobileUrls.getMobileUrl(process.env.TOT_DRIVER_SOCKET_URL, 'https://driver-api.taxitot.com');

let socket = null;
let socketToken = null;

export const connectSocket = (token) => {
    if (socket && socketToken === token) {
        if (!socket.connected) socket.connect();
        return socket;
    }

    if (socket) socket.disconnect();

    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        autoConnect: true,
    });
    socketToken = token;

    socket.on('connect', () => {
        console.log('✅ Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
    });

    return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        socketToken = null;
    }
};
