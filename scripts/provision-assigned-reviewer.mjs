// Adds the afp_AssignedReviewer lookup (→ systemuser) to the existing
// afp_idearequirement table in the AgenticFury solution on the LIVE dev
// environment. Idempotent: the relationship create checks for existence first,
// so re-running is safe. Auth: pure-HTTP OAuth2 device-code flow (pwsh-safe,
// no MSAL), identical to scripts/provision-scorecard.mjs.
//
// Creates:
//   • Lookup afp_AssignedReviewer → systemuser (referential — systemuser
//     cannot cascade-delete), surfaced as a OneToMany relationship from
//     systemuser to afp_idearequirement.
//   • Publishes all customizations
//
// Usage: node scripts/provision-assigned-reviewer.mjs

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

async function send(token, endpoint, { method = 'POST', body } = {}) {
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

const REFERENTIAL = {
  Assign: 'NoCascade',
  Delete: 'RemoveLink',
  Merge: 'NoCascade',
  Reparent: 'NoCascade',
  Share: 'NoCascade',
  Unshare: 'NoCascade',
};

const RELATIONSHIP = {
  SchemaName: 'afp_IdeaRequirement_AssignedReviewer_SystemUser',
  '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
  AssociatedMenuConfiguration: {
    Behavior: 'UseLabel',
    Group: 'Details',
    Label: label('Assigned Reviewer'),
    Order: 10000,
  },
  CascadeConfiguration: REFERENTIAL,
  ReferencedAttribute: 'systemuserid',
  ReferencedEntity: 'systemuser',
  ReferencingEntity: 'afp_idearequirement',
  Lookup: {
    '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
    AttributeType: 'Lookup',
    AttributeTypeName: typedName('LookupType'),
    SchemaName: 'afp_AssignedReviewer',
    DisplayName: label('Assigned Reviewer'),
    Description: label('The AI CoE reviewer assigned to evaluate this idea.'),
    RequiredLevel: requiredLevel('None'),
  },
};

async function ensureRelationship(token, rel) {
  const existing = await getJson(token, `/RelationshipDefinitions?$select=SchemaName&$filter=SchemaName eq '${rel.SchemaName}'`);
  if (existing?.value?.length) {
    console.log(`  ✓ relationship exists: ${rel.SchemaName}`);
    return;
  }
  await send(token, '/RelationshipDefinitions', { body: rel });
  console.log(`  + created relationship: ${rel.SchemaName} (lookup ${rel.Lookup.SchemaName})`);
}

async function main() {
  console.log(`Provisioning afp_AssignedReviewer lookup into solution "${SOLUTION}" on ${ORG}`);
  const token = await getToken();

  console.log('\n## relationship (lookup → systemuser)');
  await ensureRelationship(token, RELATIONSHIP);

  console.log('\n## publish');
  await send(token, '/PublishAllXml', { body: {} });
  console.log('  ✓ published all customizations');

  console.log('\n✅ Assigned Reviewer lookup provisioned. The afp_idearequirement data source already exists — re-run pac code add-data-source -a dataverse -t afp_idearequirement to refresh generated types.');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
