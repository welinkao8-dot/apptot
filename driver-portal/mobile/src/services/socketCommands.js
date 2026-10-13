export function emitSocketCommand(socket, event, payload, timeoutMs = 8000) {
    if (!socket?.connected) {
        return Promise.reject(Object.assign(new Error('Sem ligação ao servidor.'), { code: 'SOCKET_DISCONNECTED' }));
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            settled = true;
            reject(Object.assign(new Error('O servidor não confirmou a operação.'), { code: 'ACK_TIMEOUT' }));
        }, timeoutMs);
        socket.emit(event, payload, (response) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (response?.success) resolve(response);
            else reject(Object.assign(new Error(response?.error || 'Operação recusada pelo servidor.'), { code: 'SERVER_REJECTED' }));
        });
    });
}
