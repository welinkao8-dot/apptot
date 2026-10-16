type OriginCallback = (error: Error | null, allowed?: boolean) => void;

export interface CorsPolicy {
  origin: (origin: string | undefined, callback: OriginCallback) => void;
  credentials: true;
  methods: string;
}

const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3004',
  'http://localhost:5173',
  'http://localhost:5175',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3004',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5175',
];

function parseOrigins(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean).map(item => {
    if (item === '*') throw new Error('ALLOWED_ORIGINS não pode usar wildcard com credenciais.');
    let parsed: URL;
    try {
      parsed = new URL(item);
    } catch {
      throw new Error(`ALLOWED_ORIGINS contém uma origem inválida: ${item}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password
      || !['', '/'].includes(parsed.pathname) || parsed.search || parsed.hash) {
      throw new Error(`ALLOWED_ORIGINS deve conter origens HTTP(S), sem caminho: ${item}`);
    }
    return parsed.origin;
  });
}

export function getCorsPolicy(env: Record<string, string | undefined> = process.env): CorsPolicy {
  const configured = parseOrigins(env.ALLOWED_ORIGINS ?? '');
  const isProduction = env.NODE_ENV === 'production';
  if (isProduction && configured.length === 0) {
    throw new Error('ALLOWED_ORIGINS é obrigatório em produção.');
  }
  const allowedOrigins = new Set(configured.length ? configured : DEVELOPMENT_ORIGINS);

  return {
    origin: (origin, callback) => {
      // Native apps and service-to-service requests commonly omit Origin.
      if (origin === undefined) return callback(null, true);
      callback(null, allowedOrigins.has(origin));
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  };
}
