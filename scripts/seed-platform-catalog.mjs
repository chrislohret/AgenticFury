// Seeds the Platform Catalog (afp_platform, afp_platformattribute,
// afp_platformattributeassignment) with a realistic starter set, mirroring the
// mock data. Idempotent: every platform/attribute is matched by name first and
// reused if present; assignments are reconciled so re-running won't duplicate.
// Auth: pure-HTTP OAuth2 device-code flow (pwsh-safe, no MSAL), identical to
// scripts/provision-platform-catalog.mjs (and reuses its cached token).
//
// Usage: node scripts/seed-platform-catalog.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TENANT = 'd92190b9-98e7-46da-8b11-580e06c7d15d';
const ORG = 'https://orgf2352485.crm.dynamics.com';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d'; // PAC public client
const SOLUTION = 'AgenticFury';

const API = `${ORG}/api/data/v9.2`;
// Reuse the provisioning script's token cache so a recent sign-in carries over.
const TOKEN_CACHE = path.join(os.tmpdir(), 'afp_platform_catalog_token.json');

const SET_PLATFORM = 'afp_platforms';
const SET_ATTRIBUTE = 'afp_platformattributes';
const SET_ASSIGNMENT = 'afp_platformattributeassignments';

const CATEGORY = {
  capability: 747150000,
  'decision-criteria': 747150001,
  'cost-mechanism': 747150002,
};

// ── Seed data (mirrors src/mockData/*) ───────────────────────────────────────

const PLATFORMS = [
  {
    name: 'Microsoft 365 Agent Builder',
    description:
      'Lightweight, no-code agent creation inside Microsoft 365 for declarative scenarios grounded in your tenant data.',
    displayOrder: 10,
  },
  {
    name: 'Microsoft Copilot Studio',
    description:
      'Low-code conversational agent platform with topics, generative orchestration, connectors, and Power Platform integration.',
    displayOrder: 20,
  },
  {
    name: 'Microsoft Azure AI Foundry',
    description:
      'Pro-code platform for building, evaluating, and deploying custom AI models and agents with full control over the stack.',
    displayOrder: 30,
  },
];

const ATTRIBUTES = [
  // Capabilities
  { name: 'No-code authoring', description: 'Build and publish agents without writing code.', category: 'capability' },
  { name: 'Power Platform connectors', description: 'Reach 1,000+ connectors and custom connectors for actions.', category: 'capability' },
  { name: 'Custom model deployment', description: 'Deploy and fine-tune your own foundation models.', category: 'capability' },
  { name: 'Tenant data grounding', description: 'Ground responses in Microsoft 365 tenant content.', category: 'capability' },
  // Decision criteria
  { name: 'Best for low complexity', description: 'Ideal when the scenario is simple and declarative.', category: 'decision-criteria' },
  { name: 'Requires pro-code team', description: 'Choose when you have engineering capacity for custom builds.', category: 'decision-criteria' },
  { name: 'Enterprise governance needs', description: 'Pick when DLP, ALM, and environment isolation matter.', category: 'decision-criteria' },
  // Cost mechanisms
  { name: 'Per-message metering', description: 'Consumption billed per billed message / Copilot Credit.', category: 'cost-mechanism' },
  { name: 'Included with M365 license', description: 'Covered by an existing Microsoft 365 Copilot license.', category: 'cost-mechanism' },
  { name: 'Azure consumption', description: 'Pay-as-you-go Azure compute and model inference costs.', category: 'cost-mechanism' },
];

// platform name → list of attribute names assigned to it
const ASSIGNMENTS = {
  'Microsoft 365 Agent Builder': [
    'No-code authoring',
    'Tenant data grounding',
    'Best for low complexity',
    'Included with M365 license',
  ],
  'Microsoft Copilot Studio': [
    'No-code authoring',
    'Power Platform connectors',
    'Enterprise governance needs',
    'Per-message metering',
  ],
  'Microsoft Azure AI Foundry': [
    'Custom model deployment',
    'Requires pro-code team',
    'Enterprise governance needs',
    'Azure consumption',
  ],
};

// ── Auth ─────────────────────────────────────────────────────────────────────

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
        /* cache best-effort */
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

