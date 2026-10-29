// Optional live Postman smoke check; the normal test suite starts its own HTTP server.
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildPlan, install } from '../lib/installer.mjs';
import { latestVersion, updateInstallation } from '../lib/updater.mjs';

const [base, mode = 'normal'] = process.argv.slice(2);
if (!base) throw new Error('Provide the local simulation member URL.');
const source = fileURLToPath(new URL('../skills/', import.meta.url));
const version = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url))).version;
const root = await fs.mkdtemp(path.join(tmpdir(), 'handoff-postman-check-'));
const plan = buildPlan(['codebuddy'], { root, explicitRoot: true });
const check = ({ signal }) => latestVersion({ url: base + '/repos/Blank-Tea/design-to-handoff/git/matching-refs/tags/v', signal });
try {
  await install(source, plan);
  const marker = path.join(plan[0].directory, 'design-to-handoff', 'version.json');
  if (mode === 'error') {
    await fs.writeFile(marker, '{"version":"0.4.0"}');
    await assert.rejects(updateInstallation({ source, plan, currentVersion: version, check, log() {} }), /HTTP 503/);
    assert.equal(JSON.parse(await fs.readFile(marker)).version, '0.4.0');
    await assert.rejects(fs.access(path.join(path.dirname(plan[0].directory), '.design-to-handoff-backups')));
    console.log('Postman 503: caller failed clearly; original skills and version unchanged.');
  } else {
    const options = { source, plan, currentVersion: version, check, log() {}, upgrade() { assert.fail('Package download was not needed'); } };
    assert.equal((await updateInstallation(options)).status, 'current');
    await fs.writeFile(marker, '{"version":"0.4.0"}');
    assert.equal((await updateInstallation(options)).status, 'synced');
    assert.equal(JSON.parse(await fs.readFile(marker)).version, version);
    console.log('Postman normal: no-op did not download; older installed skills synced from local package.');
  }
} finally { await fs.rm(root, { recursive: true, force: true }); }
