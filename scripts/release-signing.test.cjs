const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projects = [
  ['client', 'client-portal/mobile/android/app/build.gradle'],
  ['driver', 'driver-portal/mobile/android/app/build.gradle'],
];

function blockAfter(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Expected ${marker} block`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  assert.fail(`Unclosed ${marker} block`);
}

for (const [name, gradlePath] of projects) {
  const source = fs.readFileSync(path.join(__dirname, '..', gradlePath), 'utf8');
  const signingConfigs = blockAfter(source, 'signingConfigs');
  const release = blockAfter(signingConfigs, 'release');

  test(`${name} release signing requires CI keystore inputs without debug fallback`, () => {
    for (const variable of [
      'ANDROID_KEYSTORE_FILE',
      'ANDROID_KEYSTORE_PASSWORD',
      'ANDROID_KEY_ALIAS',
      'ANDROID_KEY_PASSWORD',
    ]) {
      assert.ok(new RegExp(`System\\.getenv\\(["']${variable}["']\\)`).test(release), `${name} release config must read ${variable}`);
    }
    assert.ok(/GradleException/.test(source), `${name} Gradle script must fail with a clear release error`);
    assert.ok(/releaseSigningRequested/.test(source), `${name} Gradle script must validate release tasks`);
    assert.ok(/missingSigningVariables/.test(source) && /!missingSigningVariables\.isEmpty\(\)/.test(source), `${name} Gradle script must reject blank signing values`);
    assert.ok(/ANDROID_KEYSTORE_FILE.*isFile/.test(source), `${name} Gradle script must reject a missing keystore file`);
    assert.ok(!/debug\.keystore|androiddebugkey/.test(release), `${name} release config must not use debug signing`);
  });

  test(`${name} release build type uses the required release signing config`, () => {
    const releaseBuildType = blockAfter(blockAfter(source, 'buildTypes'), 'release');
    assert.ok(/signingConfig\s+signingConfigs\.release/.test(releaseBuildType), `${name} release build type must use release signing`);
  });

  test(`${name} debug build type keeps the Android debug signing config`, () => {
    const debugBuildType = blockAfter(blockAfter(source, 'buildTypes'), 'debug');
    assert.ok(/signingConfig\s+signingConfigs\.debug/.test(debugBuildType), `${name} debug build type must use debug signing`);
  });
}

test('client release workflow requires signing secrets and builds an AAB', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/client-mobile-apk.yml'), 'utf8');
  for (const value of [
    'ANDROID_KEYSTORE_BASE64_CLIENT',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD',
    'bundleRelease',
    'outputs/bundle/release/*.aab',
  ]) {
    assert.ok(workflow.includes(value), `Client release workflow must include ${value}`);
  }
  for (const variable of [
    'ANDROID_KEYSTORE_BASE64_CLIENT',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS_CLIENT',
    'ANDROID_KEY_PASSWORD',
  ]) {
    assert.ok(workflow.includes(`test -n "$${variable}"`), `Client workflow must check ${variable} before Gradle`);
  }
  assert.ok(workflow.includes(`printf '%s' "$ANDROID_KEYSTORE_BASE64_CLIENT" | base64 --decode`), 'Decode step must use the secret environment variable');
});

test('signing asset files are no longer tracked', () => {
  const tracked = execFileSync('git', [
    'ls-files',
    'client-release.keystore',
    'driver-release.keystore',
    'client_base64.txt',
    'driver_base64.txt',
  ], { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).trim();
  assert.equal(tracked, '', 'Release keystores and Base64 files must be untracked');
});

test('local release signing assets are ignored by Git', () => {
  const root = path.join(__dirname, '..');
  for (const asset of [
    'client-release.keystore',
    'driver-release.keystore',
    'client_base64.txt',
    'driver_base64.txt',
    'client-portal/mobile/android/app/release.keystore',
    'driver-portal/mobile/android/app/release.keystore',
  ]) {
    const result = require('node:child_process').spawnSync('git', ['check-ignore', '-q', asset], { cwd: root });
    assert.equal(result.status, 0, `${asset} must be ignored`);
  }
});

test('release guide names required secrets without embedding password values', () => {
  const guide = fs.readFileSync(path.join(__dirname, '..', 'RELEASE_SIGNING_GUIDE.md'), 'utf8');
  for (const variable of ['ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_PASSWORD']) {
    const rowHasInlineValue = new RegExp('\\|\\s*`' + variable + '`\\s*\\|\\s*[^|\\r\\n]*`[^`]+`');
    assert.ok(!rowHasInlineValue.test(guide), `Release guide must not include a literal for ${variable}`);
  }
});