// POST a record and return its primary id (via return=representation). Retries
// on customization-lock / throttling, mirroring the provisioning script.
async function createRecord(token, set, body, idField) {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(`${API}/${set}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        Prefer: 'return=representation',
        'MSCRM.SolutionUniqueName': SOLUTION,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const record = await res.json();
      return record[idField];
    }
    const text = await res.text();
    const lock = text.includes('CustomizationLockException') || text.includes('0x80071151');
    const deadlock = text.includes('Sql Number: 1205') || text.includes('-2146232060');
    const transient = text.includes('0x80040216');
    if ((res.status === 429 || lock || deadlock || transient) && attempt < maxAttempts) {
      const waitMs = Math.min(30000, 3000 * attempt);
      console.log(`  throttle on POST /${set}; retry in ${waitMs}ms (${attempt}/${maxAttempts})`);
      await delay(waitMs);
      continue;
    }
    throw new Error(`POST /${set} failed (${res.status}): ${text}`);
  }
  throw new Error(`POST /${set} failed after ${maxAttempts} attempts`);
}

function escapeOData(value) {
  return value.replace(/'/g, "''");
}

// ── Ensure helpers ───────────────────────────────────────────────────────────

async function ensurePlatform(token, platform) {
  const filter = `afp_name eq '${escapeOData(platform.name)}'`;
  const found = await getJson(token, `/${SET_PLATFORM}?$select=afp_platformid&$filter=${encodeURIComponent(filter)}`);
  if (found?.value?.length) {
    console.log(`  ✓ platform exists: ${platform.name}`);
    return found.value[0].afp_platformid;
  }
  const id = await createRecord(
    token,
    SET_PLATFORM,
    {
      afp_name: platform.name,
      afp_description: platform.description,
      afp_isactive: true,
      afp_displayorder: platform.displayOrder,
    },
    'afp_platformid',
  );
  console.log(`  + created platform: ${platform.name}`);
  return id;
}

async function ensureAttribute(token, attribute) {
  const filter = `afp_name eq '${escapeOData(attribute.name)}' and afp_category eq ${CATEGORY[attribute.category]}`;
  const found = await getJson(
    token,
    `/${SET_ATTRIBUTE}?$select=afp_platformattributeid&$filter=${encodeURIComponent(filter)}`,
  );
  if (found?.value?.length) {
    console.log(`  ✓ attribute exists: ${attribute.name} (${attribute.category})`);
    return found.value[0].afp_platformattributeid;
  }
  const id = await createRecord(
    token,
    SET_ATTRIBUTE,
    {
      afp_name: attribute.name,
      afp_description: attribute.description,
      afp_category: CATEGORY[attribute.category],
      afp_isactive: true,
    },
    'afp_platformattributeid',
  );
  console.log(`  + created attribute: ${attribute.name} (${attribute.category})`);
  return id;
}

async function ensureAssignment(token, platformId, attributeId, label) {
  const filter = `_afp_platformid_value eq ${platformId} and _afp_attributeid_value eq ${attributeId}`;
  const found = await getJson(
    token,
    `/${SET_ASSIGNMENT}?$select=afp_platformattributeassignmentid&$filter=${encodeURIComponent(filter)}`,
  );
  if (found?.value?.length) {
    console.log(`    ✓ assignment exists: ${label}`);
    return;
  }
  await createRecord(
    token,
    SET_ASSIGNMENT,
    {
      [`afp_PlatformId@odata.bind`]: `/${SET_PLATFORM}(${platformId})`,
      [`afp_AttributeId@odata.bind`]: `/${SET_ATTRIBUTE}(${attributeId})`,
    },
    'afp_platformattributeassignmentid',
  );
  console.log(`    + created assignment: ${label}`);
}

async function main() {
  console.log(`Seeding Platform Catalog into "${SOLUTION}" on ${ORG}`);
  const token = await getToken();

  console.log('\n## platforms');
  const platformIds = new Map();
  for (const platform of PLATFORMS) {
    platformIds.set(platform.name, await ensurePlatform(token, platform));
  }

  console.log('\n## attributes');
  const attributeIds = new Map();
  for (const attribute of ATTRIBUTES) {
    attributeIds.set(attribute.name, await ensureAttribute(token, attribute));
  }

  console.log('\n## assignments');
  for (const [platformName, attributeNames] of Object.entries(ASSIGNMENTS)) {
    const platformId = platformIds.get(platformName);
    if (!platformId) throw new Error(`Missing platform id for ${platformName}`);
    console.log(`  ${platformName}`);
    for (const attributeName of attributeNames) {
      const attributeId = attributeIds.get(attributeName);
      if (!attributeId) throw new Error(`Missing attribute id for ${attributeName}`);
      await ensureAssignment(token, platformId, attributeId, `${platformName} → ${attributeName}`);
    }
  }

  console.log('\n✅ Platform Catalog seeded.');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
