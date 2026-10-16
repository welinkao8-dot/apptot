const IPV4_ADDRESS = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function getMobileUrl(configuredUrl, developmentUrl) {
    return configuredUrl?.trim() || developmentUrl;
}

function validateReleaseUrl(value, variableName) {
    const candidate = value?.trim();
    const allowedProtocols = variableName === 'TOT_CLIENT_SOCKET_URL' ? ['https:', 'wss:'] : ['https:'];
    const rawAuthority = candidate?.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1] || '';
    let url;

    try {
        url = new URL(candidate);
    } catch {
        throw new Error(`${variableName} must be a valid ${allowedProtocols.join(' or ').replace(':', '').toUpperCase()} URL with a public domain`);
    }

    const hostname = url.hostname.toLowerCase();
    const isLocalHost = hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local');
    const isIpAddress = IPV4_ADDRESS.test(hostname) || hostname.startsWith('[');
    const hasTrailingDot = hostname.endsWith('.');
    const hasEncodedAuthority = rawAuthority.includes('%');

    if (!allowedProtocols.includes(url.protocol) || !url.host || !hostname.includes('.') || hasTrailingDot || hasEncodedAuthority || isLocalHost || isIpAddress || url.username || url.password) {
        throw new Error(`${variableName} must be a valid ${allowedProtocols.join(' or ').replace(':', '').toUpperCase()} URL with a public domain`);
    }

    return candidate;
}

module.exports = { getMobileUrl, validateReleaseUrl };
