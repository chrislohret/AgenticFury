// Provisions the afp_scorecardweight table (Scorecard Weight) into the
// AgenticFury solution in the LIVE dev environment, then seeds one row per
// scorecard dimension with the code-default weights (sum = 100). Idempotent:
// every create checks for existence first, and seed rows are upserted by
// dimension key, so re-running is safe. Auth: pure-HTTP OAuth2 device-code
// flow (pwsh-safe, no MSAL), identical to provision-scorecard.mjs.
//
// Creates:
//   • Table afp_ScorecardWeight (primary name afp_Name)
//   • afp_DimensionKey (String) — the ScorecardDimensionKey
//   • afp_Weight (Whole Number 0-100)
//   • Seeds 5 rows: Business Value 25, Operational Efficiency 20,
//     Adoption & Experience 15, Trust & Governance 25, Technical Performance 15
//   • Publishes all customizations
//
// Usage: node scripts/provision-scorecard-weight.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TENANT = 'd92190b9-98e7-46da-8b11-580e06c7d15d';
const ORG = 'https://orgf2352485.crm.dynamics.com';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d'; // PAC public client
const SOLUTION = 'AgenticFury';

const API = `${ORG}/api/data/v9.2`;
const TOKEN_CACHE = path.join(os.tmpdir(), 'afp_scorecard_token.json');

function label(text) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.Label',
    LocalizedLabels: [
      {
        '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
        Label: text,
        LanguageCode: 1033,
        IsManaged: false,
      },
    ],
  };
}

function requiredLevel(value) {
  return {
    Value: value,
    CanBeChanged: true,
    ManagedPropertyLogicalName: 'canmodifyrequirementlevelsettings',
  };
}

const typedName = (value) => ({ Value: value });

