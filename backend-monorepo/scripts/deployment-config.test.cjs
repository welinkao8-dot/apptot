const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = join(__dirname, '..', '..');
const compose = readFileSync(join(root, 'docker-compose.prod.yml'), 'utf8');
const dockerfiles = ['backend.Dockerfile', 'admin.Dockerfile', 'client.Dockerfile', 'driver.Dockerfile']
  .map(file => readFileSync(join(root, file), 'utf8'));

test('production Compose requires credentials and starts compiled API entrypoints', () => {
  for (const variable of ['DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME', 'DATABASE_URL', 'JWT_SECRET', 'INTERNAL_SERVICE_TOKEN', 'ALLOWED_ORIGINS']) {
    assert.match(compose, new RegExp(`\\$\\{${variable}:\\?`));
  }
  for (const app of ['admin-api', 'client-api', 'driver-api']) {
    assert.match(compose, new RegExp(`\\[\\"node\\", \\"dist/apps/${app}/main\\.js\\"\\]`));
  }
  assert.match(compose, /condition: service_healthy/);
  assert.match(compose, /profile[s]?: \["migrations"\]/);
  assert.doesNotMatch(`${compose}\n${dockerfiles.join('\n')}`, /db push|accept-data-loss|nest start/);
});

test('HERE map key is injected into browser builds separately from private routing key', () => {
  const clientApi = compose.match(/  client-api:\n([\s\S]*?)(?=\n  [a-z][a-z-]*:|\nvolumes:)/)?.[1] || '';
  const clientPortal = compose.match(/  client-portal:\n([\s\S]*?)(?=\n  [a-z][a-z-]*:|\nvolumes:)/)?.[1] || '';
  const driverPortal = compose.match(/  driver-portal:\n([\s\S]*?)(?=\n  [a-z][a-z-]*:|\nvolumes:)/)?.[1] || '';

  assert.match(clientApi, /HERE_ROUTING_API_KEY: \$\{HERE_ROUTING_API_KEY:\?HERE_ROUTING_API_KEY is required for quotes\}/);
  assert.match(clientApi, /HERE_MAP_API_KEY: \$\{HERE_MAP_API_KEY:\?HERE_MAP_API_KEY is required for browser maps\}/);
  for (const portal of [clientPortal, driverPortal]) {
    assert.match(portal, /VITE_HERE_API_KEY: \$\{HERE_MAP_API_KEY:\?HERE_MAP_API_KEY is required for browser maps\}/);
    assert.doesNotMatch(portal, /HERE_ROUTING_API_KEY|\$\{HERE_API_KEY\}/);
  }
});

test('API images install the backend lockfile and default to compiled Node entrypoints', () => {
  for (const [index, dockerfile] of dockerfiles.entries()) {
    assert.match(dockerfile, /npm ci/);
    assert.match(dockerfile, /USER node/);
    const app = ['admin-api', 'admin-api', 'client-api', 'driver-api'][index];
    assert.match(dockerfile, new RegExp(`CMD \\[\\"node\\", \\"dist/apps/${app}/main\\.js\\"\\]`));
  }
});
