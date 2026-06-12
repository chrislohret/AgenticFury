import fs from 'node:fs';
import path from 'node:path';

/**
 * Optional accelerator: provisions the two AgenticFury security teams and their
 * security roles described in the security model plan.
 *
 *   "AI CoE Team Full"      -> role "AgenticFury Full Access"  (full CRUD, org depth)
 *   "AI CoE Team Read Only" -> role "AgenticFury Read Only"    (read org + own ideas)
 *
 * This is the alternative to authoring the roles in the maker portal. The roles
 * are baselined on a copy of the OOB "Basic User" role so the Code App can load,
 * then the table privileges below are layered on. Teams are environment data and
 * are created per environment; security roles can additionally be added to the
 * AgenticFury solution so they travel dev -> test -> prod.
 *
 * NOTE: This script does NOT touch the `afp_aicoeroles` application table. AI CoE
 * Roles are functional labels and are unrelated to these platform security roles.
 *
 * Auth follows the same token pattern as provision-dataverse-schema.mjs: provide
 * DV_ACCESS_TOKEN (or a DV_ACCESS_TOKEN_FILE) for the target environment.
 *
 * Usage:
 *   $env:DV_ORG_URL = 'https://orgf2352485.crm.dynamics.com'
 *   $env:DV_ACCESS_TOKEN = '<bearer token for that org>'
 *   node packages/scripts/provision-security.mjs
 */

const orgUrl = process.env.DV_ORG_URL || 'https://orgf2352485.crm.dynamics.com';
const apiBase = `${orgUrl}/api/data/v9.2`;
const tokenFile = process.env.DV_ACCESS_TOKEN_FILE || path.join(process.env.TEMP || process.env.TMPDIR || '.', 'dv_token.txt');
const baseRoleName = process.env.DV_BASE_ROLE_NAME || 'Basic User';

const FULL_TEAM_NAME = 'AI CoE Team Full';
const READ_TEAM_NAME = 'AI CoE Team Read Only';
const FULL_ROLE_NAME = 'AgenticFury Full Access';
const READ_ROLE_NAME = 'AgenticFury Read Only';

// All custom AgenticFury tables (logical names). All are User-owned; the Full
// role grants Global-depth write so members can edit any record.
const CUSTOM_TABLES = [
  'afp_idearequirement',
  'afp_approvalstagerecord',
  'afp_lookupoption',
  'afp_coestructuredreview',
  'afp_coestructuredreviewselection',
  'afp_ideascorecard',
  'afp_scorecardweight',
  'afp_aicoeteammember',
  'afp_aicoeteamapproval',
  'afp_approvalhistoryentry',
  'afp_idearealization',
  'afp_aicoeroles',
];

// The single table a Read Only user may create/edit (their own ideas).
const OWN_IDEA_TABLE = 'afp_idearequirement';

// OOB tables the app reads. systemuser + team are needed for directory lookups
// and the team-membership admin check; annotation backs CoE notes.
const OOB_READ_TABLES = ['systemuser', 'team', 'annotation'];

const FULL_WRITE_RIGHTS = ['Create', 'Read', 'Write', 'Delete', 'Append', 'AppendTo'];
const OWN_WRITE_RIGHTS = ['Create', 'Write', 'Delete', 'Append', 'AppendTo'];

function readToken() {
  if (process.env.DV_ACCESS_TOKEN) {
    return process.env.DV_ACCESS_TOKEN.trim();
  }
  if (!fs.existsSync(tokenFile)) {
    throw new Error(`Dataverse token not found. Set DV_ACCESS_TOKEN or DV_ACCESS_TOKEN_FILE (looked for ${tokenFile}).`);
  }
  return fs.readFileSync(tokenFile, 'utf8').trim();
}

const token = readToken();

async function request(endpoint, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${apiBase}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null;

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed with ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function whoAmI() {
  const result = await request('/WhoAmI');
  return { userId: result.UserId, businessUnitId: result.BusinessUnitId };
}

async function getRootBusinessUnitId() {
  const result = await request("/businessunits?$select=businessunitid&$filter=_parentbusinessunitid_value eq null");
  const id = result?.value?.[0]?.businessunitid;
  if (!id) throw new Error('Unable to resolve the root business unit.');
  return id;
}

async function ensureTeam(name, businessUnitId, administratorId) {
  const existing = await request(`/teams?$select=teamid&$filter=name eq '${name.replace(/'/g, "''")}'`);
  if (existing?.value?.length) {
    console.log(`Team exists: ${name}`);
    return existing.value[0].teamid;
  }
  const created = await request('/teams', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: {
      name,
      teamtype: 0, // 0 = Owner team
      'businessunitid@odata.bind': `/businessunits(${businessUnitId})`,
      'administratorid@odata.bind': `/systemusers(${administratorId})`,
    },
  });
  console.log(`Created team: ${name}`);
  return created.teamid;
}

async function ensureRole(name, businessUnitId) {
  const existing = await request(`/roles?$select=roleid&$filter=name eq '${name.replace(/'/g, "''")}'`);
  if (existing?.value?.length) {
    console.log(`Role exists: ${name}`);
    return existing.value[0].roleid;
  }
  const created = await request('/roles', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: {
      name,
      'businessunitid@odata.bind': `/businessunits(${businessUnitId})`,
    },
  });
  console.log(`Created role: ${name}`);
  return created.roleid;
}

async function getBaseRoleId() {
  const result = await request(`/roles?$select=roleid,name&$filter=name eq '${baseRoleName.replace(/'/g, "''")}'`);
  return result?.value?.[0]?.roleid ?? null;
}

