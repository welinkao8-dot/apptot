import { io } from 'socket.io-client';
import mobileUrls from '../config/mobileUrls';

// Fallback local apenas para debug com adb reverse; produção recebe URL do workflow.
export const SOCKET_URL = mobileUrls.getMobileUrl(process.env.TOT_CLIENT_SOCKET_URL, __DEV__ ? 'http://localhost:3004' : '');

const socket = io(SOCKET_URL, {
    autoConnect: false,
});

export const setSocketToken = (token) => {
    socket.auth = { token };
};

export default socket;
