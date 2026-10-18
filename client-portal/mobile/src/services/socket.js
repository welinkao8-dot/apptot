import { io } from 'socket.io-client';
import mobileUrls from '../config/mobileUrls';

// O Socket.IO do cliente é servido pela Driver API; produção é o fallback também em debug.
export const SOCKET_URL = mobileUrls.getMobileUrl(process.env.TOT_CLIENT_SOCKET_URL, 'https://driver-api.taxitot.com');

const socket = io(SOCKET_URL, {
    autoConnect: false,
});

export const setSocketToken = (token) => {
    socket.auth = { token };
};

export default socket;
