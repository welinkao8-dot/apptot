import { io } from 'socket.io-client';

// Configuração padrão para USB (adb reverse tcp:3004 tcp:3004)
export const SOCKET_URL = 'http://localhost:3004';

const socket = io(SOCKET_URL, {
    autoConnect: false,
});

export default socket;
