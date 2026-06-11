// Round-trip persistence test against LIVE Dataverse. Creates throwaway records
// (idea + structured review + selection) populating EVERY field the app writes,
// reads them back, verifies persistence, then DELETES them. No existing data is
// modified. Auth: pure-HTTP OAuth2 device-code flow (pwsh-safe, no MSAL).
//
// Usage: node scripts/roundtrip-idea-fields.mjs

const TENANT = 'd92190b9-98e7-46da-8b11-580e06c7d15d';
const ORG = 'https://orgf2352485.crm.dynamics.com';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';

const API = `${ORG}/api/data/v9.2`;

function uuid() {
  return crypto.randomUUID();
}

async function getToken() {
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
    if (tok.access_token) return tok.access_token;
    if (tok.error === 'authorization_pending' || tok.error === 'slow_down') continue;
    throw new Error(`token failed: ${JSON.stringify(tok)}`);
  }
  throw new Error('device code expired');
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
  };
}

// Mirrors the app's upsert: PATCH to entityset(guid) with If-* none → create.
async function upsert(token, entitySet, id, body) {
  const res = await fetch(`${API}/${entitySet}(${id})`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${entitySet}(${id}) failed (${res.status}): ${text}`);
  }
}

async function getRow(token, entitySet, id, select) {
  const url = `${API}/${entitySet}(${id})?$select=${select}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${entitySet}(${id}) failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function del(token, entitySet, id) {
  const res = await fetch(`${API}/${entitySet}(${id})`, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    console.log(`  ⚠️ cleanup DELETE ${entitySet}(${id}) failed (${res.status}): ${text}`);
  }
}

async function main() {
  const token = await getToken();

  const ideaId = uuid();
  const reviewId = uuid();
  const selectionId = uuid();
  const cleanup = [];
  let anyFail = false;

  try {
    // 1) Idea record — all scalar fields the save path writes.
    const ideaBody = {
      afp_title: 'ROUNDTRIP TEST (safe to delete)',
      afp_businessobjectives: 'bo-test',
      afp_intendeduserroles: 'iur-test',
      afp_datasources: 'ds-test',
      afp_phirequired: true,
      afp_expectedoutcomes: 'eo-test',
      afp_riskfactors: 'rf-test',
      afp_department: 'dept-test',
      afp_monthlycopilotcreditscost: 12500,
      afp_monthlycopilotcreditsnotes: 'mcc-notes',
      afp_userbasedlicensingcost: 1200,
      afp_userbasedlicensingnotes: 'ubl-notes',
      afp_datasourcecost: 450,
      afp_datasourcenotes: 'dsc-notes',
      afp_overallcostnoteshtml: '<p>overall <strong>notes</strong></p>',
      statuscode: 100000002, // Under Review
    };
    await upsert(token, 'afp_idearequirements', ideaId, ideaBody);
    cleanup.push(['afp_idearequirements', ideaId]);

    const ideaSelect = Object.keys(ideaBody).join(',');
    const ideaBack = await getRow(token, 'afp_idearequirements', ideaId, ideaSelect);

    console.log('\n## afp_idearequirement round-trip');
    for (const [k, v] of Object.entries(ideaBody)) {
      const got = ideaBack[k];
      const ok = String(got) === String(v);
      if (!ok) anyFail = true;
      console.log(`  ${ok ? '✓' : '❌'} ${k}: sent=${JSON.stringify(v)} got=${JSON.stringify(got)}`);
    }

    // 2) Structured review (lookup to the idea).
    const reviewBody = {
      afp_name: `Structured Review - ${ideaId}`,
      'afp_submissionid@odata.bind': `/afp_idearequirements(${ideaId})`,
      afp_updatedby: 'roundtrip-tester',
      afp_updatedon: new Date().toISOString(),
    };
    await upsert(token, 'afp_coestructuredreviews', reviewId, reviewBody);
    cleanup.push(['afp_coestructuredreviews', reviewId]);

    const reviewBack = await getRow(
      token,
      'afp_coestructuredreviews',
      reviewId,
      'afp_name,_afp_submissionid_value,afp_updatedby,afp_updatedon',
    );
    console.log('\n## afp_coestructuredreview round-trip');
    const reviewChecks = {
      afp_name: reviewBody.afp_name,
      _afp_submissionid_value: ideaId,
      afp_updatedby: reviewBody.afp_updatedby,
    };
    for (const [k, v] of Object.entries(reviewChecks)) {
      const got = reviewBack[k];
      const ok = String(got).toLowerCase() === String(v).toLowerCase();
      if (!ok) anyFail = true;
      console.log(`  ${ok ? '✓' : '❌'} ${k}: sent=${JSON.stringify(v)} got=${JSON.stringify(got)}`);
    }

    // 3) Structured review selection (lookup to review + plain option id).
    const selectionBody = {
      afp_name: `${reviewId}:opt-test`,
      'afp_reviewid@odata.bind': `/afp_coestructuredreviews(${reviewId})`,
      afp_optionid: 'opt-test-guid',
    };
    await upsert(token, 'afp_coestructuredreviewselections', selectionId, selectionBody);
    cleanup.push(['afp_coestructuredreviewselections', selectionId]);

    const selBack = await getRow(
      token,
      'afp_coestructuredreviewselections',
      selectionId,
      'afp_name,_afp_reviewid_value,afp_optionid',
    );
    console.log('\n## afp_coestructuredreviewselection round-trip');
    const selChecks = {
      afp_name: selectionBody.afp_name,
      _afp_reviewid_value: reviewId,
      afp_optionid: selectionBody.afp_optionid,
    };
    for (const [k, v] of Object.entries(selChecks)) {
      const got = selBack[k];
      const ok = String(got).toLowerCase() === String(v).toLowerCase();
      if (!ok) anyFail = true;
      console.log(`  ${ok ? '✓' : '❌'} ${k}: sent=${JSON.stringify(v)} got=${JSON.stringify(got)}`);
    }

    // 4) Idea scorecard (1:1 lookup to the idea). Scores 0-5, computed weighted total 0-100.
    const scorecardId = uuid();
    const scorecardBody = {
      afp_name: `Scorecard - ${ideaId}`,
      'afp_submissionid@odata.bind': `/afp_idearequirements(${ideaId})`,
      afp_businessvaluescore: 4,
      afp_efficiencyscore: 3,
      afp_adoptionscore: 4,
      afp_trustgovernancescore: 3,
      afp_technicalperformancescore: 4,
      afp_businessvaluenotes: 'bv-notes',
      afp_efficiencynotes: 'eff-notes',
      afp_adoptionnotes: 'adopt-notes',
      afp_trustgovernancenotes: 'trust-notes',
      afp_technicalperformancenotes: 'tech-notes',
      afp_weightedtotal: 71, // ((4/5)*25)+((3/5)*20)+((4/5)*15)+((3/5)*25)+((4/5)*15)
      afp_scoredon: new Date().toISOString(),
    };
    await upsert(token, 'afp_ideascorecards', scorecardId, scorecardBody);
    cleanup.push(['afp_ideascorecards', scorecardId]);

    const scorecardBack = await getRow(
      token,
      'afp_ideascorecards',
      scorecardId,
      'afp_name,_afp_submissionid_value,afp_businessvaluescore,afp_efficiencyscore,afp_adoptionscore,afp_trustgovernancescore,afp_technicalperformancescore,afp_businessvaluenotes,afp_efficiencynotes,afp_adoptionnotes,afp_trustgovernancenotes,afp_technicalperformancenotes,afp_weightedtotal,afp_scoredon',
    );
    console.log('\n## afp_ideascorecard round-trip');
    const scorecardChecks = {
      afp_name: scorecardBody.afp_name,
      _afp_submissionid_value: ideaId,
      afp_businessvaluescore: scorecardBody.afp_businessvaluescore,
      afp_efficiencyscore: scorecardBody.afp_efficiencyscore,
      afp_adoptionscore: scorecardBody.afp_adoptionscore,
      afp_trustgovernancescore: scorecardBody.afp_trustgovernancescore,
      afp_technicalperformancescore: scorecardBody.afp_technicalperformancescore,
      afp_businessvaluenotes: scorecardBody.afp_businessvaluenotes,
      afp_efficiencynotes: scorecardBody.afp_efficiencynotes,
      afp_adoptionnotes: scorecardBody.afp_adoptionnotes,
      afp_trustgovernancenotes: scorecardBody.afp_trustgovernancenotes,
      afp_technicalperformancenotes: scorecardBody.afp_technicalperformancenotes,
      afp_weightedtotal: scorecardBody.afp_weightedtotal,
    };
    for (const [k, v] of Object.entries(scorecardChecks)) {
      const got = scorecardBack[k];
      const ok = String(got).toLowerCase() === String(v).toLowerCase();
      if (!ok) anyFail = true;
      console.log(`  ${ok ? '✓' : '❌'} ${k}: sent=${JSON.stringify(v)} got=${JSON.stringify(got)}`);
    }
  } catch (err) {
    anyFail = true;
    console.log(`\n❌ ERROR: ${err.message}`);
  } finally {
    console.log('\n## cleanup (deleting throwaway records)');
    // delete children before parents
    for (const [set, id] of cleanup.reverse()) {
      await del(token, set, id);
      console.log(`  🗑️ ${set}(${id})`);
    }
  }

  console.log('\n' + (anyFail ? '❌ One or more fields did NOT round-trip correctly.' : '✅ All fields round-tripped (write→read) successfully.'));
  process.exit(anyFail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
