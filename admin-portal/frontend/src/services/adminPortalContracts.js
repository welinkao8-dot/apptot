import { bindAdminSocketAuth as bindSocketAuth } from './adminAuthSession.js'

export function getAdminSocketOptions(token) {
    return { auth: { token } };
}

export function bindAdminDashboardEvents(socket, handlers) {
    const subscriptions = [
        ['driver_status_updated', handlers.onDriverStatusUpdated],
        ['pricing_updated', handlers.onPricingUpdated],
    ].filter(([, handler]) => typeof handler === 'function');

    subscriptions.forEach(([event, handler]) => socket.on(event, handler));
    return () => subscriptions.forEach(([event, handler]) => socket.off(event, handler));
}

export function bindAdminSocketAuth(socket, onAuthExpired) {
    return bindSocketAuth(socket, onAuthExpired)
}

export function hasReceiptFile(url) {
    return typeof url === 'string' && url.trim().length > 0;
}
