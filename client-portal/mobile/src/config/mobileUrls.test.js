import { getMobileUrl, validateReleaseUrl } from './mobileUrls';
const babel = require('@babel/core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const inlineMobileEnvironment = require('../../scripts/inline-mobile-env');

describe('client mobile URLs', () => {
    test('uses the local development URL when no environment URL is configured', () => {
        expect(getMobileUrl('', 'http://localhost:3001')).toBe('http://localhost:3001');
    });

    test('uses a configured HTTPS host', () => {
        expect(getMobileUrl('https://api.example.com', 'http://localhost:3001')).toBe('https://api.example.com');
    });

    test('rejects a missing release URL', () => {
        expect(() => validateReleaseUrl('', 'TOT_CLIENT_API_URL')).toThrow(/TOT_CLIENT_API_URL/);
    });

    test.each(['http://api.example.com', 'http://localhost:3001', 'https://localhost:3001', 'https:///missing-host'])('rejects insecure or local release URL %s', (url) => {
        expect(() => validateReleaseUrl(url, 'TOT_CLIENT_API_URL')).toThrow(/HTTPS/);
    });

    test.each([
        'https://localhost./',
        'https://service.local./',
        'https://service.localhost./',
        'https://localhost%2e/',
        'https://localhost%2eexample.com/',
        'https://127.0.0.1/',
        'https://[::1]/',
        'https://user:password@api.example.com/',
    ])('rejects normalized or non-public host URL %s', (url) => {
        expect(() => validateReleaseUrl(url, 'TOT_CLIENT_API_URL')).toThrow(/public domain/);
    });

    test.each(['https://api.example.com.', 'https://api.example.com'])('accepts only non-trailing-dot public hostnames (%s)', (url) => {
        if (url.endsWith('.')) {
            expect(() => validateReleaseUrl(url, 'TOT_CLIENT_API_URL')).toThrow(/public domain/);
        } else {
            expect(validateReleaseUrl(url, 'TOT_CLIENT_API_URL')).toBe(url);
        }
    });

    test('allows secure public URLs for the socket and rejects localhost variants there too', () => {
        expect(validateReleaseUrl('wss://socket.example.com', 'TOT_CLIENT_SOCKET_URL')).toBe('wss://socket.example.com');
        expect(() => validateReleaseUrl('wss://localhost%2e/', 'TOT_CLIENT_SOCKET_URL')).toThrow(/public domain/);
    });

    test('accepts a public HTTPS release host', () => {
        expect(validateReleaseUrl('https://api.example.com', 'TOT_CLIENT_API_URL')).toBe('https://api.example.com');
    });

    test('accepts a public WSS URL for the release socket endpoint', () => {
        expect(validateReleaseUrl('wss://socket.example.com', 'TOT_CLIENT_SOCKET_URL')).toBe('wss://socket.example.com');
    });

    test('does not allow WSS for the release API endpoint', () => {
        expect(() => validateReleaseUrl('wss://api.example.com', 'TOT_CLIENT_API_URL')).toThrow(/HTTPS/);
    });

    test('embeds configured API endpoints in the JavaScript bundle', () => {
        const previousValue = process.env.TOT_CLIENT_API_URL;
        process.env.TOT_CLIENT_API_URL = 'https://api.example.com';

        try {
            const result = babel.transformSync('process.env.TOT_CLIENT_API_URL', {
                configFile: false,
                babelrc: false,
                plugins: [[inlineMobileEnvironment, { keys: ['TOT_CLIENT_API_URL'] }]],
            });
            expect(result.code).toBe('"https://api.example.com";');
        } finally {
            if (previousValue === undefined) delete process.env.TOT_CLIENT_API_URL;
            else process.env.TOT_CLIENT_API_URL = previousValue;
        }
    });

    test('production Babel configuration rejects missing release endpoints', () => {
        const configPath = path.resolve(__dirname, '../../babel.config.js');
        expect(() => execFileSync(process.execPath, ['-e', `require(${JSON.stringify(configPath)})`], {
            env: { ...process.env, NODE_ENV: 'production', TOT_CLIENT_API_URL: '', TOT_CLIENT_SOCKET_URL: '' },
            stdio: 'pipe',
        })).toThrow(/TOT_CLIENT_API_URL/);
    });

    test('production Babel configuration accepts configured HTTPS endpoints', () => {
        const configPath = path.resolve(__dirname, '../../babel.config.js');
        expect(() => execFileSync(process.execPath, ['-e', `require(${JSON.stringify(configPath)})`], {
            env: {
                ...process.env,
                NODE_ENV: 'production',
                TOT_CLIENT_API_URL: 'https://api.example.com',
                TOT_CLIENT_SOCKET_URL: 'https://socket.example.com',
            },
            stdio: 'pipe',
        })).not.toThrow();
    });

    test('production Babel configuration accepts a secure WSS socket endpoint', () => {
        const configPath = path.resolve(__dirname, '../../babel.config.js');
        expect(() => execFileSync(process.execPath, ['-e', `require(${JSON.stringify(configPath)})`], {
            env: {
                ...process.env,
                NODE_ENV: 'production',
                TOT_CLIENT_API_URL: 'https://api.example.com',
                TOT_CLIENT_SOCKET_URL: 'wss://socket.example.com',
            },
            stdio: 'pipe',
        })).not.toThrow();
    });

    test('does not inline arbitrary environment secrets', () => {
        const previousValue = process.env.TOT_CLIENT_SECRET;
        process.env.TOT_CLIENT_SECRET = 'do-not-bundle-this';

        try {
            const result = babel.transformSync('process.env.TOT_CLIENT_SECRET', {
                configFile: false,
                babelrc: false,
                plugins: [[inlineMobileEnvironment, { keys: ['TOT_CLIENT_API_URL', 'TOT_CLIENT_SOCKET_URL'] }]],
            });
            expect(result.code).not.toContain('do-not-bundle-this');
            expect(result.code).toContain('process.env.TOT_CLIENT_SECRET');
        } finally {
            if (previousValue === undefined) delete process.env.TOT_CLIENT_SECRET;
            else process.env.TOT_CLIENT_SECRET = previousValue;
        }
    });

    test('test APK workflow validates both remotely configured endpoints before building', () => {
        const workflow = fs.readFileSync(path.resolve(__dirname, '../../../../.github/workflows/mobile-test-apks.yml'), 'utf8');
        expect(workflow).toMatch(/TOT_CLIENT_API_URL:\s*\$\{\{ vars\.TOT_CLIENT_API_URL \}\}/);
        expect(workflow).toMatch(/TOT_CLIENT_SOCKET_URL:\s*\$\{\{ vars\.TOT_CLIENT_SOCKET_URL \}\}/);
        expect(workflow).toMatch(/validateReleaseUrl\(process\.env\.TOT_CLIENT_API_URL, ["']TOT_CLIENT_API_URL["']\)/);
        expect(workflow).toMatch(/validateReleaseUrl\(process\.env\.TOT_CLIENT_SOCKET_URL, ["']TOT_CLIENT_SOCKET_URL["']\)/);
    });
});
