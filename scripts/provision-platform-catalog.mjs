// Provisions the configurable Platform Catalog schema into the AgenticFury
// solution in the LIVE dev environment. Idempotent: every create checks for
// existence first, so re-running is safe. Auth: pure-HTTP OAuth2 device-code
// flow (pwsh-safe, no MSAL), identical to provision-scorecard.mjs.
//
// Creates:
//   • Table afp_Platform                    (primary name afp_Name)
//       cols: afp_Description (Memo), afp_IsActive (Boolean), afp_DisplayOrder (Integer)
//   • Table afp_PlatformAttribute           (primary name afp_Name)
//       cols: afp_Description (Memo), afp_Category (Picklist: capability/decision-criteria/cost-mechanism),
//             afp_IsActive (Boolean)
//   • Table afp_PlatformAttributeAssignment (primary name afp_Name) — join table
//       lookups: afp_PlatformId → afp_platform, afp_AttributeId → afp_platformattribute
//   • Lookup afp_PlatformId on afp_idearequirement → afp_platform (referential; replaces
//             the deprecated afp_aiplatformselection choice column — that column is left intact)
//   • Publishes all customizations
//
// Usage: node scripts/provision-platform-catalog.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TENANT = 'd92190b9-98e7-46da-8b11-580e06c7d15d';
const ORG = 'https://orgf2352485.crm.dynamics.com';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d'; // PAC public client
const SOLUTION = 'AgenticFury';

const API = `${ORG}/api/data/v9.2`;
const TOKEN_CACHE = path.join(os.tmpdir(), 'afp_platform_catalog_token.json');

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

// ── Column factories ───────────────────────────────────────────────────────

function primaryName(displayName = 'Name', description = 'Primary name') {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
    AttributeType: 'String',
    AttributeTypeName: typedName('StringType'),
    SchemaName: 'afp_Name',
    DisplayName: label(displayName),
    Description: label(description),
    RequiredLevel: requiredLevel('None'),
    MaxLength: 200,
    FormatName: typedName('Text'),
    IsPrimaryName: true,
  };
}

function memo(schemaName, displayName) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
    AttributeType: 'Memo',
    AttributeTypeName: typedName('MemoType'),
    SchemaName: schemaName,
    DisplayName: label(displayName),
    RequiredLevel: requiredLevel('None'),
    Format: 'TextArea',
    ImeMode: 'Disabled',
    MaxLength: 2000,
    IsLocalizable: false,
  };
}

function booleanColumn(schemaName, displayName, defaultValue = true) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
    AttributeType: 'Boolean',
    AttributeTypeName: typedName('BooleanType'),
    SchemaName: schemaName,
    DisplayName: label(displayName),
    RequiredLevel: requiredLevel('None'),
    DefaultValue: defaultValue,
    OptionSet: {
      TrueOption: { Value: 1, Label: label('Yes') },
      FalseOption: { Value: 0, Label: label('No') },
      OptionSetType: 'Boolean',
    },
  };
}

function integerColumn(schemaName, displayName, { min = 0, max = 1000000 } = {}) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
    AttributeType: 'Integer',
    AttributeTypeName: typedName('IntegerType'),
    SchemaName: schemaName,
    DisplayName: label(displayName),
    RequiredLevel: requiredLevel('None'),
    Format: 'None',
    MinValue: min,
    MaxValue: max,
  };
}

function picklistColumn(schemaName, displayName, description, options) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
    AttributeType: 'Picklist',
    AttributeTypeName: typedName('PicklistType'),
    SchemaName: schemaName,
    DisplayName: label(displayName),
    Description: label(description),
    RequiredLevel: requiredLevel('None'),
    OptionSet: {
      '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
      IsGlobal: false,
      OptionSetType: 'Picklist',
      Options: options.map((o) => ({ Value: o.value, Label: label(o.label) })),
    },
  };
}

