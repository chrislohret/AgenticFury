// One-time migration: copies each idea's existing single-platform selection
// (afp_idearequirement.afp_PlatformId, the deprecated lookup) into the new
// afp_ideaplatform join table so multi-select reads show historical choices.
// Idempotent: skips ideas that already have a join row for that platform.
// Device-code OAuth (pwsh-safe), reuses the platform-catalog token cache.
//
// Usage: node scripts/migrate-single-platform-to-join.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TENANT = 'd92190b9-98e7-46da-8b11-580e06c7d15d';
const ORG = 'https://orgf2352485.crm.dynamics.com';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const SOLUTION = 'AgenticFury';

const API = `${ORG}/api/data/v9.2`;
const TOKEN_CACHE = path.join(os.tmpdir(), 'afp_platform_catalog_token.json');

const SET_IDEA = 'afp_idearequirements';
const SET_PLATFORM = 'afp_platforms';
const SET_JOIN = 'afp_ideaplatforms';

async function getToken() {
  try {
    const cached = JSON.parse(fs.readFileSync(TOKEN_CACHE, 'utf8'));
    if (cached.expiresAt && cached.expiresAt - Date.now() > 120000 && cached.accessToken) {
      console.log('Using cached access token.');
      return cached.accessToken;
    }
  } catch {
    /* no usable cache */
  }

  const dcRes = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: `${ORG}/.default offline_access` }),
  });
  const dc = await dcRes.json();
  if (!dc.device_code) throw new Error(`devicecode failed: ${JSON.stringify(dc)}`);
  console.log('\n=== SIGN IN REQUIRED ===');
  console.log(dc.message);
  console.log('========================\n');
  const interval = (dc.interval ?? 5) * 1000;
  const deadline = Date.now() + (dc.expires_in ?? 900) * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    const tokRes = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: CLIENT_ID,
        device_code: dc.device_code,
      }),
    });
    const tok = await tokRes.json();
    if (tok.access_token) {
      try {
        fs.writeFileSync(
          TOKEN_CACHE,
          JSON.stringify({ accessToken: tok.access_token, expiresAt: Date.now() + (tok.expires_in ?? 3600) * 1000 }),
          { mode: 0o600 },
        );
      } catch {
        /* best-effort */
      }
      return tok.access_token;
    }
    if (tok.error === 'authorization_pending' || tok.error === 'slow_down') continue;
    throw new Error(`token failed: ${JSON.stringify(tok)}`);
  }
  throw new Error('device code expired before authorization');
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(token, endpoint) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${endpoint} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function createJoin(token, submissionId, platformId) {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(`${API}/${SET_JOIN}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'MSCRM.SolutionUniqueName': SOLUTION,
      },
      body: JSON.stringify({
        afp_name: `${submissionId}:${platformId}`,
        'afp_SubmissionId@odata.bind': `/${SET_IDEA}(${submissionId})`,
        'afp_PlatformId@odata.bind': `/${SET_PLATFORM}(${platformId})`,
      }),
    });
    if (res.ok || res.status === 204) return;
    const text = await res.text();
    if ((res.status === 429 || res.status === 502 || text.includes('0x80040216')) && attempt < maxAttempts) {
      await delay(Math.min(20000, 2000 * attempt));
      continue;
    }
    throw new Error(`POST /${SET_JOIN} failed (${res.status}): ${text}`);
  }
}

async function main() {
  console.log(`Migrating single-platform selections into ${SET_JOIN} on ${ORG}`);
  const token = await getToken();

  // Ideas that have a single-platform lookup set.
  const ideas =
    (await getJson(
      token,
      `/${SET_IDEA}?$select=afp_idearequirementid,_afp_platformid_value&$filter=_afp_platformid_value ne null`,
    ))?.value ?? [];
  console.log(`Found ${ideas.length} idea(s) with a single-platform selection.`);

  // Existing join rows, to avoid duplicates.
  const existing =
    (await getJson(token, `/${SET_JOIN}?$select=afp_ideaplatformid,_afp_submissionid_value,_afp_platformid_value`))
      ?.value ?? [];
  const existingKeys = new Set(
    existing.map((r) => `${r._afp_submissionid_value}:${r._afp_platformid_value}`),
  );

  let created = 0;
  let skipped = 0;
  for (const idea of ideas) {
    const submissionId = idea.afp_idearequirementid;
    const platformId = idea._afp_platformid_value;
    const key = `${submissionId}:${platformId}`;
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    await createJoin(token, submissionId, platformId);
    existingKeys.add(key);
    created += 1;
    console.log(`  + ${submissionId} → ${platformId}`);
  }

  console.log(`\n✅ Migration complete. Created ${created}, skipped ${skipped} (already present).`);
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
