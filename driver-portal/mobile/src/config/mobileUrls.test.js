import { getMobileUrl, validateReleaseUrl } from './mobileUrls';
const babel = require('@babel/core');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const inlineMobileEnvironment = require('../../scripts/inline-mobile-env');

describe('driver mobile URLs', () => {
    test('uses the local development URL when no environment URL is configured', () => {
        expect(getMobileUrl('', 'http://localhost:3004')).toBe('http://localhost:3004');
    });

    test('uses a configured HTTPS host', () => {
        expect(getMobileUrl('https://driver-api.example.com', 'http://localhost:3004')).toBe('https://driver-api.example.com');
    });

    test('rejects a missing release URL', () => {
        expect(() => validateReleaseUrl('', 'TOT_DRIVER_API_URL')).toThrow(/TOT_DRIVER_API_URL/);
    });

    test.each(['http://driver-api.example.com', 'http://localhost:3004', 'https://127.0.0.1:3004', 'https:///missing-host'])('rejects insecure or local release URL %s', (url) => {
        expect(() => validateReleaseUrl(url, 'TOT_DRIVER_API_URL')).toThrow(/HTTPS/);
    });

    test('accepts a public HTTPS release host', () => {
        expect(validateReleaseUrl('https://driver-api.example.com', 'TOT_DRIVER_API_URL')).toBe('https://driver-api.example.com');
    });

    test.each(['https://driver-api.example.com.', 'https://localhost%2eexample.com/'])('rejects ambiguous release hostname %s', (url) => {
        expect(() => validateReleaseUrl(url, 'TOT_DRIVER_API_URL')).toThrow(/public domain/);
    });

    test('guards release variants in the resolved Gradle task graph', () => {
        const gradlePath = path.resolve(__dirname, '../../android/app/build.gradle');
        const buildConfig = fs.readFileSync(gradlePath, 'utf8');
        expect(buildConfig).toMatch(/gradle\.taskGraph\.whenReady/);
        expect(buildConfig).toMatch(/taskGraph\.allTasks\.any/);
        expect(buildConfig).not.toMatch(/gradle\.startParameter\.taskNames/);
    });

    test('embeds configured API endpoints in the JavaScript bundle', () => {
        const previousValue = process.env.TOT_DRIVER_API_URL;
        process.env.TOT_DRIVER_API_URL = 'https://driver-api.example.com';

        try {
            const result = babel.transformSync('process.env.TOT_DRIVER_API_URL', {
                configFile: false,
                babelrc: false,
                plugins: [[inlineMobileEnvironment, { keys: ['TOT_DRIVER_API_URL'] }]],
            });
            expect(result.code).toBe('"https://driver-api.example.com";');
        } finally {
            if (previousValue === undefined) delete process.env.TOT_DRIVER_API_URL;
            else process.env.TOT_DRIVER_API_URL = previousValue;
        }
    });

    test('production Babel configuration rejects missing release endpoint', () => {
        const configPath = path.resolve(__dirname, '../../babel.config.js');
        expect(() => execFileSync(process.execPath, ['-e', `require(${JSON.stringify(configPath)})`], {
            env: { ...process.env, NODE_ENV: 'production', TOT_DRIVER_API_URL: '' },
            stdio: 'pipe',
        })).toThrow(/TOT_DRIVER_API_URL/);
    });

    test('production Babel configuration accepts a configured HTTPS endpoint', () => {
        const configPath = path.resolve(__dirname, '../../babel.config.js');
        expect(() => execFileSync(process.execPath, ['-e', `require(${JSON.stringify(configPath)})`], {
            env: { ...process.env, NODE_ENV: 'production', TOT_DRIVER_API_URL: 'https://driver-api.example.com' },
            stdio: 'pipe',
        })).not.toThrow();
    });

    test('test APK workflow scopes the Mapbox secret to the Gradle build step', () => {
        const workflow = fs.readFileSync(path.resolve(__dirname, '../../../../.github/workflows/mobile-test-apks.yml'), 'utf8');
        expect(workflow).toMatch(/TOT_DRIVER_API_URL:\s*\$\{\{ vars\.TOT_DRIVER_API_URL \}\}/);
        expect(workflow).toMatch(/validateReleaseUrl\(process\.env\.TOT_DRIVER_API_URL, ["']TOT_DRIVER_API_URL["']\)/);
        const driverJob = workflow.split('  build-driver-apk:')[1].split('\n  build-')[0];
        expect(driverJob).not.toMatch(/^\s{6}MAPBOX_DOWNLOADS_TOKEN:/m);
        expect(driverJob).toMatch(/ORG_GRADLE_PROJECT_MAPBOX_DOWNLOADS_TOKEN:\s*\$\{\{ secrets\.MAPBOX_DOWNLOADS_TOKEN \}\}/);
        expect(driverJob).toMatch(/test -n "\$ORG_GRADLE_PROJECT_MAPBOX_DOWNLOADS_TOKEN"/);
        expect(driverJob).not.toMatch(/-PMAPBOX_DOWNLOADS_TOKEN=/);
    });
});
