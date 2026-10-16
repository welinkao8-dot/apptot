const HERE_HOSTS = ['here.com', 'hereapi.com'];

export function shouldAllowHereMapNavigation(rawUrl) {
    if (typeof rawUrl !== 'string' || rawUrl.length === 0) return false;

    try {
        const url = new URL(rawUrl);
        if (url.protocol !== 'https:' || url.username || url.password) return false;

        return HERE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    } catch {
        return false;
    }
}
