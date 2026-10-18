const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const backendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(backendRoot, '..');
const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
const migrationRoot = path.join(backendRoot, 'libs', 'database', 'prisma', 'migrations');
const documentMigrationName = '20261017130000_private_driver_documents';
const probePath = path.join(backendRoot, `.plan01-postgres-validation-${process.pid}-${crypto.randomBytes(3).toString('hex')}`);
const containerName = `tot-plan01-postgres-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
const password = `plan01test${crypto.randomBytes(10).toString('hex')}`;
function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { streamOutput = false, ...spawnOptions } = options;
    const child = spawn(command, args, { ...spawnOptions, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; if (streamOutput) process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { stderr += chunk; if (streamOutput) process.stderr.write(chunk); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, { ...options, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { code: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function requireSuccess(result, label) {
  if (result.code !== 0) throw new Error(`${label} failed (exit ${result.code}).\n${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const check = runSync('docker', ['exec', containerName, 'pg_isready', '-U', 'tot_test', '-d', 'tot_test']);
    if (check.code === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const logs = runSync('docker', ['logs', containerName]);
  throw new Error(`Temporary PostgreSQL did not become ready. ${logs.stderr || logs.stdout}`);
}

function psql(database, sql) {
  return runSync('docker', ['exec', containerName, 'psql', '-U', 'tot_test', '-d', database, '-tA', '-c', sql]);
}

async function resetDatabase(databaseUrl) {
  requireSuccess(runSync('docker', ['exec', containerName, 'psql', '-U', 'tot_test', '-d', 'postgres', '-c', 'DROP DATABASE IF EXISTS tot_test WITH (FORCE)']), 'Drop test database');
  requireSuccess(runSync('docker', ['exec', containerName, 'psql', '-U', 'tot_test', '-d', 'postgres', '-c', 'CREATE DATABASE tot_test']), 'Create test database');
  process.env.DATABASE_URL = databaseUrl;
}

async function prisma(args, env = process.env) {
  return runCapture(process.execPath, [prismaCli, ...args], { cwd: backendRoot, env });
}

async function migrateConcurrently(databaseUrl) {
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const args = [prismaCli, 'migrate', 'deploy', '--schema', 'libs/database/prisma/schema.prisma'];
  const runs = await Promise.all([
    runCapture(process.execPath, args, { cwd: backendRoot, env }),
    runCapture(process.execPath, args, { cwd: backendRoot, env }),
  ]);
  for (const [index, result] of runs.entries()) {
    if (result.code !== 0) throw new Error(`Concurrent migration process ${index + 1} failed.\n${result.stderr || result.stdout}`);
  }
}

function buildDataUri(mimeType, bytes) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

function seedLegacyDriver(database, docs) {
  const id = '00000000-0000-4000-8000-000000000001';
  const values = [docs.front, docs.back, docs.license].map((value) => `'${value}'`).join(',');
  const sql = `INSERT INTO drivers(id, full_name, phone, status, doc_bi_frente, doc_bi_verso, doc_carta_conducao) VALUES('${id}','Migration Probe','+244900000001','pending',${values})`;
  requireSuccess(psql(database, sql), 'Seed legacy document test row');
  return id;
}

async function preparePreDocumentMigrationSchema() {
  const migrationProbe = path.join(probePath, 'pre-document');
  fs.mkdirSync(path.join(migrationProbe, 'migrations'), { recursive: true });
  for (const entry of fs.readdirSync(migrationRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== documentMigrationName) {
      const destination = path.join(migrationProbe, 'migrations', entry.name);
      fs.mkdirSync(destination, { recursive: true });
      fs.copyFileSync(path.join(migrationRoot, entry.name, 'migration.sql'), path.join(destination, 'migration.sql'));
    } else if (entry.isFile() && entry.name === 'migration_lock.toml') {
      fs.copyFileSync(path.join(migrationRoot, entry.name), path.join(migrationProbe, 'migrations', entry.name));
    }
  }
  fs.writeFileSync(path.join(migrationProbe, 'schema.prisma'), [
    'datasource db {',
    '  provider = "postgresql"',
    '  url      = env("DATABASE_URL")',
    '}',
    '',
  ].join('\n'));
  return path.join(migrationProbe, 'schema.prisma');
}

async function applyPreDocumentMigrations(schemaPath, databaseUrl) {
  const result = await prisma(['migrate', 'deploy', '--schema', schemaPath], { ...process.env, DATABASE_URL: databaseUrl });
  requireSuccess(result, 'Apply migrations before private document conversion');
}

async function validateMigrationBackfill(databaseUrl) {
  const preDocumentSchema = await preparePreDocumentMigrationSchema();
  await resetDatabase(databaseUrl);
  await applyPreDocumentMigrations(preDocumentSchema, databaseUrl);
  const driverId = seedLegacyDriver('tot_test', {
    front: buildDataUri('image/jpeg', [0xff, 0xd8, 0xff]),
    back: buildDataUri('image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    license: buildDataUri('image/webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
  });
  const result = await prisma(['migrate', 'deploy', '--schema', 'libs/database/prisma/schema.prisma'], { ...process.env, DATABASE_URL: databaseUrl });
  requireSuccess(result, 'Apply private document migration with valid legacy files');
  const rows = requireSuccess(psql('tot_test', `SELECT string_agg(document_type || ':' || mime_type || ':' || size_bytes::text, ',' ORDER BY document_type) FROM driver_documents WHERE driver_id = '${driverId}'`), 'Read migration metadata');
  const legacyColumns = requireSuccess(psql('tot_test', "SELECT count(*) FROM information_schema.columns WHERE table_name = 'drivers' AND column_name IN ('doc_bi_frente','doc_bi_verso','doc_carta_conducao')"), 'Check old document columns');
  assert.equal(rows, 'bi_frente:image/jpeg:3,bi_verso:image/png:8,carta:image/webp:12');
  assert.equal(legacyColumns, '0');
}

async function validateInvalidLegacyDocumentRollsBack(databaseUrl) {
  const preDocumentSchema = path.join(probePath, 'pre-document', 'schema.prisma');
  await resetDatabase(databaseUrl);
  await applyPreDocumentMigrations(preDocumentSchema, databaseUrl);
  const invalidId = seedLegacyDriver('tot_test', {
    front: 'data:image/jpeg;base64,not-valid!',
    back: buildDataUri('image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    license: buildDataUri('image/webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
  });
  const result = await prisma(['migrate', 'deploy', '--schema', 'libs/database/prisma/schema.prisma'], { ...process.env, DATABASE_URL: databaseUrl });
  assert.notEqual(result.code, 0, 'malformed legacy images should stop the migration instead of being silently discarded');
  const legacyColumns = requireSuccess(psql('tot_test', "SELECT count(*) FROM information_schema.columns WHERE table_name = 'drivers' AND column_name IN ('doc_bi_frente','doc_bi_verso','doc_carta_conducao')"), 'Verify rollback kept source columns');
  const retained = requireSuccess(psql('tot_test', `SELECT doc_bi_frente FROM drivers WHERE id = '${invalidId}'`), 'Verify rollback kept source document');
  assert.equal(legacyColumns, '3');
  assert.equal(retained, 'data:image/jpeg;base64,not-valid!');
}

async function generateTemporaryTestClient() {
  const clientFolder = path.join(probePath, 'client');
  fs.mkdirSync(clientFolder, { recursive: true });
  const schema = fs.readFileSync(path.join(backendRoot, 'libs', 'database', 'prisma', 'schema.prisma'), 'utf8');
  const modified = schema.replace(
    /generator client\s*\{[\s\S]*?\n\}/,
    'generator client {\n  provider = "prisma-client-js"\n  output = "./generated"\n  engineType = "library"\n  binaryTargets = ["native"]\n}',
  );
  assert.notEqual(modified, schema, 'Could not prepare the temporary Prisma Client schema.');
  const schemaPath = path.join(clientFolder, 'schema.prisma');
  fs.writeFileSync(schemaPath, modified);
  const generated = await prisma(['generate', '--schema', schemaPath], process.env);
  requireSuccess(generated, 'Generate temporary Prisma Client for real PostgreSQL service tests');
  return path.join(clientFolder, 'generated');
}

async function main() {
  if (!fs.existsSync(prismaCli)) throw new Error('Install backend-monorepo dependencies before running PostgreSQL validation.');
  fs.mkdirSync(probePath, { recursive: false });
  const resolvedProbe = path.resolve(probePath);
  if (!resolvedProbe.startsWith(`${backendRoot}${path.sep}`)) throw new Error('Temporary validation path escaped backend-monorepo.');

  let containerStarted = false;
  try {
    requireSuccess(runSync('docker', [
      'run', '-d', '--name', containerName,
      '-e', 'POSTGRES_DB=tot_test', '-e', 'POSTGRES_USER=tot_test', '-e', `POSTGRES_PASSWORD=${password}`,
      '-p', '127.0.0.1::5432', 'postgres:15-alpine',
    ]), 'Start isolated PostgreSQL 15 test container');
    containerStarted = true;
    const portText = requireSuccess(runSync('docker', ['port', containerName, '5432/tcp']), 'Read temporary PostgreSQL port');
    const port = Number(/:(\d+)/.exec(portText)?.[1]);
    assert(Number.isInteger(port) && port > 0, 'Docker did not return a local PostgreSQL port.');
    await waitForPostgres();
    const databaseUrl = `postgresql://tot_test:${password}@127.0.0.1:${port}/tot_test?schema=public`;

    await migrateConcurrently(databaseUrl);
    const status = await prisma(['migrate', 'status', '--schema', 'libs/database/prisma/schema.prisma'], { ...process.env, DATABASE_URL: databaseUrl });
    requireSuccess(status, 'Check concurrently migrated database status');

    await validateMigrationBackfill(databaseUrl);
    await validateInvalidLegacyDocumentRollsBack(databaseUrl);

    await resetDatabase(databaseUrl);
    const fullDeploy = await prisma(['migrate', 'deploy', '--schema', 'libs/database/prisma/schema.prisma'], { ...process.env, DATABASE_URL: databaseUrl });
    requireSuccess(fullDeploy, 'Deploy all migrations for the API concurrency test');
    const testClientPath = await generateTemporaryTestClient();
    const concurrency = await runCapture(process.execPath, [
      '-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'scripts/plan01-postgres-concurrency.cjs',
    ], {
      cwd: backendRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PLAN01_TEST_CLIENT_PATH: testClientPath,
        PLAN01_TRACE_PATH: path.join(probePath, 'concurrency-trace.log'),
        NODE_ENV: 'test',
      },
      streamOutput: true,
    });
    requireSuccess(concurrency, 'Real PostgreSQL API concurrency test');

    console.log('Plan 01 PostgreSQL 15 validation passed: concurrent migration deploy, safe legacy document backfill/rollback, real trip/payment concurrency.');
    console.log(concurrency.stdout.trim());
  } finally {
    delete process.env.DATABASE_URL;
    delete process.env.PLAN01_TEST_CLIENT_PATH;
    if (containerStarted) runSync('docker', ['rm', '-f', containerName]);
    fs.rmSync(probePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