function lookupAttr(schemaName, displayName, description) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
    AttributeType: 'Lookup',
    AttributeTypeName: typedName('LookupType'),
    SchemaName: schemaName,
    DisplayName: label(displayName),
    Description: label(description),
    RequiredLevel: requiredLevel('None'),
  };
}

const CASCADE_ALL = {
  Assign: 'Cascade',
  Delete: 'Cascade',
  Merge: 'Cascade',
  Reparent: 'Cascade',
  Share: 'Cascade',
  Unshare: 'Cascade',
};

// Referential — used for the idea→platform lookup so deleting a platform does
// NOT cascade-delete idea submissions; it just removes the link.
const REFERENTIAL = {
  Assign: 'NoCascade',
  Delete: 'RemoveLink',
  Merge: 'NoCascade',
  Reparent: 'NoCascade',
  Share: 'NoCascade',
  Unshare: 'NoCascade',
};

function relationship({
  schemaName,
  referencedEntity,
  referencedAttribute,
  referencingEntity,
  lookupSchemaName,
  lookupLabel,
  lookupDescription,
  cascade,
}) {
  return {
    SchemaName: schemaName,
    '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
    AssociatedMenuConfiguration: {
      Behavior: 'UseLabel',
      Group: 'Details',
      Label: label(lookupLabel),
      Order: 10000,
    },
    CascadeConfiguration: cascade,
    ReferencedAttribute: referencedAttribute,
    ReferencedEntity: referencedEntity,
    ReferencingEntity: referencingEntity,
    Lookup: lookupAttr(lookupSchemaName, lookupLabel, lookupDescription),
  };
}

// ── Table definitions ──────────────────────────────────────────────────────

const TABLES = [
  {
    schemaName: 'afp_Platform',
    logicalName: 'afp_platform',
    displayName: 'Platform',
    displayCollectionName: 'Platforms',
    description: 'A configurable AI platform option that a submitter can choose for an idea.',
    primary: primaryName('Name', 'The platform name (e.g. Microsoft Copilot Studio).'),
    columns: [
      memo('afp_Description', 'Description'),
      booleanColumn('afp_IsActive', 'Is Active', true),
      integerColumn('afp_DisplayOrder', 'Display Order', { min: 0, max: 100000 }),
    ],
  },
  {
    schemaName: 'afp_PlatformAttribute',
    logicalName: 'afp_platformattribute',
    displayName: 'Platform Attribute',
    displayCollectionName: 'Platform Attributes',
    description: 'A reusable capability, decision criterion, or cost mechanism that can be assigned to platforms.',
    primary: primaryName('Name', 'The attribute name.'),
    columns: [
      memo('afp_Description', 'Description'),
      picklistColumn('afp_Category', 'Category', 'Which kind of platform attribute this is.', [
        { value: 747150000, label: 'Capability' },
        { value: 747150001, label: 'Decision Criteria' },
        { value: 747150002, label: 'Cost Mechanism' },
      ]),
      booleanColumn('afp_IsActive', 'Is Active', true),
    ],
  },
  {
    schemaName: 'afp_PlatformAttributeAssignment',
    logicalName: 'afp_platformattributeassignment',
    displayName: 'Platform Attribute Assignment',
    displayCollectionName: 'Platform Attribute Assignments',
    description: 'Join record assigning a platform attribute to a platform (many-to-many).',
    primary: primaryName('Name', 'Auto-generated assignment name.'),
    columns: [],
  },
];

