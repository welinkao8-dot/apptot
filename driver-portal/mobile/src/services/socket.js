import io from 'socket.io-client';
import { API_URL } from '../context/AuthContext';

let socket = null;

export const connectSocket = (token) => {
    if (socket?.connected) return socket;

    socket = io(API_URL, {
        auth: { token },
        transports: ['websocket'],
        autoConnect: true,
    });

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
    }
};
