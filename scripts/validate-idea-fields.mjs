// Validates that every Dataverse column the submission-detail save path writes
// actually exists in the live environment. Read-only: queries EntityDefinitions
// metadata only. Auth via pure-HTTP OAuth2 device-code flow (no MSAL dependency).
//
// Usage: node scripts/validate-idea-fields.mjs

const TENANT = 'd92190b9-98e7-46da-8b11-580e06c7d15d';
const ORG = 'https://orgf2352485.crm.dynamics.com';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d'; // PAC public client

// table logical (singular) name -> columns the app writes/reads
const REQUIRED = {
  afp_idearequirement: [
    'afp_title',
    'afp_businessobjectives',
    'afp_intendeduserroles',
    'afp_datasources',
    'afp_phirequired',
    'afp_expectedoutcomes',
    'afp_riskfactors',
    'afp_department',
    'afp_monthlycopilotcreditscost',
    'afp_monthlycopilotcreditsnotes',
    'afp_userbasedlicensingcost',
    'afp_userbasedlicensingnotes',
    'afp_datasourcecost',
    'afp_datasourcenotes',
    'afp_overallcostnoteshtml',
    'afp_estimatedcostsimage',
    'statuscode',
  ],
  afp_coestructuredreview: [
    'afp_name',
    'afp_submissionid',
    'afp_updatedby',
    'afp_updatedon',
  ],
  afp_coestructuredreviewselection: [
    'afp_name',
    'afp_reviewid',
    'afp_optionid',
  ],
};

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

async function listAttributes(token, logicalName) {
  const url =
    `${ORG}/api/data/v9.2/EntityDefinitions(LogicalName='${logicalName}')/Attributes?$select=LogicalName,AttributeType`;
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
    throw new Error(`metadata query for ${logicalName} failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  return new Map((json.value ?? []).map((a) => [a.LogicalName, a.AttributeType]));
}

async function main() {
  const token = await getToken();
  let anyMissing = false;

  for (const [table, columns] of Object.entries(REQUIRED)) {
    let attrs;
    try {
      attrs = await listAttributes(token, table);
    } catch (err) {
      console.log(`\n❌ TABLE ${table}: ${err.message}`);
      anyMissing = true;
      continue;
    }
    console.log(`\n## ${table} (${attrs.size} attributes)`);
    for (const col of columns) {
      if (attrs.has(col)) {
        console.log(`  ✓ ${col}  [${attrs.get(col)}]`);
      } else {
        console.log(`  ❌ MISSING: ${col}`);
        anyMissing = true;
      }
    }
  }

  console.log('\n' + (anyMissing ? '❌ One or more columns are MISSING from Dataverse.' : '✅ All columns exist in Dataverse.'));
  process.exit(anyMissing ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
