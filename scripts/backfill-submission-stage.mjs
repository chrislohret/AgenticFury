// Backfills the three new stage fields on existing Idea records from the legacy
// statuscode value. Idempotent: only PATCHes a record when at least one of the
// target field values differs from what is already stored. Auth: pure-HTTP
// OAuth2 device-code flow (pwsh-safe, no MSAL), identical to the provision-*
// scripts in this folder.
//
// Legacy statuscode → new fields:
//   Draft        → submissionStage: (unset), approval: (unset), build: (unset)
//   Submitted    → submissionStage: Submitted
//   Under Review → submissionStage: In Review
//   Approved     → submissionStage: Approved,  approval: Approved
//   Rejected     → submissionStage: Rejected,  approval: Denied
//   On Hold      → submissionStage: On Hold
//   In Progress  → submissionStage: Approved,  approval: Approved, build: In-progress
//   Completed    → submissionStage: Approved,  approval: Approved, build: Completed
//
// Usage: node scripts/backfill-submission-stage.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TENANT = 'd92190b9-98e7-46da-8b11-580e06c7d15d';
const ORG = 'https://orgf2352485.crm.dynamics.com';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d'; // PAC public client
const SOLUTION = 'AgenticFury';

const API = `${ORG}/api/data/v9.2`;
const TOKEN_CACHE = path.join(os.tmpdir(), 'afp_scorecard_token.json');

// Legacy statuscode values (afp_idearequirement.statuscode)
const STATUS = {
  DRAFT: 100000000,
  SUBMITTED: 100000001,
  UNDER_REVIEW: 100000002,
  APPROVED: 100000003,
  REJECTED: 100000004,
  ON_HOLD: 100000005,
  IN_PROGRESS: 100000006,
  COMPLETED: 100000007,
};

// New choice field values (live Dataverse option sets)
const SUBMISSION_STAGE = {
  IN_REVIEW: 747150000,
  ON_HOLD: 747150001,
  SUBMITTED: 747150003,
  DRAFT: 747150004,
  IN_PROGRESS: 747150005,
};
const BUILD_STAGE = {
  IN_PROGRESS: 747150000,
  COMPLETED: 747150001,
  CANCELLED: 747150002,
};
const APPROVAL_STATUS = {
  APPROVED: 100000000,
  DENIED: 100000001,
};

/** Returns the target { submissionStage, approvalStatus, buildStage } for a legacy statuscode. */
function targetForStatus(statusCode) {
  switch (statusCode) {
    case STATUS.SUBMITTED:
      return { submissionStage: SUBMISSION_STAGE.SUBMITTED, approvalStatus: null, buildStage: null };
    case STATUS.UNDER_REVIEW:
      return { submissionStage: SUBMISSION_STAGE.IN_REVIEW, approvalStatus: null, buildStage: null };
    case STATUS.APPROVED:
      return { submissionStage: SUBMISSION_STAGE.IN_REVIEW, approvalStatus: APPROVAL_STATUS.APPROVED, buildStage: null };
    case STATUS.REJECTED:
      return { submissionStage: SUBMISSION_STAGE.IN_REVIEW, approvalStatus: APPROVAL_STATUS.DENIED, buildStage: null };
    case STATUS.ON_HOLD:
      return { submissionStage: SUBMISSION_STAGE.ON_HOLD, approvalStatus: null, buildStage: null };
    case STATUS.IN_PROGRESS:
      return {
        submissionStage: SUBMISSION_STAGE.IN_REVIEW,
        approvalStatus: APPROVAL_STATUS.APPROVED,
        buildStage: BUILD_STAGE.IN_PROGRESS,
      };
    case STATUS.COMPLETED:
      return {
        submissionStage: SUBMISSION_STAGE.IN_REVIEW,
        approvalStatus: APPROVAL_STATUS.APPROVED,
        buildStage: BUILD_STAGE.COMPLETED,
      };
    case STATUS.DRAFT:
    default:
      return { submissionStage: SUBMISSION_STAGE.DRAFT, approvalStatus: null, buildStage: null };
  }
}

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

async function patch(token, endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'MSCRM.SolutionUniqueName': SOLUTION,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 204 || res.ok) return;
  throw new Error(`PATCH ${endpoint} failed (${res.status}): ${await res.text()}`);
}

async function main() {
  const token = await getToken();

  let url =
    '/afp_idearequirements?$select=afp_idearequirementid,afp_title,statuscode,afp_ideasubmissionstage,afp_approvalstatus,afp_ideabuildstage';
  let processed = 0;
  let updated = 0;

  while (url) {
    const page = await getJson(token, url);
    if (!page) break;
    for (const rec of page.value ?? []) {
      processed += 1;
      const target = targetForStatus(rec.statuscode);
      const current = {
        submissionStage: rec.afp_ideasubmissionstage ?? null,
        approvalStatus: rec.afp_approvalstatus ?? null,
        buildStage: rec.afp_ideabuildstage ?? null,
      };
      const changed =
        current.submissionStage !== target.submissionStage ||
        current.approvalStatus !== target.approvalStatus ||
        current.buildStage !== target.buildStage;
      if (!changed) continue;

      await patch(token, `/afp_idearequirements(${rec.afp_idearequirementid})`, {
        afp_ideasubmissionstage: target.submissionStage,
        afp_approvalstatus: target.approvalStatus,
        afp_ideabuildstage: target.buildStage,
      });
      updated += 1;
      console.log(
        `  • ${rec.afp_title ?? rec.afp_idearequirementid}: statuscode ${rec.statuscode} → ` +
          `stage ${target.submissionStage ?? 'Draft'}, approval ${target.approvalStatus ?? '—'}, ` +
          `build ${target.buildStage ?? '—'}`,
      );
    }
    // Follow server-driven paging if present.
    const next = page['@odata.nextLink'];
    url = next ? next.substring(next.indexOf('/api/data/v9.2') + '/api/data/v9.2'.length) : null;
  }

  console.log(`\nDone. Processed ${processed} records, updated ${updated}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
