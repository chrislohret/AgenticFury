import { getContext } from '@microsoft/power-apps/app';
import type { IOperationResult } from '@microsoft/power-apps/data';
import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo';
import { MicrosoftDataverseService } from '@/generated/services/MicrosoftDataverseService';
import { IDEA_STATUS } from '@/constants/ideaStatus';
import { getFieldMetadata } from '@/services/field-metadata-cache';
import type { AppDataProvider } from '@/services/data-contracts';
import type {
  ApprovalStage,
  ApprovalStageRecord,
  AiCoeRole,
  AiCoeTeamApproval,
  AiCoeTeamMember,
  CoeApprovalHistoryEntry,
  CoeNote,
  CoeStructuredReview,
  DirectoryUser,
  IdeaSubmission,
  LookupCategory,
  LookupOption,
  StageStatus,
} from '@/types/domain-models';

const ORG_URL = import.meta.env.VITE_DATAVERSE_URL as string;

if (!ORG_URL) {
  throw new Error('VITE_DATAVERSE_URL is not set. Add it to .env before using the real Dataverse provider.');
}

const TABLES = {
  idea: 'afp_idearequirements',
  approvalStage: 'afp_approvalstagerecords',
  lookupOption: 'afp_lookupoptions',
  structuredReview: 'afp_coestructuredreviews',
  structuredReviewSelection: 'afp_coestructuredreviewselections',
  approvalHistory: 'afp_approvalhistoryentries',
  aiCoeRole: 'afp_aicoeroleses',
  teamMember: 'afp_aicoeteammembers',
  teamApproval: 'afp_aicoeteamapprovals',
  notes: 'annotations',
  systemUser: 'systemusers',
} as const;

// Dataverse File-column SDK APIs key off the table's ENTITY SET (plural) name,
// matching the entitySetName the runtime registers in its database references and
// the entity-set segment of the Web API URL. Reuse the same name as every other
// idea operation.
const IDEA_FILE_TABLE = TABLES.idea;

// Dedicated data client for binary File-column operations. The connector action
// (UpdateEntityFileImageFieldContent) does not reliably persist File columns
// from a Code App; the SDK's uploadFileToRecord/downloadFileFromRecord helpers
// stream raw binary to the proper Web API file endpoint and are the supported path.
const dataClient = getClient(dataSourcesInfo);

const IDEA_STATUS_VALUES: Record<number, number> = {
  [IDEA_STATUS.DRAFT]: 100000000,
  [IDEA_STATUS.SUBMITTED]: 100000001,
  [IDEA_STATUS.UNDER_REVIEW]: 100000002,
  [IDEA_STATUS.APPROVED]: 100000003,
  [IDEA_STATUS.REJECTED]: 100000004,
  [IDEA_STATUS.ON_HOLD]: 100000005,
  [IDEA_STATUS.IN_PROGRESS]: 100000006,
  [IDEA_STATUS.COMPLETED]: 100000007,
};

const IDEA_STATUS_BY_CODE: Record<number, number> = Object.fromEntries(
  Object.entries(IDEA_STATUS_VALUES).map(([key, value]) => [value, Number(key)]),
) as Record<number, number>;

const APPROVAL_STAGE_VALUES: Record<ApprovalStage, number> = {
  'coe-review': 100000000,
  'it-signoff': 100000001,
  'executive-approval': 100000002,
};

const APPROVAL_STAGE_BY_VALUE: Record<number, ApprovalStage> = {
  100000000: 'coe-review',
  100000001: 'it-signoff',
  100000002: 'executive-approval',
};

const STAGE_STATUS_VALUES: Record<StageStatus, number> = {
  pending: 100000000,
  approved: 100000001,
  rejected: 100000002,
  'on-hold': 100000003,
};

const STAGE_STATUS_BY_VALUE: Record<number, StageStatus> = {
  100000000: 'pending',
  100000001: 'approved',
  100000002: 'rejected',
  100000003: 'on-hold',
};

const TEAM_APPROVAL_STATUS_VALUES: Record<AiCoeTeamApproval['approvalStatus'], number> = {
  pending: 100000000,
  approved: 100000001,
  denied: 100000002,
};

const TEAM_APPROVAL_STATUS_BY_VALUE: Record<number, AiCoeTeamApproval['approvalStatus']> = {
  100000000: 'pending',
  100000001: 'approved',
  100000002: 'denied',
};

const LOOKUP_CATEGORY_VALUES: Record<LookupCategory, number> = {
  'business-objectives': 100000000,
  'intended-user-roles': 100000001,
  'data-sources': 100000002,
  'expected-outcomes': 100000003,
  'risk-factors': 100000004,
  departments: 100000005,
  'ai-coe-roles': 100000006,
};

const LOOKUP_CATEGORY_BY_VALUE: Record<number, LookupCategory> = {
  100000000: 'business-objectives',
  100000001: 'intended-user-roles',
  100000002: 'data-sources',
  100000003: 'expected-outcomes',
  100000004: 'risk-factors',
  100000005: 'departments',
  100000006: 'ai-coe-roles',
};

const DECISION_VALUES = {
  approved: 100000000,
  denied: 100000001,
} as const;

const DECISION_BY_VALUE: Record<number, CoeApprovalHistoryEntry['decision']> = {
  100000000: 'approved',
  100000001: 'denied',
};

type DataverseRecord = Record<string, unknown>;

interface CurrentUserContext {
  id: string;
  fullName: string;
  email: string;
}

let currentUserPromise: Promise<CurrentUserContext | null> | null = null;
let currentSystemUserIdPromise: Promise<string | null> | null = null;

function requireSuccess<T>(result: IOperationResult<T>, operation: string): T {
  if (!result.success) {
    throw result.error ?? new Error(`${operation} failed.`);
  }
  return result.data;
}

function toRows<T extends DataverseRecord>(result: IOperationResult<DataverseRecord>): T[] {
  const data = requireSuccess(result, 'Dataverse list');
  const rows = (data as { value?: T[] } | undefined)?.value;
  return rows ?? [];
}

