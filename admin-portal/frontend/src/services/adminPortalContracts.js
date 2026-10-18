import { bindAdminSocketAuth as bindSocketAuth } from './adminAuthSession.js'

export function getAdminSocketOptions(getToken) {
    return {
        auth: callback => callback({ token: typeof getToken === 'function' ? getToken() : getToken }),
    };
}

export function bindAdminDashboardEvents(socket, handlers) {
    let hasConnected = false;
    const handleConnect = () => {
        if (hasConnected) handlers.onReconnected?.();
        else hasConnected = true;
    };
    const subscriptions = [
        ['driver_status_updated', handlers.onDriverStatusUpdated],
        ['pricing_updated', handlers.onPricingUpdated],
    ].filter(([, handler]) => typeof handler === 'function');

    subscriptions.forEach(([event, handler]) => socket.on(event, handler));
    if (typeof handlers.onReconnected === 'function') socket.on('connect', handleConnect);
    return () => {
        subscriptions.forEach(([event, handler]) => socket.off(event, handler));
        if (typeof handlers.onReconnected === 'function') socket.off('connect', handleConnect);
    };
}

export function bindAdminSocketAuth(socket, onAuthExpired) {
    return bindSocketAuth(socket, onAuthExpired)
}

export function hasReceiptFile(url) {
    return typeof url === 'string' && url.trim().length > 0;
}
