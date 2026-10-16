const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function toSafeErrorLog(error) {
  const responseStatus = Number(error?.response?.status);
  const hasRequestContext = Boolean(error?.config || error?.response || error?.request);

  if (hasRequestContext) {
    const rawUrl = typeof error?.config?.url === 'string' ? error.config.url : '';
    const endpoint = rawUrl
      .replace(/^https?:\/\/[^/]+/i, '')
      .split(/[?#]/, 1)[0]
      .replace(UUID_PATTERN, ':id')
      .replace(/\/\d+(?=\/|$)/g, '/:id');
    const method = typeof error?.config?.method === 'string' ? error.config.method.toUpperCase() : undefined;
    const code = typeof error?.code === 'string' && /^[A-Z0-9_-]{1,40}$/i.test(error.code) ? error.code : undefined;
    const status = Number.isInteger(responseStatus) && responseStatus > 0 ? responseStatus : undefined;

    return {
      name: error?.name === 'AxiosError' ? 'AxiosError' : 'RequestError',
      message: status ? `HTTP ${status}` : 'Request failed',
      ...(code ? { code } : {}),
      ...(method ? { method } : {}),
      ...(endpoint ? { endpoint } : {}),
      ...(status ? { status } : {}),
    };
  }

  const rawMessage = typeof error?.message === 'string' ? error.message : 'Unexpected error';
  const message = rawMessage
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-token]')
    .slice(0, 200);

  return { name: typeof error?.name === 'string' ? error.name : 'Error', message };
}
