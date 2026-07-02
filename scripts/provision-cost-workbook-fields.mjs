// Adds the cost-workbook reference columns to afp_idearequirement so each
// submission can point at its own SharePoint Excel workbook:
//   • afp_costworkbookurl      (URL)   — web URL to open the workbook
//   • afp_costworkbookuniqueid (Text)  — SharePoint file UniqueId {GUID}
//   • afp_costworkbookname     (Text)  — file name
// Idempotent; device-code OAuth (pwsh-safe), reuses the platform-catalog token
// cache. Ends with PublishAllXml.
//
// Usage: node scripts/provision-cost-workbook-fields.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TENANT = 'd92190b9-98e7-46da-8b11-580e06c7d15d';
const ORG = 'https://orgf2352485.crm.dynamics.com';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const SOLUTION = 'AgenticFury';

const API = `${ORG}/api/data/v9.2`;
const TOKEN_CACHE = path.join(os.tmpdir(), 'afp_platform_catalog_token.json');
const TABLE = 'afp_idearequirement';

function label(text) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.Label',
    LocalizedLabels: [
      { '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text, LanguageCode: 1033, IsManaged: false },
    ],
  };
}

function requiredLevel(value) {
  return { Value: value, CanBeChanged: true, ManagedPropertyLogicalName: 'canmodifyrequirementlevelsettings' };
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
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
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
    const transient =
      res.status === 429 ||
      res.status === 502 ||
      text.includes('CustomizationLockException') ||
      text.includes('0x80071151') ||
      text.includes('Sql Number: 1205') ||
      text.includes('0x80040216');
    if (transient && attempt < maxAttempts) {
      const waitMs = Math.min(30000, 3000 * attempt);
      console.log(`  transient on ${method} ${endpoint}; retry in ${waitMs}ms (${attempt}/${maxAttempts})`);
      await delay(waitMs);
      continue;
    }
    throw new Error(`${method} ${endpoint} failed (${res.status}): ${text}`);
  }
  throw new Error(`${method} ${endpoint} failed after ${maxAttempts} attempts`);
}

function stringColumn(schemaName, displayName, description, { format = 'Text', maxLength = 400 } = {}) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
    AttributeType: 'String',
    AttributeTypeName: typedName('StringType'),
    SchemaName: schemaName,
    DisplayName: label(displayName),
    Description: label(description),
    RequiredLevel: requiredLevel('None'),
    MaxLength: maxLength,
    FormatName: typedName(format),
  };
}

function booleanColumn(schemaName, displayName, description) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
    AttributeType: 'Boolean',
    AttributeTypeName: typedName('BooleanType'),
    SchemaName: schemaName,
    DisplayName: label(displayName),
    Description: label(description),
    RequiredLevel: requiredLevel('None'),
    DefaultValue: false,
    OptionSet: {
      TrueOption: { Value: 1, Label: label('Yes') },
      FalseOption: { Value: 0, Label: label('No') },
      OptionSetType: 'Boolean',
    },
  };
}

const COLUMNS = [
  stringColumn('afp_CostWorkbookUrl', 'Cost Workbook URL', 'Web URL to open the per-submission SharePoint cost workbook.', { format: 'Url', maxLength: 500 }),
  stringColumn('afp_CostWorkbookUniqueId', 'Cost Workbook Unique Id', 'SharePoint file UniqueId (GUID) of the cost workbook.', { format: 'Text', maxLength: 100 }),
  stringColumn('afp_CostWorkbookName', 'Cost Workbook Name', 'File name of the cost workbook.', { format: 'Text', maxLength: 260 }),
  booleanColumn('afp_CostWorkbookRequested', 'Cost Workbook Requested', 'Set true by the app to ask the cost-workbook flow to create the per-submission workbook.'),
];

async function ensureColumn(token, column) {
  const logical = column.SchemaName.toLowerCase();
  const existing = await getJson(
    token,
    `/EntityDefinitions(LogicalName='${TABLE}')/Attributes(LogicalName='${logical}')?$select=LogicalName`,
  );
  if (existing) {
    console.log(`  ✓ column exists: ${logical}`);
    return;
  }
  await send(token, `/EntityDefinitions(LogicalName='${TABLE}')/Attributes`, { body: column });
  console.log(`  + created column: ${logical}`);
}

async function main() {
  console.log(`Provisioning cost-workbook columns on ${TABLE} in "${SOLUTION}" on ${ORG}`);
  const token = await getToken();

  console.log('\n## columns');
  for (const column of COLUMNS) {
    await ensureColumn(token, column);
  }

  console.log('\n## publish');
  await send(token, '/PublishAllXml', { body: {} });
  console.log('  ✓ published all customizations');

  console.log('\n✅ Cost-workbook columns provisioned. Then regen types:');
  console.log('   pac code add-data-source -a dataverse -t afp_idearequirements');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