const RELATIONSHIPS = [
  relationship({
    schemaName: 'afp_PlatformAttributeAssignment_Platform',
    referencedEntity: 'afp_platform',
    referencedAttribute: 'afp_platformid',
    referencingEntity: 'afp_platformattributeassignment',
    lookupSchemaName: 'afp_PlatformId',
    lookupLabel: 'Platform',
    lookupDescription: 'The platform this assignment belongs to.',
    cascade: CASCADE_ALL,
  }),
  relationship({
    schemaName: 'afp_PlatformAttributeAssignment_Attribute',
    referencedEntity: 'afp_platformattribute',
    referencedAttribute: 'afp_platformattributeid',
    referencingEntity: 'afp_platformattributeassignment',
    lookupSchemaName: 'afp_AttributeId',
    lookupLabel: 'Attribute',
    lookupDescription: 'The platform attribute assigned to the platform.',
    // Referential (NOT cascade): a join table may have only ONE parental
    // relationship, and the Platform lookup above is already parental. Deleting
    // an attribute therefore just removes the link, not the join row.
    cascade: REFERENTIAL,
  }),
  relationship({
    schemaName: 'afp_IdeaRequirement_Platform',
    referencedEntity: 'afp_platform',
    referencedAttribute: 'afp_platformid',
    referencingEntity: 'afp_idearequirement',
    lookupSchemaName: 'afp_PlatformId',
    lookupLabel: 'Platform',
    lookupDescription: 'The platform selected for this idea submission.',
    cascade: REFERENTIAL,
  }),
];

async function ensureTable(token, table) {
  const existing = await getJson(token, `/EntityDefinitions(LogicalName='${table.logicalName}')?$select=LogicalName`);
  if (existing) {
    console.log(`  ✓ table exists: ${table.logicalName}`);
    return;
  }
  await send(token, '/EntityDefinitions', {
    body: {
      '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
      SchemaName: table.schemaName,
      DisplayName: label(table.displayName),
      DisplayCollectionName: label(table.displayCollectionName),
      Description: label(table.description),
      OwnershipType: 'UserOwned',
      IsActivity: false,
      HasActivities: false,
      HasNotes: false,
      Attributes: [table.primary],
    },
  });
  console.log(`  + created table: ${table.logicalName}`);
}

async function ensureColumn(token, logicalName, column) {
  const logical = column.SchemaName.toLowerCase();
  const existing = await getJson(
    token,
    `/EntityDefinitions(LogicalName='${logicalName}')/Attributes(LogicalName='${logical}')?$select=LogicalName`,
  );
  if (existing) {
    console.log(`  ✓ column exists: ${logicalName}.${logical}`);
    return;
  }
  await send(token, `/EntityDefinitions(LogicalName='${logicalName}')/Attributes`, { body: column });
  console.log(`  + created column: ${logicalName}.${logical}`);
}

async function ensureRelationship(token, rel) {
  const existing = await getJson(token, `/RelationshipDefinitions?$select=SchemaName&$filter=SchemaName eq '${rel.SchemaName}'`);
  if (existing?.value?.length) {
    console.log(`  ✓ relationship exists: ${rel.SchemaName}`);
    return;
  }
  await send(token, '/RelationshipDefinitions', { body: rel });
  console.log(`  + created relationship: ${rel.SchemaName} (lookup ${rel.Lookup.SchemaName} on ${rel.ReferencingEntity})`);
}

async function main() {
  console.log(`Provisioning Platform Catalog into solution "${SOLUTION}" on ${ORG}`);
  const token = await getToken();

  console.log('\n## tables');
  for (const table of TABLES) {
    await ensureTable(token, table);
  }

  console.log('\n## columns');
  for (const table of TABLES) {
    for (const column of table.columns) {
      await ensureColumn(token, table.logicalName, column);
    }
  }

  console.log('\n## relationships (lookups)');
  for (const rel of RELATIONSHIPS) {
    await ensureRelationship(token, rel);
  }

  console.log('\n## publish');
  await send(token, '/PublishAllXml', { body: {} });
  console.log('  ✓ published all customizations');

  console.log('\n✅ Platform Catalog provisioned. Next, register the new tables as Code App data sources:');
  console.log('   pac code add-data-source -a dataverse -t afp_platform');
  console.log('   pac code add-data-source -a dataverse -t afp_platformattribute');
  console.log('   pac code add-data-source -a dataverse -t afp_platformattributeassignment');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