function normalizeId(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeDate(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function toImageDataUrl(base64OrDataUrl: string | undefined): string | undefined {
  if (!base64OrDataUrl) return undefined;
  if (base64OrDataUrl.startsWith('data:')) return base64OrDataUrl;
  return `data:image/png;base64,${base64OrDataUrl}`;
}

async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  if (!currentUserPromise) {
    currentUserPromise = getContext()
      .then((context: { user: { objectId?: string; userPrincipalName?: string; fullName?: string } }) => ({
        id: context.user.objectId ?? context.user.userPrincipalName ?? '',
        fullName: context.user.fullName ?? context.user.userPrincipalName ?? 'Current user',
        email: context.user.userPrincipalName ?? '',
      }))
      .catch(() => null);
  }

  return currentUserPromise;
}

async function resolveCurrentSystemUserId(): Promise<string | null> {
  const context = await getCurrentUserContext();
  if (!context) return null;

  const escapeOData = (value: string) => value.replace(/'/g, "''");
  const filters: string[] = [];
  if (context.id) filters.push(`azureactivedirectoryobjectid eq '${escapeOData(context.id)}'`);
  if (context.email) filters.push(`internalemailaddress eq '${escapeOData(context.email)}'`);

  for (const filter of filters) {
    const result = await MicrosoftDataverseService.ListRecordsWithOrganization(
      ORG_URL,
      TABLES.systemUser,
      undefined,
      undefined,
      true,
      undefined,
      'systemuserid',
      filter,
    );
    const rows = toRows(result);
    const id = rows.length > 0 ? normalizeId(rows[0].systemuserid) : '';
    if (id) return id;
  }

  return null;
}

async function getCurrentSystemUserId(): Promise<string | null> {
  if (!currentSystemUserIdPromise) {
    currentSystemUserIdPromise = resolveCurrentSystemUserId().catch(() => null);
  }
  return currentSystemUserIdPromise;
}

function selectFields(fields: string[]): string {
  return fields.join(',');
}

async function listRows(entityName: string, select?: string, expand?: string): Promise<DataverseRecord[]> {
  const result = await MicrosoftDataverseService.ListRecordsWithOrganization(
    ORG_URL,
    entityName,
    undefined,
    undefined,
    true,
    undefined,
    select,
    undefined,
    undefined,
    expand,
  );
  return toRows(result);
}

async function getRow(entityName: string, id: string, select?: string, expand?: string): Promise<DataverseRecord | null> {
  const result = await MicrosoftDataverseService.GetItemWithOrganization(
    '',
    '',
    ORG_URL,
    entityName,
    id,
    true,
    undefined,
    select,
    expand,
  );
  const data = requireSuccess(result, `Get ${entityName}`);
  return data && Object.keys(data).length > 0 ? data : null;
}

async function upsertRow(entityName: string, id: string, body: DataverseRecord): Promise<DataverseRecord> {
  const result = await MicrosoftDataverseService.UpdateRecordWithOrganization(
    '',
    '',
    ORG_URL,
    entityName,
    id,
    body,
    true,
  );
  return requireSuccess(result, `Upsert ${entityName}`) as DataverseRecord;
}

async function uploadImage(entityName: string, id: string, fieldName: string, dataUrl: string): Promise<void> {
  // Dataverse Image columns accept the raw base64-encoded image bytes written
  // directly to the attribute on a normal PATCH. This is the portable way to set
  // an image and always works. The file-streaming upload action
  // (UpdateEntityFileImageFieldContent) only works when the column has
  // "Can store full-size images" enabled — when it does not, that action errors
  // and nothing is written, which silently fails the whole save. Writing the
  // base64 value here avoids that dependency entirely.
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  const base64 = match?.[2] ?? dataUrl;
  await upsertRow(entityName, id, { [fieldName]: base64 });
}

async function clearImage(entityName: string, id: string, fieldName: string): Promise<void> {
  await upsertRow(entityName, id, { [fieldName]: null });
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Upload a PDF (or any binary file) to a Dataverse File column. File columns are
// NOT settable as base64 on a plain PATCH (that only works for Image columns) and
// the connector action does not reliably persist them from a Code App. The SDK's
// uploadFileToRecord streams the raw binary to the Web API file endpoint. NOTE:
// the SDK file APIs take the ENTITY SET (plural) name (e.g. afp_idearequirements)
// — the runtime keys its database references by entitySetName and injects the
// name straight into the Web API URL path (api/data/v9.0/<tableName>), so the
// singular logical name resolves to DataSourceNotFound / a 404.
async function uploadFile(
  entitySetName: string,
  id: string,
  fieldName: string,
  dataUrl: string,
  fileName: string,
): Promise<void> {
  const match = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
  const base64 = match?.[1] ?? dataUrl;
  const bytes = base64ToBytes(base64);
  const result = await dataClient.uploadFileToRecord(entitySetName, id, fieldName, fileName, bytes);
  requireSuccess(result, `Upload file ${fieldName}`);
}

async function clearFile(entitySetName: string, id: string, fieldName: string): Promise<void> {
  const result = await dataClient.deleteFileOrImageFromRecord(entitySetName, id, fieldName);
  requireSuccess(result, `Clear file ${fieldName}`);
}

async function downloadFile(entitySetName: string, id: string, fieldName: string, contentType = 'application/pdf'): Promise<string | undefined> {
  const result = await dataClient.downloadFileFromRecord(entitySetName, id, fieldName);
  if (!result.success || !result.data || result.data.length === 0) {
    return undefined;
  }
  return `data:${contentType};base64,${bytesToBase64(result.data)}`;
}

async function downloadImage(entityName: string, id: string, fieldName: string): Promise<string | undefined> {
  const result = await MicrosoftDataverseService.GetEntityFileImageFieldContentWithOrganization(
    'bytes=0-',
    ORG_URL,
    entityName,
    id,
    fieldName,
  );
  if (!result.success) {
    return undefined;
  }
  return toImageDataUrl(result.data);
}

// Resolve the estimated-costs image for an idea record. Image columns return
// their base64 thumbnail directly on the selected attribute, so prefer that
// (it is already loaded with the record and needs no extra call). Fall back to
// the file-streaming download only when the attribute is empty, e.g. for a
// full-size image stored via the file API.
async function resolveIdeaImageUrl(id: string, record: DataverseRecord): Promise<string | undefined> {
  const inline = toImageDataUrl(normalizeText(record.afp_estimatedcostsimage) || undefined);
  if (inline) return inline;
  return downloadImage(TABLES.idea, id, 'afp_estimatedcostsimage').catch(() => undefined);
}

// Resolve the Copilot Studio Estimator PDF for an idea record. File columns do
// not return their bytes inline on the row, so the presence of a stored file is
// signalled by the `_name` companion attribute. Only stream the content when a
// file name is present, to avoid a needless (and failing) download otherwise.
async function resolveIdeaPdfUrl(id: string, record: DataverseRecord): Promise<string | undefined> {
  const hasFile = Boolean(normalizeText(record.afp_copilotcreditestimatorpdf_name));
  if (!hasFile) return undefined;
  return downloadFile(IDEA_FILE_TABLE, id, 'afp_copilotcreditestimatorpdf').catch(() => undefined);
}

function getRecordGuid(record: DataverseRecord): string {
  return normalizeId(
    record.afp_idearequirementid ??
      record.afp_approvalstagerecordid ??
      record.afp_lookupoptionid ??
      record.afp_coestructuredreviewid ??
      record.afp_coestructuredreviewselectionid ??
      record.afp_approvalhistoryentryid ??
      record.afp_aicoeteammemberid ??
      record.afp_aicoeteamapprovalid ??
      record.annotationid ??
      record.systemuserid ??
      record.id,
  );
}

function mapIdeaStatus(statusCode: unknown): number {
  const numeric = getNumber(statusCode, IDEA_STATUS.DRAFT);
  return IDEA_STATUS_BY_CODE[numeric] ?? IDEA_STATUS.DRAFT;
}

function mapStageStatus(statusCode: unknown): StageStatus {
  const numeric = getNumber(statusCode, STAGE_STATUS_VALUES.pending);
  return STAGE_STATUS_BY_VALUE[numeric] ?? 'pending';
}

function mapTeamApprovalStatus(statusCode: unknown): AiCoeTeamApproval['approvalStatus'] {
  const numeric = getNumber(statusCode, TEAM_APPROVAL_STATUS_VALUES.pending);
  return TEAM_APPROVAL_STATUS_BY_VALUE[numeric] ?? 'pending';
}

function mapStageValue(stageCode: unknown): ApprovalStage {
  const numeric = getNumber(stageCode, APPROVAL_STAGE_VALUES['coe-review']);
  return APPROVAL_STAGE_BY_VALUE[numeric] ?? 'coe-review';
}

function mapLookupCategory(value: unknown): LookupCategory {
  const numeric = getNumber(value, LOOKUP_CATEGORY_VALUES['business-objectives']);
  return LOOKUP_CATEGORY_BY_VALUE[numeric] ?? 'business-objectives';
}

function mapDecision(value: unknown): CoeApprovalHistoryEntry['decision'] {
  const numeric = getNumber(value, DECISION_VALUES.approved);
  return DECISION_BY_VALUE[numeric] ?? 'approved';
}

function mapIdeaSubmission(record: DataverseRecord, imageUrl?: string, pdfUrl?: string): IdeaSubmission {
  const safeRecord = record ?? ({} as DataverseRecord);
  const createdBy = safeRecord.createdby as { systemuserid?: string; id?: string } | undefined;
  return {
    id: getRecordGuid(safeRecord),
    title: normalizeText(safeRecord.afp_title),
    businessObjectives: normalizeText(safeRecord.afp_businessobjectives),
    intendedUserRoles: normalizeText(safeRecord.afp_intendeduserroles),
    dataSources: normalizeText(safeRecord.afp_datasources) || undefined,
    phiRequired: normalizeBoolean(safeRecord.afp_phirequired),
    expectedOutcomes: normalizeText(safeRecord.afp_expectedoutcomes),
    riskFactors: normalizeText(safeRecord.afp_riskfactors) || undefined,
    estimatedCostsImageUrl: imageUrl,
    copilotCreditEstimatorPdfUrl: pdfUrl,
    copilotCreditEstimatorPdfName: normalizeText(safeRecord.afp_copilotcreditestimatorpdf_name) || undefined,
    monthlyCopilotCreditsCost: normalizeNumber(safeRecord.afp_monthlycopilotcreditscost),
    monthlyCopilotCreditsNotes: normalizeText(safeRecord.afp_monthlycopilotcreditsnotes) || undefined,
    userBasedLicensingCost: normalizeNumber(safeRecord.afp_userbasedlicensingcost),
    userBasedLicensingNotes: normalizeText(safeRecord.afp_userbasedlicensingnotes) || undefined,
    dataSourceCost: normalizeNumber(safeRecord.afp_datasourcecost),
    dataSourceNotes: normalizeText(safeRecord.afp_datasourcenotes) || undefined,
    overallCostNotesHtml: normalizeText(safeRecord.afp_overallcostnoteshtml) || undefined,
    aiPlatformSelection: normalizeNumber(safeRecord.afp_aiplatformselection),
    status: mapIdeaStatus(safeRecord.statuscode),
    department: normalizeText(safeRecord.afp_department) || undefined,
    submittedBy: normalizeId(createdBy?.systemuserid ?? createdBy?.id ?? safeRecord._createdby_value ?? safeRecord.createdby_value) || undefined,
    createdOn: normalizeDate(safeRecord.createdon),
  };
}

function mapApprovalStage(record: DataverseRecord): ApprovalStageRecord {
  return {
    id: getRecordGuid(record),
    submissionId: normalizeId(record._afp_submissionid_value ?? record.afp_submissionid) || '',
    stage: mapStageValue(record.afp_stage),
    stageStatus: mapStageStatus(record.statuscode),
    comments: normalizeText(record.afp_comments) || undefined,
    reviewedBy: normalizeText(record.afp_reviewedby) || undefined,
    reviewedOn: normalizeDate(record.afp_reviewedon),
  };
}

function mapLookupOption(record: DataverseRecord): LookupOption {
  return {
    id: getRecordGuid(record),
    category: mapLookupCategory(record.afp_category),
    name: normalizeText(record.afp_name),
    description: normalizeText(record.afp_description) || undefined,
    isActive: normalizeBoolean(record.afp_isactive),
  };
}

function mapDirectoryUser(record: DataverseRecord): DirectoryUser {
  return {
    id: getRecordGuid(record),
    displayName: normalizeText(record.fullname),
    email: normalizeText(record.internalemailaddress),
    department: undefined,
    jobTitle: normalizeText(record.title) || undefined,
  };
}

function mapTeamMember(record: DataverseRecord, userMap?: Map<string, DirectoryUser>): AiCoeTeamMember {
  const memberId = normalizeId(record._afp_memberid_value ?? record.afp_memberid);
  const dirUser = memberId ? userMap?.get(memberId) : undefined;
  return {
    id: getRecordGuid(record),
    memberId,
    userId: memberId,
    userName: dirUser?.displayName || normalizeText(record.afp_name),
    userEmail: dirUser?.email || '',
    roleId: normalizeId(record._afp_roleid_value ?? record.afp_roleid),
    addedOn: normalizeDate(record.afp_addedon) ?? normalizeDate(record.createdon) ?? new Date().toISOString(),
  };
}

function mapTeamApproval(record: DataverseRecord): AiCoeTeamApproval {
  return {
    id: getRecordGuid(record),
    submissionId: normalizeId(record._afp_submissionid_value ?? record.afp_submissionid) || '',
    teamMemberId: normalizeId(record._afp_teammemberid_value ?? record.afp_teammemberid) || '',
    approvalStatus: mapTeamApprovalStatus(record.statuscode),
    comment: normalizeText(record.afp_comment) || undefined,
    reviewedBy: normalizeText(record.afp_reviewedbyname) || undefined,
    reviewedOn: normalizeDate(record.afp_reviewedon) ?? normalizeDate(record.modifiedon) ?? normalizeDate(record.createdon),
  };
}

function mapApprovalHistory(record: DataverseRecord): CoeApprovalHistoryEntry {
  return {
    id: getRecordGuid(record),
    submissionId: normalizeId(record._afp_submissionid_value ?? record.afp_submissionid) || '',
    userName: normalizeText(record.afp_username),
    roleName: normalizeText(record.afp_rolename),
    decision: mapDecision(record.afp_decision),
    comments: normalizeText(record.afp_comments) || undefined,
    reviewedOn: normalizeDate(record.afp_reviewedon) ?? new Date().toISOString(),
  };
}

function mapStructuredReview(record: DataverseRecord, selections: LookupOption[]): CoeStructuredReview {
  const grouped = {
    'business-objectives': [] as string[],
    'intended-user-roles': [] as string[],
    'data-sources': [] as string[],
    'expected-outcomes': [] as string[],
    'risk-factors': [] as string[],
    departments: [] as string[],
  };

  for (const option of selections) {
    if (option.category in grouped) {
      grouped[option.category as keyof typeof grouped].push(option.id);
    }
  }

  return {
    id: getRecordGuid(record),
    submissionId: normalizeId(record._afp_submissionid_value ?? record.afp_submissionid) || '',
    businessObjectiveIds: grouped['business-objectives'],
    intendedUserRoleIds: grouped['intended-user-roles'],
    dataSourceIds: grouped['data-sources'],
    expectedOutcomeIds: grouped['expected-outcomes'],
    riskFactorIds: grouped['risk-factors'],
    departmentIds: grouped.departments,
    updatedBy: normalizeText(record.afp_updatedby) || undefined,
    updatedOn: normalizeDate(record.afp_updatedon) || undefined,
  };
}

async function loadCurrentUserName(): Promise<string> {
  const context = await getCurrentUserContext();
  return context?.fullName || 'Current user';
}

async function listIdeaRecords(): Promise<DataverseRecord[]> {
  return listRows(
    TABLES.idea,
    selectFields([
      'afp_idearequirementid',
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
      'afp_aiplatformselection',
      'statuscode',
      'createdon',
      'createdby',
      '_createdby_value',
    ]),
    'createdby($select=systemuserid,fullname,internalemailaddress)',
  );
}

async function getIdeaRecordById(id: string): Promise<DataverseRecord | null> {
  return getRow(
    TABLES.idea,
    id,
    selectFields([
      'afp_idearequirementid',
      'afp_title',
      'afp_businessobjectives',
      'afp_intendeduserroles',
      'afp_datasources',
      'afp_phirequired',
      'afp_expectedoutcomes',
      'afp_riskfactors',
      'afp_department',
      'afp_estimatedcostsimage',
      'afp_copilotcreditestimatorpdf_name',
      'afp_monthlycopilotcreditscost',
      'afp_monthlycopilotcreditsnotes',
      'afp_userbasedlicensingcost',
      'afp_userbasedlicensingnotes',
      'afp_datasourcecost',
      'afp_datasourcenotes',
      'afp_overallcostnoteshtml',
      'afp_aiplatformselection',
      'statuscode',
      'createdon',
      'createdby',
      '_createdby_value',
    ]),
    'createdby($select=systemuserid,fullname,internalemailaddress)',
  );
}

async function buildIdeaFromDataverse(id: string): Promise<IdeaSubmission | null> {
  const record = await getIdeaRecordById(id);
  if (!record) return null;
  const imageUrl = await resolveIdeaImageUrl(id, record);
  const pdfUrl = await resolveIdeaPdfUrl(id, record);
  return mapIdeaSubmission(record, imageUrl, pdfUrl);
}

async function getLookupOptionRows(): Promise<LookupOption[]> {
  return (await listRows(
    TABLES.lookupOption,
    selectFields(['afp_lookupoptionid', 'afp_name', 'afp_category', 'afp_description', 'afp_isactive']),
  )).map(mapLookupOption);
}

async function getStructuredReviewSelections(reviewId: string): Promise<LookupOption[]> {
  const selections = await listRows(
    TABLES.structuredReviewSelection,
    // afp_reviewid is a lookup, so its value comes back as _afp_reviewid_value.
    // It MUST be in the select list or the reviewId filter below never matches
    // and saved intake selections silently fail to load on refresh.
    selectFields(['afp_coestructuredreviewselectionid', 'afp_optionid', '_afp_reviewid_value']),
  );
  const related = selections.filter((record) => normalizeId(record._afp_reviewid_value ?? record.afp_reviewid) === reviewId);
  const options = await getLookupOptionRows();
  const optionMap = new Map(options.map((option) => [option.id, option]));
  return related
    .map((record) => optionMap.get(normalizeId(record.afp_optionid)))
    .filter((option): option is LookupOption => Boolean(option));
}

async function replaceStructuredReviewSelections(reviewId: string, optionIds: string[]): Promise<void> {
  const existing = await listRows(
    TABLES.structuredReviewSelection,
    selectFields(['afp_coestructuredreviewselectionid', 'afp_reviewid', 'afp_optionid', '_afp_reviewid_value']),
  );
  const existingRows = existing.filter((row) => normalizeId(row._afp_reviewid_value ?? row.afp_reviewid) === reviewId);
  await Promise.all(
    existingRows.map(async (row) => {
      const rowId = getRecordGuid(row);
      if (rowId) {
        await MicrosoftDataverseService.DeleteRecordWithOrganization(ORG_URL, TABLES.structuredReviewSelection, rowId);
      }
    }),
  );

  await Promise.all(
    optionIds.map(async (optionId) => {
      const selectionId = crypto.randomUUID();
      await upsertRow(TABLES.structuredReviewSelection, selectionId, {
        afp_name: `${reviewId}:${optionId}`,
        'afp_reviewid@odata.bind': `/${TABLES.structuredReview}(${reviewId})`,
        afp_optionid: optionId,
      });
    }),
  );
}

export function createRealDataProvider(): AppDataProvider {
  return {
    ideaSubmissions: {
      async list() {
        return (await listIdeaRecords()).map((record) => mapIdeaSubmission(record));
      },
      async listBySubmitter(userId: string) {
        // The UI passes the current user's Entra object id, but a record's
        // submittedBy is the Dataverse systemuserid (createdby). Resolve the
        // current user's systemuserid and match on that instead.
        const systemUserId = await getCurrentSystemUserId();
        const records = await this.list();
        if (systemUserId) {
          return records.filter((record) => record.submittedBy === systemUserId);
        }
        return records.filter((record) => record.submittedBy === userId);
      },
      async listPendingForStage() {
        const records = await this.list();
        return records.filter((record) => record.status === IDEA_STATUS.SUBMITTED || record.status === IDEA_STATUS.UNDER_REVIEW);
      },
      async getById(id: string) {
        return buildIdeaFromDataverse(id);
      },
      async save(input: Partial<IdeaSubmission>) {
        const id = input.id ?? crypto.randomUUID();
        const existing = input.id ? await buildIdeaFromDataverse(input.id) : null;
        const body: DataverseRecord = {
          afp_title: input.title ?? existing?.title ?? '',
          afp_businessobjectives: input.businessObjectives ?? existing?.businessObjectives ?? '',
          afp_intendeduserroles: input.intendedUserRoles ?? existing?.intendedUserRoles ?? '',
          afp_datasources: input.dataSources ?? existing?.dataSources ?? '',
          afp_phirequired: input.phiRequired ?? existing?.phiRequired ?? false,
          afp_expectedoutcomes: input.expectedOutcomes ?? existing?.expectedOutcomes ?? '',
          afp_riskfactors: input.riskFactors ?? existing?.riskFactors ?? '',
          afp_department: input.department ?? existing?.department ?? '',
          afp_monthlycopilotcreditscost: input.monthlyCopilotCreditsCost ?? existing?.monthlyCopilotCreditsCost ?? null,
          afp_monthlycopilotcreditsnotes: input.monthlyCopilotCreditsNotes ?? existing?.monthlyCopilotCreditsNotes ?? '',
          afp_userbasedlicensingcost: input.userBasedLicensingCost ?? existing?.userBasedLicensingCost ?? null,
          afp_userbasedlicensingnotes: input.userBasedLicensingNotes ?? existing?.userBasedLicensingNotes ?? '',
          afp_datasourcecost: input.dataSourceCost ?? existing?.dataSourceCost ?? null,
          afp_datasourcenotes: input.dataSourceNotes ?? existing?.dataSourceNotes ?? '',
          afp_overallcostnoteshtml: input.overallCostNotesHtml ?? existing?.overallCostNotesHtml ?? '',
          afp_aiplatformselection: input.aiPlatformSelection ?? existing?.aiPlatformSelection ?? null,
          statuscode: input.status ?? existing?.status ?? IDEA_STATUS.DRAFT,
        };

        await upsertRow(TABLES.idea, id, body);

        if (input.estimatedCostsImageUrl !== undefined) {
          if (input.estimatedCostsImageUrl) {
            await uploadImage(TABLES.idea, id, 'afp_estimatedcostsimage', input.estimatedCostsImageUrl);
          } else {
            await clearImage(TABLES.idea, id, 'afp_estimatedcostsimage');
          }
        }

        if (input.copilotCreditEstimatorPdfUrl !== undefined) {
          if (input.copilotCreditEstimatorPdfUrl) {
            await uploadFile(
              IDEA_FILE_TABLE,
              id,
              'afp_copilotcreditestimatorpdf',
              input.copilotCreditEstimatorPdfUrl,
              input.copilotCreditEstimatorPdfName || 'copilot-credit-estimate.pdf',
            );
          } else {
            await clearFile(IDEA_FILE_TABLE, id, 'afp_copilotcreditestimatorpdf');
          }
        }

        const imageUrl = input.estimatedCostsImageUrl ?? existing?.estimatedCostsImageUrl;
        const pdfUrl = input.copilotCreditEstimatorPdfUrl ?? existing?.copilotCreditEstimatorPdfUrl;
        const submittedBy = existing?.submittedBy ?? (await getCurrentUserContext())?.id;

        // Dataverse PATCH returns 204 No Content (the Prefer header is empty), so
        // `record` carries no row body. Re-reading the authoritative row is a
        // best-effort enrichment only: it must NEVER be able to fail the save,
        // because by this point the text PATCH and any image upload have already
        // committed to Dataverse. A throw here (e.g. a transient read error right
        // after an image upload) would reject the mutation, skip the React Query
        // cache update, and leave the form dirty even though the data persisted.
        // Fall back to the values we just wrote (`body`) when the read fails.
        let persisted: DataverseRecord | null = null;
        try {
          persisted = await getIdeaRecordById(id);
        } catch {
          persisted = null;
        }
        return {
          ...mapIdeaSubmission(persisted ?? body, imageUrl, pdfUrl),
          id,
          submittedBy,
        };
      },
    },
    approvalStages: {
      async listBySubmission(submissionId: string) {
        const rows = await listRows(
          TABLES.approvalStage,
          selectFields([
            'afp_approvalstagerecordid',
            'afp_stage',
            'statuscode',
            'afp_comments',
            'afp_reviewedon',
            'afp_reviewedby',
            'afp_submissionid',
            '_afp_submissionid_value',
          ]),
        );
        return rows
          .filter((row) => normalizeId(row._afp_submissionid_value ?? row.afp_submissionid) === submissionId)
          .map(mapApprovalStage);
      },
      async save(input: Partial<ApprovalStageRecord>) {
        if (!input.submissionId) {
          throw new Error('submissionId is required to save an approval stage record.');
        }
        const id = input.id ?? crypto.randomUUID();
        const reviewedBy = input.reviewedBy ?? (await loadCurrentUserName());
        const reviewedOn = input.reviewedOn ?? new Date().toISOString();
        const body: DataverseRecord = {
          afp_name: `${input.submissionId}:${input.stage ?? 'coe-review'}`,
          'afp_submissionid@odata.bind': `/${TABLES.idea}(${input.submissionId})`,
          afp_stage: APPROVAL_STAGE_VALUES[input.stage ?? 'coe-review'],
          statuscode: STAGE_STATUS_VALUES[input.stageStatus ?? 'pending'],
          afp_comments: input.comments ?? '',
          afp_reviewedon: reviewedOn,
          afp_reviewedby: reviewedBy,
        };
        const record = await upsertRow(TABLES.approvalStage, id, body);
        return mapApprovalStage({
          ...record,
          afp_submissionid: input.submissionId,
          _afp_submissionid_value: input.submissionId,
          afp_stage: APPROVAL_STAGE_VALUES[input.stage ?? 'coe-review'],
          statuscode: STAGE_STATUS_VALUES[input.stageStatus ?? 'pending'],
          afp_comments: input.comments ?? '',
          afp_reviewedon: reviewedOn,
          afp_reviewedby: reviewedBy,
        });
      },
    },
    lookupOptions: {
      async listByCategory(category: LookupCategory) {
        return (await getLookupOptionRows())
          .filter((option) => option.category === category)
          .sort((a, b) => a.name.localeCompare(b.name));
      },
      async save(input: Partial<LookupOption>) {
        if (!input.category || !input.name?.trim()) {
          throw new Error('Category and name are required for lookup options.');
        }
        const id = input.id ?? crypto.randomUUID();
        const body: DataverseRecord = {
          afp_name: input.name.trim(),
          afp_category: LOOKUP_CATEGORY_VALUES[input.category],
          afp_description: input.description?.trim() ?? '',
          afp_isactive: input.isActive ?? true,
        };
        const record = await upsertRow(TABLES.lookupOption, id, body);
        return mapLookupOption({
          ...record,
          afp_lookupoptionid: id,
          afp_name: body.afp_name,
          afp_category: body.afp_category,
          afp_description: body.afp_description,
          afp_isactive: body.afp_isactive,
        });
      },
      async delete(id: string) {
        await MicrosoftDataverseService.DeleteRecordWithOrganization(ORG_URL, TABLES.lookupOption, id);
      },
    },
    coeStructuredReviews: {
      async getBySubmissionId(submissionId: string) {
        const rows = await listRows(
          TABLES.structuredReview,
          selectFields(['afp_coestructuredreviewid', 'afp_submissionid', '_afp_submissionid_value', 'afp_updatedby', 'afp_updatedon']),
        );
        const record = rows.find((row) => normalizeId(row._afp_submissionid_value ?? row.afp_submissionid) === submissionId);
        if (!record) return null;
        const selections = await getStructuredReviewSelections(getRecordGuid(record));
        return mapStructuredReview(record, selections);
      },
      async save(input: Partial<CoeStructuredReview> & { submissionId: string }) {
        const existing = await this.getBySubmissionId(input.submissionId);
        const reviewId = existing?.id ?? input.id ?? crypto.randomUUID();
        const updatedBy = input.updatedBy ?? (await loadCurrentUserName());
        const updatedOn = input.updatedOn ?? new Date().toISOString();

        const businessObjectiveIds = input.businessObjectiveIds ?? existing?.businessObjectiveIds ?? [];
        const intendedUserRoleIds = input.intendedUserRoleIds ?? existing?.intendedUserRoleIds ?? [];
        const dataSourceIds = input.dataSourceIds ?? existing?.dataSourceIds ?? [];
        const expectedOutcomeIds = input.expectedOutcomeIds ?? existing?.expectedOutcomeIds ?? [];
        const riskFactorIds = input.riskFactorIds ?? existing?.riskFactorIds ?? [];
        const departmentIds = input.departmentIds ?? existing?.departmentIds ?? [];

        // Resolve option GUIDs to their display labels so the concatenated
        // denormalized columns store human-readable values (e.g. "ADT Feed,
        // Electronic Health Record (EHR)") rather than ids.
        const optionRows = await getLookupOptionRows();
        const optionMap = new Map(optionRows.map((option) => [option.id, option]));
        const concatNames = (ids: string[]) =>
          ids
            .map((id) => optionMap.get(id)?.name)
            .filter((name): name is string => Boolean(name))
            .join(', ');

        const body: DataverseRecord = {
          afp_name: `Structured Review - ${input.submissionId}`,
          'afp_submissionid@odata.bind': `/${TABLES.idea}(${input.submissionId})`,
          afp_updatedby: updatedBy,
          afp_updatedon: updatedOn,
        };
        const saved = await upsertRow(TABLES.structuredReview, reviewId, body);

        // Mirror the selected labels as concatenated text onto the parent
        // submission record for reporting/export. This is a partial PATCH, so
        // it only touches these six columns and leaves the rest of the idea
        // record untouched.
        await upsertRow(TABLES.idea, input.submissionId, {
          afp_aicoebusinessobjectives: concatNames(businessObjectiveIds),
          afp_aicoeintendedusers: concatNames(intendedUserRoleIds),
          afp_aicoedatasources: concatNames(dataSourceIds),
          afp_aicoeexpectedoutcomes: concatNames(expectedOutcomeIds),
          afp_aicoeriskfactors: concatNames(riskFactorIds),
          afp_aicoedepartments: concatNames(departmentIds),
        });

        const selectedIds = [
          ...businessObjectiveIds,
          ...intendedUserRoleIds,
          ...dataSourceIds,
          ...expectedOutcomeIds,
          ...riskFactorIds,
          ...departmentIds,
        ].filter(Boolean);

        await replaceStructuredReviewSelections(reviewId, selectedIds);
        const selectedOptions = selectedIds.map((selectedId) => optionMap.get(selectedId)).filter((option): option is LookupOption => Boolean(option));
        return mapStructuredReview(
          {
            ...saved,
            afp_coestructuredreviewid: reviewId,
            afp_submissionid: input.submissionId,
            _afp_submissionid_value: input.submissionId,
            afp_updatedby: updatedBy,
            afp_updatedon: updatedOn,
          },
          selectedOptions,
        );
      },
    },
    coeNotes: {
      async listBySubmission(submissionId: string) {
        const rows = await listRows(
          TABLES.notes,
          // objectid and createdby are lookup columns — they must be selected as
          // their _value forms, never by bare logical name. Selecting bare
          // `objectid` 400s the whole query, which (with retry:false + a []
          // default on the page) silently shows no notes on refresh even though
          // the annotations persisted. The author name comes from the expand.
          selectFields(['annotationid', 'notetext', 'subject', 'createdon', '_createdby_value', '_objectid_value']),
          'createdby($select=fullname)',
        );
        return rows
          .filter((record) => normalizeId(record._objectid_value ?? record.objectid) === submissionId)
          .sort((a, b) => new Date(normalizeDate(b.createdon) ?? '').getTime() - new Date(normalizeDate(a.createdon) ?? '').getTime())
          .map((record) => {
            const createdBy = record.createdby as { fullname?: string } | undefined;
            return {
              id: getRecordGuid(record),
              submissionId,
              noteText: normalizeText(record.notetext),
              subject: normalizeText(record.subject) || undefined,
              createdByName: normalizeText(createdBy?.fullname ?? record._createdby_value ?? 'Unknown user'),
              createdOn: normalizeDate(record.createdon) ?? new Date().toISOString(),
            };
          }) satisfies CoeNote[];
      },
      async create(input: { submissionId: string; noteText: string; subject?: string }) {
        const currentUser = await getCurrentUserContext();
        const noteId = crypto.randomUUID();
        await MicrosoftDataverseService.CreateRecordWithOrganization(
          '',
          '',
          ORG_URL,
          TABLES.notes,
          {
            subject: input.subject ?? 'CoE Note',
            notetext: input.noteText,
            'objectid_afp_idearequirement@odata.bind': `/${TABLES.idea}(${input.submissionId})`,
          },
          true,
        );

        return {
          id: noteId,
          submissionId: input.submissionId,
          noteText: input.noteText,
          subject: input.subject,
          createdByName: currentUser?.fullName ?? 'Current user',
          createdOn: new Date().toISOString(),
        };
      },
    },
    coeApprovalHistory: {
      async listBySubmission(submissionId: string) {
        const rows = await listRows(
          TABLES.approvalHistory,
          // afp_submissionid is a LookupType — select only its `_<name>_value`
          // form. Selecting the bare lookup logical name 400s the whole query,
          // which silently empties the Approval History grid on refresh even
          // after a decision was successfully written.
          selectFields(['afp_approvalhistoryentryid', '_afp_submissionid_value', 'afp_username', 'afp_rolename', 'afp_decision', 'afp_comments', 'afp_reviewedon']),
        );
        return rows
          .filter((record) => normalizeId(record._afp_submissionid_value ?? record.afp_submissionid) === submissionId)
          .sort((a, b) => new Date(normalizeDate(b.afp_reviewedon) ?? '').getTime() - new Date(normalizeDate(a.afp_reviewedon) ?? '').getTime())
          .map(mapApprovalHistory);
      },
      async create(input) {
        const id = crypto.randomUUID();
        const reviewedOn = new Date().toISOString();
        await MicrosoftDataverseService.CreateRecordWithOrganization(
          '',
          '',
          ORG_URL,
          TABLES.approvalHistory,
          {
            afp_name: `${input.submissionId}:${input.userName}:${reviewedOn}`,
            'afp_submissionid@odata.bind': `/${TABLES.idea}(${input.submissionId})`,
            afp_username: input.userName,
            afp_rolename: input.roleName,
            afp_decision: DECISION_VALUES[input.decision],
            afp_comments: input.comments ?? '',
            afp_reviewedon: reviewedOn,
          },
          true,
        );

        return {
          id,
          submissionId: input.submissionId,
          userName: input.userName,
          roleName: input.roleName,
          decision: input.decision,
          comments: input.comments,
          reviewedOn,
        };
      },
    },
    aiCoeRoles: {
      async list(): Promise<AiCoeRole[]> {
        const rows = await listRows(
          TABLES.aiCoeRole,
          selectFields(['afp_aicoerolesid', 'afp_name', 'afp_description']),
        );
        return rows
          .map((record) => ({
            id: normalizeId(record.afp_aicoerolesid),
            name: normalizeText(record.afp_name),
            description: normalizeText(record.afp_description) || undefined,
          }))
          .filter((role) => Boolean(role.id))
          .sort((a, b) => a.name.localeCompare(b.name));
      },
      async save(input: { id?: string; name: string; description?: string }): Promise<AiCoeRole> {
        if (!input.name?.trim()) {
          throw new Error('A role name is required.');
        }
        const id = input.id ?? crypto.randomUUID();
        const body: DataverseRecord = {
          afp_name: input.name.trim(),
          afp_description: input.description?.trim() ?? '',
        };
        await upsertRow(TABLES.aiCoeRole, id, body);
        return {
          id,
          name: body.afp_name as string,
          description: (body.afp_description as string) || undefined,
        };
      },
      async delete(id: string): Promise<void> {
        await MicrosoftDataverseService.DeleteRecordWithOrganization(ORG_URL, TABLES.aiCoeRole, id);
      },
    },
    aiCoeTeam: {
      async list() {
        const [rows, userRows] = await Promise.all([
          listRows(
            TABLES.teamMember,
            selectFields(['afp_aicoeteammemberid', 'afp_name', '_afp_memberid_value', '_afp_roleid_value', 'afp_addedon']),
          ),
          listRows(
            TABLES.systemUser,
            selectFields(['systemuserid', 'fullname', 'internalemailaddress', 'title']),
          ),
        ]);
        const userMap = new Map(userRows.map(mapDirectoryUser).map((user) => [user.id, user]));
        return rows.map((record) => mapTeamMember(record, userMap)).sort((a, b) => a.userName.localeCompare(b.userName));
      },
      async save(input) {
        if (!input.memberId || !input.roleId) {
          throw new Error('A team member and a CoE role are required to save an AI CoE team member.');
        }
        const id = input.id ?? crypto.randomUUID();
        const addedOn = new Date().toISOString();
        const body: DataverseRecord = {
          afp_name: input.userName || input.memberId,
          'afp_memberid@odata.bind': `/${TABLES.systemUser}(${input.memberId})`,
          'afp_roleid@odata.bind': `/${TABLES.aiCoeRole}(${input.roleId})`,
          afp_addedon: addedOn,
        };
        await upsertRow(TABLES.teamMember, id, body);
        return {
          id,
          memberId: input.memberId,
          userId: input.memberId,
          userName: input.userName,
          userEmail: input.userEmail,
          roleId: input.roleId,
          addedOn,
        };
      },
      async delete(id: string) {
        await MicrosoftDataverseService.DeleteRecordWithOrganization(ORG_URL, TABLES.teamMember, id);
      },
    },
    aiCoeTeamApprovals: {
      async listBySubmission(submissionId: string) {
        const rows = await listRows(
          TABLES.teamApproval,
          // afp_submissionid is a LookupType — select only its `_<name>_value`
          // form. afp_teammemberid is a plain string column, so there is no
          // `_afp_teammemberid_value`. Selecting either the bare lookup name or
          // the non-existent value column 400s the whole query, which silently
          // empties the approver list and makes "Add Approver" fail (save reads
          // this list first).
          selectFields(['afp_aicoeteamapprovalid', '_afp_submissionid_value', 'afp_teammemberid', 'statuscode', 'afp_comment', 'afp_reviewedbyname', 'afp_reviewedon', 'modifiedon']),
        );
        return rows
          .filter((record) => normalizeId(record._afp_submissionid_value ?? record.afp_submissionid) === submissionId)
          .map(mapTeamApproval);
      },
      async save(input) {
        if (!input.submissionId || !input.teamMemberId) {
          throw new Error('submissionId and teamMemberId are required to save a team approval.');
        }
        const existing = (await this.listBySubmission(input.submissionId)).find((row) => row.teamMemberId === input.teamMemberId);
        const id = existing?.id ?? crypto.randomUUID();
        const reviewedBy = (await getCurrentUserContext())?.fullName ?? 'Current user';
        const reviewedOn = new Date().toISOString();
        // statuscode is a Status Reason bound to statecode. The custom "Denied"
        // reason (100000002) is associated with the Inactive state, so it is
        // rejected unless statecode is also set to Inactive (1) in the same
        // PATCH. Approved/Pending live under the Active state (0). Always send
        // the matching statecode so a row can move between states on re-decision.
        const statuscode = input.approvalStatus === 'approved' ? 100000001 : input.approvalStatus === 'denied' ? 100000002 : 100000000;
        const statecode = input.approvalStatus === 'denied' ? 1 : 0;
        const body: DataverseRecord = {
          afp_name: `${input.submissionId}:${input.teamMemberId}`,
          'afp_submissionid@odata.bind': `/${TABLES.idea}(${input.submissionId})`,
          afp_teammemberid: input.teamMemberId,
          statecode,
          statuscode,
          afp_comment: input.comment ?? '',
          afp_reviewedbyname: reviewedBy,
          afp_reviewedon: reviewedOn,
        };
        const record = await upsertRow(TABLES.teamApproval, id, body);
        return mapTeamApproval({
          ...record,
          afp_aicoeteamapprovalid: id,
          afp_submissionid: input.submissionId,
          _afp_submissionid_value: input.submissionId,
          afp_teammemberid: input.teamMemberId,
          statuscode: body.statuscode,
          afp_comment: input.comment ?? '',
          afp_reviewedbyname: reviewedBy,
          afp_reviewedon: reviewedOn,
        });
      },
      async delete(id: string) {
        await MicrosoftDataverseService.DeleteRecordWithOrganization(ORG_URL, TABLES.teamApproval, id);
      },
    },
    directoryUsers: {
      async list() {
        const rows = await listRows(
          TABLES.systemUser,
          selectFields(['systemuserid', 'fullname', 'internalemailaddress', 'title', 'isdisabled', 'applicationid']),
        );
        return rows
          .filter((record) => record.isdisabled !== true && !record.applicationid)
          .map(mapDirectoryUser)
          .filter((user) => Boolean(user.displayName) && Boolean(user.email))
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
      },
    },
    fieldMetadata: { getField: getFieldMetadata },
  } satisfies AppDataProvider;
}
