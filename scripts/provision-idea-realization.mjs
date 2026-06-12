// Provisions the afp_idearealization table (Idea Realization) into the
// AgenticFury solution on the LIVE dev environment. Idempotent: every create
// checks for existence first, so re-running is safe. Auth: pure-HTTP OAuth2
// device-code flow (pwsh-safe, no MSAL), identical to provision-scorecard.mjs.
//
// Captures post-approval outcomes for an idea (1:1 with the submission,
// enforced by the app).
//
// Creates:
//   • Table afp_IdeaRealization (primary name afp_Name)
//   • afp_ActualMonthlyCost (Decimal 0-1,000,000), afp_RealizedBenefit (Memo),
//     afp_ActualGoLiveDate (DateTime DateOnly), afp_OutcomeRating (local Picklist)
//   • Lookup afp_SubmissionId → afp_idearequirement (cascade; app enforces 1:1)
//   • Publishes all customizations
//
// Usage: node scripts/provision-idea-realization.mjs

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

const TABLE = {
  schemaName: 'afp_IdeaRealization',
  logicalName: 'afp_idearealization',
  displayName: 'Idea Realization',
  displayCollectionName: 'Idea Realizations',
  description: 'Post-approval realized outcomes for a submitted idea. One record per submission (1:1, enforced by the app).',
};

const PRIMARY_NAME = {
  '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
  AttributeType: 'String',
  AttributeTypeName: typedName('StringType'),
  SchemaName: 'afp_Name',
  DisplayName: label('Name'),
  Description: label('Auto-generated realization name'),
  RequiredLevel: requiredLevel('None'),
  MaxLength: 200,
  FormatName: typedName('Text'),
  IsPrimaryName: true,
};

const COLUMNS = [
  {
    '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
    AttributeType: 'Decimal',
    AttributeTypeName: typedName('DecimalType'),
    SchemaName: 'afp_ActualMonthlyCost',
    DisplayName: label('Actual Monthly Cost'),
    Description: label('Observed monthly run cost after go-live.'),
    RequiredLevel: requiredLevel('None'),
    MinValue: 0,
    MaxValue: 1000000,
    Precision: 2,
  },
  {
    '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
    AttributeType: 'Memo',
    AttributeTypeName: typedName('MemoType'),
    SchemaName: 'afp_RealizedBenefit',
    DisplayName: label('Realized Benefit'),
    Description: label('Narrative of the realized business benefit.'),
    RequiredLevel: requiredLevel('None'),
    Format: 'TextArea',
    ImeMode: 'Disabled',
    MaxLength: 4000,
    IsLocalizable: false,
  },
  {
    '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
    AttributeType: 'DateTime',
    AttributeTypeName: typedName('DateTimeType'),
    SchemaName: 'afp_ActualGoLiveDate',
    DisplayName: label('Actual Go-Live Date'),
    Description: label('The date the solution actually went live.'),
    RequiredLevel: requiredLevel('None'),
    Format: 'DateOnly',
  },
  {
    '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
    AttributeType: 'Picklist',
    AttributeTypeName: typedName('PicklistType'),
    SchemaName: 'afp_OutcomeRating',
    DisplayName: label('Outcome Rating'),
    Description: label('How the realized outcome compared to expectations.'),
    RequiredLevel: requiredLevel('None'),
    OptionSet: {
      '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
      IsGlobal: false,
      OptionSetType: 'Picklist',
      Options: [
        { Value: 747150000, Label: label('Exceeded Expectations') },
        { Value: 747150001, Label: label('Met Expectations') },
        { Value: 747150002, Label: label('Below Expectations') },
        { Value: 747150003, Label: label('Failed / Abandoned') },
      ],
    },
  },
];

const CASCADE_ALL = {
  Assign: 'Cascade',
  Delete: 'Cascade',
  Merge: 'Cascade',
  Reparent: 'Cascade',
  Share: 'Cascade',
  Unshare: 'Cascade',
};

const RELATIONSHIP = {
  SchemaName: 'afp_IdeaRealization_IdeaRequirement',
  '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
  AssociatedMenuConfiguration: {
    Behavior: 'UseLabel',
    Group: 'Details',
    Label: label('Submission'),
    Order: 10000,
  },
  CascadeConfiguration: CASCADE_ALL,
  ReferencedAttribute: 'afp_idearequirementid',
  ReferencedEntity: 'afp_idearequirement',
  ReferencingEntity: TABLE.logicalName,
  Lookup: {
    '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
    AttributeType: 'Lookup',
    AttributeTypeName: typedName('LookupType'),
    SchemaName: 'afp_SubmissionId',
    DisplayName: label('Submission'),
    Description: label('Links the realization record to its idea submission.'),
    RequiredLevel: requiredLevel('None'),
  },
};

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
  console.log(`Provisioning Idea Realization into solution "${SOLUTION}" on ${ORG}`);
  const token = await getToken();

  console.log('\n## table');
  await ensureTable(token);

  console.log('\n## columns');
  for (const column of COLUMNS) {
    await ensureColumn(token, column);
  }

  console.log('\n## relationships (lookups)');
  await ensureRelationship(token, RELATIONSHIP);

  console.log('\n## publish');
  await send(token, '/PublishAllXml', { body: {} });
  console.log('  ✓ published all customizations');

  console.log('\n✅ Idea Realization provisioned. Next: pac code add-data-source -a dataverse -t afp_idearealization');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
