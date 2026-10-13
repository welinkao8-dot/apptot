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

test('API images install the backend lockfile and default to compiled Node entrypoints', () => {
  for (const [index, dockerfile] of dockerfiles.entries()) {
    assert.match(dockerfile, /npm ci/);
    assert.match(dockerfile, /USER node/);
    const app = ['admin-api', 'admin-api', 'client-api', 'driver-api'][index];
    assert.match(dockerfile, new RegExp(`CMD \\[\\"node\\", \\"dist/apps/${app}/main\\.js\\"\\]`));
  }
});