async function getToken() {
  // Reuse a cached access token (valid ~1h) so re-runs after a transient
  // failure don't require another device-code sign-in.
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

// POST/PATCH with retry on customization-lock / throttling, mirroring the
// shared provision-dataverse-schema.mjs behavior.
async function send(token, endpoint, { method = 'POST', body, headers = {} } = {}) {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(`${API}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'MSCRM.SolutionUniqueName': SOLUTION,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return null;
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      return ct.includes('application/json') ? res.json() : res.text();
    }
    const text = await res.text();
    const lock = text.includes('CustomizationLockException') || text.includes('0x80071151');
    const deadlock = text.includes('Sql Number: 1205') || text.includes('-2146232060');
    // 0x80040216 = generic "unexpected error" Dataverse sometimes returns under
    // rapid back-to-back metadata writes; transient, so retry it too.
    const transient = text.includes('0x80040216');
    if ((res.status === 429 || lock || deadlock || transient) && attempt < maxAttempts) {
      const waitMs = Math.min(30000, 3000 * attempt);
      console.log(`  lock/throttle on ${method} ${endpoint}; retry in ${waitMs}ms (${attempt}/${maxAttempts})`);
      await delay(waitMs);
      continue;
    }
    throw new Error(`${method} ${endpoint} failed (${res.status}): ${text}`);
  }
  throw new Error(`${method} ${endpoint} failed after ${maxAttempts} attempts`);
}

const TABLE = {
  schemaName: 'afp_ScorecardWeight',
  logicalName: 'afp_scorecardweight',
  entitySet: 'afp_scorecardweights',
  displayName: 'Scorecard Weight',
  displayCollectionName: 'Scorecard Weights',
  description: 'Configurable percentage weight for a single scorecard dimension. The five rows are expected to sum to 100.',
};

const PRIMARY_NAME = {
  '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
  AttributeType: 'String',
  AttributeTypeName: typedName('StringType'),
  SchemaName: 'afp_Name',
  DisplayName: label('Name'),
  Description: label('Dimension display label'),
  RequiredLevel: requiredLevel('None'),
  MaxLength: 200,
  FormatName: typedName('Text'),
  IsPrimaryName: true,
};

const COLUMNS = [
  {
    '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
    AttributeType: 'String',
    AttributeTypeName: typedName('StringType'),
    SchemaName: 'afp_DimensionKey',
    DisplayName: label('Dimension Key'),
    Description: label('Stable scorecard dimension key (e.g. businessValue).'),
    RequiredLevel: requiredLevel('None'),
    MaxLength: 100,
    FormatName: typedName('Text'),
  },
  {
    '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
    AttributeType: 'Integer',
    AttributeTypeName: typedName('IntegerType'),
    SchemaName: 'afp_Weight',
    DisplayName: label('Weight'),
    Description: label('Percentage weight applied to this dimension (0-100).'),
    RequiredLevel: requiredLevel('None'),
    Format: 'None',
    MinValue: 0,
    MaxValue: 100,
  },
];

// Seed rows — mirror SCORECARD_DIMENSIONS defaults (sum = 100).
const SEED_ROWS = [
  { dimensionKey: 'businessValue', label: 'Business Value', weight: 25 },
  { dimensionKey: 'efficiency', label: 'Operational Efficiency', weight: 20 },
  { dimensionKey: 'adoption', label: 'Adoption & Experience', weight: 15 },
  { dimensionKey: 'trustGovernance', label: 'Trust & Governance', weight: 25 },
  { dimensionKey: 'technicalPerformance', label: 'Technical Performance', weight: 15 },
];

async function ensureTable(token) {
  const existing = await getJson(token, `/EntityDefinitions(LogicalName='${TABLE.logicalName}')?$select=LogicalName`);
  if (existing) {
    console.log(`  ✓ table exists: ${TABLE.logicalName}`);
    return;
  }
  await send(token, '/EntityDefinitions', {
    body: {
      '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
      SchemaName: TABLE.schemaName,
      DisplayName: label(TABLE.displayName),
      DisplayCollectionName: label(TABLE.displayCollectionName),
      Description: label(TABLE.description),
      OwnershipType: 'UserOwned',
      IsActivity: false,
      HasActivities: false,
      HasNotes: false,
      Attributes: [PRIMARY_NAME],
    },
  });
  console.log(`  + created table: ${TABLE.logicalName}`);
}

async function ensureColumn(token, column) {
  const logical = column.SchemaName.toLowerCase();
  const existing = await getJson(
    token,
    `/EntityDefinitions(LogicalName='${TABLE.logicalName}')/Attributes(LogicalName='${logical}')?$select=LogicalName`,
  );
  if (existing) {
    console.log(`  ✓ column exists: ${logical}`);
    return;
  }
  await send(token, `/EntityDefinitions(LogicalName='${TABLE.logicalName}')/Attributes`, { body: column });
  console.log(`  + created column: ${logical}`);
}

async function ensureSeedRow(token, row) {
  // Upsert by dimension key so re-runs don't create duplicates.
  const existing = await getJson(
    token,
    `/${TABLE.entitySet}?$select=afp_scorecardweightid&$filter=afp_dimensionkey eq '${row.dimensionKey}'`,
  );
  const body = {
    afp_name: row.label,
    afp_dimensionkey: row.dimensionKey,
    afp_weight: row.weight,
  };
  if (existing?.value?.length) {
    console.log(`  ✓ seed row exists: ${row.dimensionKey}`);
    return;
  }
  await send(token, `/${TABLE.entitySet}`, { body });
  console.log(`  + seeded row: ${row.dimensionKey} (${row.weight}%)`);
}

async function main() {
  console.log(`Provisioning Scorecard Weight into solution "${SOLUTION}" on ${ORG}`);
  const token = await getToken();

  console.log('\n## table');
  await ensureTable(token);

  console.log('\n## columns');
  for (const column of COLUMNS) {
    await ensureColumn(token, column);
  }

  console.log('\n## publish');
  await send(token, '/PublishAllXml', { body: {} });
  console.log('  ✓ published all customizations');

  console.log('\n## seed rows');
  for (const row of SEED_ROWS) {
    await ensureSeedRow(token, row);
  }

  console.log('\n✅ Scorecard Weight provisioned. Next: pac code add-data-source -a dataverse -t afp_scorecardweight');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