async function getRolePrivileges(roleId) {
  const result = await request(`/RetrieveRolePrivilegesRole(RoleId=${roleId})`);
  return result?.RolePrivileges ?? [];
}

const privilegeCache = new Map();

async function getEntityPrivileges(logicalName) {
  if (privilegeCache.has(logicalName)) return privilegeCache.get(logicalName);
  const result = await request(
    `/EntityDefinitions(LogicalName='${logicalName}')?$select=LogicalName,Privileges`,
  );
  const privileges = result?.Privileges ?? [];
  privilegeCache.set(logicalName, privileges);
  return privileges;
}

/**
 * Resolves the PrivilegeId for a given table + access right (Create/Read/...).
 */
async function resolvePrivilegeId(logicalName, accessRight) {
  const privileges = await getEntityPrivileges(logicalName);
  const match = privileges.find((p) => p.PrivilegeType === accessRight);
  if (!match) {
    throw new Error(`No ${accessRight} privilege found for ${logicalName}.`);
  }
  return match.PrivilegeId;
}

async function addPrivileges(roleId, rolePrivileges) {
  if (rolePrivileges.length === 0) return;
  // Chunk to keep request bodies small.
  for (let i = 0; i < rolePrivileges.length; i += 50) {
    const chunk = rolePrivileges.slice(i, i + 50);
    await request(`/roles(${roleId})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, {
      method: 'POST',
      body: { Privileges: chunk },
    });
  }
}

async function associateRoleToTeam(teamId, roleId) {
  try {
    await request(`/teams(${teamId})/teamroles_association/$ref`, {
      method: 'POST',
      body: { '@odata.id': `${apiBase}/roles(${roleId})` },
    });
    console.log('Associated role to team.');
  } catch (error) {
    // A duplicate association returns an error; treat as idempotent.
    if (String(error.message).includes('Cannot insert duplicate') || String(error.message).includes('already exists')) {
      console.log('Role already associated to team.');
      return;
    }
    throw error;
  }
}

async function buildFullRolePrivileges() {
  const privileges = [];
  for (const table of [...CUSTOM_TABLES, 'annotation']) {
    for (const right of FULL_WRITE_RIGHTS) {
      privileges.push({ Depth: 'Global', PrivilegeId: await resolvePrivilegeId(table, right) });
    }
  }
  for (const table of ['systemuser', 'team']) {
    privileges.push({ Depth: 'Global', PrivilegeId: await resolvePrivilegeId(table, 'Read') });
  }
  return privileges;
}

async function buildReadRolePrivileges() {
  const privileges = [];
  // Read everything at org depth.
  for (const table of [...CUSTOM_TABLES, ...OOB_READ_TABLES]) {
    privileges.push({ Depth: 'Global', PrivilegeId: await resolvePrivilegeId(table, 'Read') });
  }
  // Plus create/edit own ideas at user depth.
  for (const right of OWN_WRITE_RIGHTS) {
    privileges.push({ Depth: 'Basic', PrivilegeId: await resolvePrivilegeId(OWN_IDEA_TABLE, right) });
  }
  return privileges;
}

async function baselineFromBaseRole(roleId) {
  const existing = await getRolePrivileges(roleId);
  if (existing.length > 0) {
    console.log(`Role already has ${existing.length} privileges; skipping "${baseRoleName}" baseline.`);
    return;
  }
  const baseRoleId = await getBaseRoleId();
  if (!baseRoleId) {
    console.warn(
      `WARNING: base role "${baseRoleName}" not found. The new role will only contain the AgenticFury table privileges, ` +
        'which may be insufficient for the Code App to load. Consider authoring the role in the maker portal as a copy ' +
        `of "${baseRoleName}" instead, or set DV_BASE_ROLE_NAME.`,
    );
    return;
  }
  const basePrivileges = await getRolePrivileges(baseRoleId);
  const mapped = basePrivileges
    .filter((p) => p.PrivilegeId)
    .map((p) => ({ Depth: p.Depth, PrivilegeId: p.PrivilegeId }));
  await addPrivileges(roleId, mapped);
  console.log(`Baselined ${mapped.length} platform privileges from "${baseRoleName}".`);
}

async function main() {
  console.log(`Provisioning AgenticFury security model for ${orgUrl}`);

  const { userId } = await whoAmI();
  const rootBuId = await getRootBusinessUnitId();

  // Roles (can be added to the solution afterwards).
  const fullRoleId = await ensureRole(FULL_ROLE_NAME, rootBuId);
  const readRoleId = await ensureRole(READ_ROLE_NAME, rootBuId);

  await baselineFromBaseRole(fullRoleId);
  await baselineFromBaseRole(readRoleId);

  console.log('Adding Full Access table privileges...');
  await addPrivileges(fullRoleId, await buildFullRolePrivileges());

  console.log('Adding Read Only table privileges...');
  await addPrivileges(readRoleId, await buildReadRolePrivileges());

  // Teams (environment data, one per environment).
  const fullTeamId = await ensureTeam(FULL_TEAM_NAME, rootBuId, userId);
  const readTeamId = await ensureTeam(READ_TEAM_NAME, rootBuId, userId);

  await associateRoleToTeam(fullTeamId, fullRoleId);
  await associateRoleToTeam(readTeamId, readRoleId);

  console.log('Done. Add members to each team in the Power Platform admin center.');
  console.log(`  - ${FULL_TEAM_NAME}: AI CoE administrators (full access).`);
  console.log(`  - ${READ_TEAM_NAME}: read-only users who may submit/edit their own ideas.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
