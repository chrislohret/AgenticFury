// Dumps the live option set (value + label) for the afp_ideasubmissionstage
// choice column on afp_idearequirement. Read-only metadata query.
// Auth via pure-HTTP OAuth2 device-code flow (no MSAL dependency).
//
// Usage: node scripts/dump-submission-stage-options.mjs

const TENANT = 'd92190b9-98e7-46da-8b11-580e06c7d15d';
const ORG = 'https://orgf2352485.crm.dynamics.com';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d'; // PAC public client

const TABLE = 'afp_idearequirement';
const COLUMN = 'afp_ideasubmissionstage';

async function getToken() {
  const dcRes = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      scope: `${ORG}/.default offline_access`,
    }),
  });
  const dc = await dcRes.json();
  if (!dc.device_code) {
    throw new Error(`devicecode failed: ${JSON.stringify(dc)}`);
  }
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
    if (tok.access_token) return tok.access_token;
    if (tok.error === 'authorization_pending' || tok.error === 'slow_down') continue;
    throw new Error(`token failed: ${JSON.stringify(tok)}`);
  }
  throw new Error('device code expired before authorization');
}

async function main() {
  const token = await getToken();
  const url =
    `${ORG}/api/data/v9.2/EntityDefinitions(LogicalName='${TABLE}')` +
    `/Attributes(LogicalName='${COLUMN}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata` +
    `?$select=LogicalName&$expand=OptionSet($select=Options)`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`metadata query failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const options = json?.OptionSet?.Options ?? [];
  console.log(`\n## ${COLUMN} — ${options.length} options\n`);
  for (const opt of options) {
    const label = opt?.Label?.LocalizedLabels?.[0]?.Label ?? opt?.Label?.UserLocalizedLabel?.Label ?? '(no label)';
    console.log(`  ${opt.Value}  =  ${label}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
