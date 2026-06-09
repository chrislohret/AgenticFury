import fs from 'node:fs';
import path from 'node:path';

const orgUrl = process.env.DV_ORG_URL || 'https://orgf2352485.crm.dynamics.com';
const tokenFile = process.env.DV_ACCESS_TOKEN_FILE || path.join(process.env.TEMP || process.env.TMPDIR || '.', 'dv_token.txt');
const solutionUniqueName = process.env.DV_SOLUTION_UNIQUE_NAME || '';
const planPath = path.resolve('dataverse/planning-payload.json');

function readToken() {
  if (process.env.DV_ACCESS_TOKEN) {
    return process.env.DV_ACCESS_TOKEN.trim();
  }

  if (!fs.existsSync(tokenFile)) {
    throw new Error(`Dataverse token file not found at ${tokenFile}`);
  }

  return fs.readFileSync(tokenFile, 'utf8').trim();
}

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

function typedName(value) {
  return { Value: value };
}

function boolLabel(trueText, falseText) {
  return {
    TrueOption: {
      Value: 1,
      Label: label(trueText),
    },
    FalseOption: {
      Value: 0,
      Label: label(falseText),
    },
    OptionSetType: 'Boolean',
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(endpoint, { method = 'GET', body, headers = {} } = {}) {
  const maxAttempts = 8;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${orgUrl}/api/data/v9.2${endpoint}`, {
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

    if (response.status === 204) {
      return null;
    }

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return response.json();
      }

      return response.text();
    }

    const text = await response.text();
    const isLockError = text.includes('CustomizationLockException') || text.includes('0x80071151');
    const isDeadlock = text.includes('Sql Number: 1205') || text.includes('-2146232060');

    if ((response.status === 429 || isLockError || isDeadlock) && attempt < maxAttempts) {
      const waitMs = Math.min(30000, 3000 * attempt);
      console.log(`Customization lock on ${method} ${endpoint}; retrying in ${waitMs}ms (attempt ${attempt}/${maxAttempts})`);
      await delay(waitMs);
      continue;
    }

    throw new Error(`${method} ${endpoint} failed with ${response.status}: ${text}`);
  }

  throw new Error(`${method} ${endpoint} failed after ${maxAttempts} attempts`);
}

async function getJson(endpoint) {
  const response = await fetch(`${orgUrl}/api/data/v9.2${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET ${endpoint} failed with ${response.status}: ${text}`);
  }

  return response.json();
}

async function ensureGlobalOptionSet(optionSet) {
  const existing = await getJson(`/GlobalOptionSetDefinitions(Name='${optionSet.name}')?$select=Name`);
  if (existing) {
    console.log(`Global option set exists: ${optionSet.name}`);
    return;
  }

  await requestJson('/GlobalOptionSetDefinitions', {
    method: 'POST',
    body: {
      '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
      Name: optionSet.name,
      DisplayName: label(optionSet.displayName),
      Description: label(optionSet.description),
      OptionSetType: 'Picklist',
      Options: optionSet.options.map((option) => ({
        Value: option.value,
        Label: label(option.label),
      })),
    },
  });

  console.log(`Created global option set: ${optionSet.name}`);
}

async function getGlobalOptionSetMetadataId(name) {
  const optionSet = await getJson(`/GlobalOptionSetDefinitions(Name='${name}')?$select=MetadataId`);
  if (!optionSet?.MetadataId) {
    throw new Error(`Unable to resolve global option set metadata ID for ${name}`);
  }

  return optionSet.MetadataId;
}

function primaryNameAttribute(table) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
    AttributeType: 'String',
    AttributeTypeName: typedName('StringType'),
    SchemaName: table.primaryName.schemaName,
    DisplayName: label(table.primaryName.displayName),
    Description: label(table.primaryName.description),
    RequiredLevel: requiredLevel('None'),
    MaxLength: table.primaryName.maxLength,
    FormatName: typedName('Text'),
    IsPrimaryName: true,
  };
}

async function ensureTable(table) {
  const existing = await getJson(`/EntityDefinitions(LogicalName='${table.logicalSingularName}')?$select=LogicalName`);
  if (existing) {
    console.log(`Table exists: ${table.logicalSingularName}`);
    return;
  }

  await requestJson('/EntityDefinitions', {
    method: 'POST',
    body: {
      '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
      SchemaName: table.schemaName,
      DisplayName: label(table.displayName),
      DisplayCollectionName: label(table.displayCollectionName),
      Description: label(table.description),
      OwnershipType: table.ownership,
      IsActivity: table.isActivity,
      HasActivities: table.hasActivities,
      HasNotes: table.hasNotes,
      Attributes: [primaryNameAttribute(table)],
    },
  });

  console.log(`Created table: ${table.logicalSingularName}`);
}

function columnBody(column) {
  const common = {
    SchemaName: column.schemaName,
    DisplayName: label(column.displayName),
    RequiredLevel: requiredLevel(column.requiredLevel === 'ApplicationRequired' ? 'ApplicationRequired' : 'None'),
  };

  if (column.description) {
    common.Description = label(column.description);
  }

  if (column.type === 'String') {
    return {
      '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
      AttributeType: 'String',
      AttributeTypeName: typedName('StringType'),
      FormatName: typedName('Text'),
      MaxLength: column.maxLength ?? 100,
      ...common,
    };
  }

  if (column.type === 'Memo') {
    return {
      '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
      AttributeType: 'Memo',
      AttributeTypeName: typedName('MemoType'),
      Format: 'TextArea',
      ImeMode: 'Disabled',
      MaxLength: column.maxLength ?? 4000,
      IsLocalizable: false,
      ...common,
    };
  }

  if (column.type === 'Boolean') {
    return {
      '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
      AttributeType: 'Boolean',
      AttributeTypeName: typedName('BooleanType'),
      DefaultValue: column.defaultValue ?? false,
      OptionSet: boolLabel(column.trueLabel ?? 'Yes', column.falseLabel ?? 'No'),
      ...common,
    };
  }

  if (column.type === 'DateTime') {
    return {
      '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
      AttributeType: 'DateTime',
      AttributeTypeName: typedName('DateTimeType'),
      Format: column.format ?? 'DateAndTime',
      ...common,
    };
  }

  if (column.type === 'Image') {
    return {
      '@odata.type': 'Microsoft.Dynamics.CRM.ImageAttributeMetadata',
      AttributeTypeName: typedName('ImageType'),
      MaxSizeInKB: column.maxSizeInKB ?? 30720,
      CanStoreFullImage: column.canStoreFullImage ?? true,
      ...common,
    };
  }

  if (column.type === 'Picklist') {
    const body = {
      '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
      AttributeType: 'Picklist',
      AttributeTypeName: typedName('PicklistType'),
      ...common,
    };

    return body;
  }

  throw new Error(`Unsupported column type ${column.type} for ${column.schemaName}`);
}

async function ensureColumn(table, column) {
  const body = columnBody(column);
  if (!body) {
    console.log(`Skipping unsupported column type ${column.type}: ${table.logicalSingularName}.${column.logicalName}`);
    return;
  }

  if (column.type === 'Picklist' && column.globalOptionSetName) {
    const metadataId = await getGlobalOptionSetMetadataId(column.globalOptionSetName);
    body['GlobalOptionSet@odata.bind'] = `/GlobalOptionSetDefinitions(${metadataId})`;
  }

  const existing = await getJson(`/EntityDefinitions(LogicalName='${table.logicalSingularName}')/Attributes(LogicalName='${column.logicalName}')?$select=LogicalName`);
  if (existing) {
    console.log(`Column exists: ${table.logicalSingularName}.${column.logicalName}`);
    return;
  }

  await requestJson(`/EntityDefinitions(LogicalName='${table.logicalSingularName}')/Attributes`, {
    method: 'POST',
    body,
  });

  console.log(`Created column: ${table.logicalSingularName}.${column.logicalName}`);
}

async function ensureStatusValues(table, statuses) {
  const existingStatuses = new Set();
  const optionSet = await getJson(
    `/EntityDefinitions(LogicalName='${table.logicalSingularName}')/Attributes(LogicalName='statuscode')/Microsoft.Dynamics.CRM.StatusAttributeMetadata?$select=LogicalName&$expand=OptionSet`,
  );

  for (const option of optionSet?.OptionSet?.Options || []) {
    const labelText = option?.Label?.UserLocalizedLabel?.Label || option?.Label?.LocalizedLabels?.[0]?.Label;
    if (labelText) {
      existingStatuses.add(labelText.toLowerCase());
    }
  }

  for (const status of statuses) {
    if (existingStatuses.has(status.label.toLowerCase())) {
      console.log(`Status value exists for ${table.logicalSingularName}: ${status.label}`);
      continue;
    }

    await requestJson('/InsertStatusValue', {
      method: 'POST',
      body: {
        AttributeLogicalName: 'statuscode',
        EntityLogicalName: table.logicalSingularName,
        Label: label(status.label),
        StateCode: status.state,
        ...(solutionUniqueName ? { SolutionUniqueName: solutionUniqueName } : {}),
      },
    });
    console.log(`Inserted status value for ${table.logicalSingularName}: ${status.label}`);
  }
}

function lookupBody(relationship) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
    AttributeType: 'Lookup',
    AttributeTypeName: typedName('LookupType'),
    SchemaName: relationship.lookupSchemaName,
    DisplayName: label(relationship.lookupLabel),
    Description: label(relationship.lookupDescription),
    RequiredLevel: requiredLevel('None'),
  };
}

function relationshipBody(relationship) {
  return {
    SchemaName: relationship.schemaName,
    '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
    AssociatedMenuConfiguration: {
      Behavior: 'UseLabel',
      Group: 'Details',
      Label: label(relationship.lookupLabel),
      Order: 10000,
    },
    CascadeConfiguration: {
      Assign: 'Cascade',
      Delete: 'Cascade',
      Merge: 'Cascade',
      Reparent: 'Cascade',
      Share: 'Cascade',
      Unshare: 'Cascade',
    },
    ReferencedAttribute: relationship.referencedAttribute,
    ReferencedEntity: relationship.referencedEntity,
    ReferencingEntity: relationship.referencingEntity,
    Lookup: lookupBody(relationship),
  };
}

async function ensureRelationship(relationship) {
  const existing = await getJson(`/RelationshipDefinitions?$select=SchemaName&$filter=SchemaName eq '${relationship.schemaName}'`);
  if (existing?.value?.length) {
    console.log(`Relationship exists: ${relationship.schemaName}`);
    return;
  }

  await requestJson('/RelationshipDefinitions', {
    method: 'POST',
    body: relationshipBody(relationship),
  });

  console.log(`Created relationship: ${relationship.schemaName}`);
}

async function publishAll() {
  await requestJson('/PublishAllXml', { method: 'POST', body: {} });
  console.log('Published all customizations');
}

const token = readToken();
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

const globalOptionSets = [
  {
    name: 'afp_approvalstage',
    displayName: 'Approval Stage',
    description: 'Approval stage labels used by approval stage records.',
    options: [
      { value: 100000000, label: 'CoE Review' },
      { value: 100000001, label: 'IT Sign-off' },
      { value: 100000002, label: 'Executive Approval' },
    ],
  },
  {
    name: 'afp_approvalstagestatus',
    displayName: 'Approval Stage Status',
    description: 'Status labels used by approval stage records.',
    options: [
      { value: 100000000, label: 'Pending' },
      { value: 100000001, label: 'Approved' },
      { value: 100000002, label: 'Rejected' },
      { value: 100000003, label: 'On Hold' },
    ],
  },
  {
    name: 'afp_lookupoptioncategory',
    displayName: 'Lookup Option Category',
    description: 'Categories for reusable lookup options.',
    options: [
      { value: 100000000, label: 'Business Objectives' },
      { value: 100000001, label: 'Intended User Roles' },
      { value: 100000002, label: 'Data Sources' },
      { value: 100000003, label: 'Expected Outcomes' },
      { value: 100000004, label: 'Risk Factors' },
      { value: 100000005, label: 'Departments' },
      { value: 100000006, label: 'AI CoE Roles' },
    ],
  },
  {
    name: 'afp_approvaldecision',
    displayName: 'Approval Decision',
    description: 'Approval history decision labels.',
    options: [
      { value: 100000000, label: 'Approved' },
      { value: 100000001, label: 'Denied' },
    ],
  },
];

const statusPlans = {
  afp_idearequirement: [
    { label: 'Draft', state: 0 },
    { label: 'Submitted', state: 0 },
    { label: 'Under Review', state: 0 },
    { label: 'Approved', state: 1 },
    { label: 'Rejected', state: 1 },
    { label: 'On Hold', state: 0 },
    { label: 'In Progress', state: 0 },
    { label: 'Completed', state: 1 },
  ],
  afp_approvalstagerecord: [
    { label: 'Pending', state: 0 },
    { label: 'Approved', state: 0 },
    { label: 'Rejected', state: 1 },
    { label: 'On Hold', state: 0 },
  ],
  afp_aicoeteamapproval: [
    { label: 'Pending', state: 0 },
    { label: 'Approved', state: 0 },
    { label: 'Denied', state: 1 },
  ],
};

const relationshipLookupMap = {
  afp_ApprovalStageRecord_IdeaRequirement: {
    lookupSchemaName: 'afp_submissionid',
    lookupLabel: 'Idea Requirement',
    lookupDescription: 'Links an approval stage record to its idea requirement.',
    referencedAttribute: 'afp_idearequirementid',
  },
  afp_CoeStructuredReview_IdeaRequirement: {
    lookupSchemaName: 'afp_submissionid',
    lookupLabel: 'Submission',
    lookupDescription: 'Links a structured review to its idea requirement.',
    referencedAttribute: 'afp_idearequirementid',
  },
  afp_CoeStructuredReviewSelection_CoeStructuredReview: {
    lookupSchemaName: 'afp_reviewid',
    lookupLabel: 'Review',
    lookupDescription: 'Links a review selection to its structured review.',
    referencedAttribute: 'afp_coestructuredreviewid',
  },
  afp_CoeStructuredReviewSelection_LookupOption: {
    lookupSchemaName: 'afp_lookupoptionid',
    lookupLabel: 'Lookup Option',
    lookupDescription: 'Links a review selection to a lookup option.',
    referencedAttribute: 'afp_lookupoptionid',
  },
  afp_AiCoeTeamMember_LookupOption: {
    lookupSchemaName: 'afp_roleid',
    lookupLabel: 'Role',
    lookupDescription: 'Links a team member to an AI CoE role.',
    referencedAttribute: 'afp_lookupoptionid',
  },
  afp_AiCoeTeamApproval_IdeaRequirement: {
    lookupSchemaName: 'afp_submissionid',
    lookupLabel: 'Submission',
    lookupDescription: 'Links an AI CoE team approval to its idea requirement.',
    referencedAttribute: 'afp_idearequirementid',
  },
  afp_AiCoeTeamApproval_AiCoeTeamMember: {
    lookupSchemaName: 'afp_teammemberid',
    lookupLabel: 'Team Member',
    lookupDescription: 'Links an AI CoE team approval to its team member.',
    referencedAttribute: 'afp_aicoeteammemberid',
  },
  afp_ApprovalHistoryEntry_IdeaRequirement: {
    lookupSchemaName: 'afp_submissionid',
    lookupLabel: 'Submission',
    lookupDescription: 'Links an approval history entry to its idea requirement.',
    referencedAttribute: 'afp_idearequirementid',
  },
};

async function main() {
  console.log(`Provisioning Dataverse schema for ${orgUrl}`);

  for (const optionSet of globalOptionSets) {
    await ensureGlobalOptionSet(optionSet);
  }

  for (const table of plan.tables || []) {
    await ensureTable(table);
  }

  for (const [tableLogicalName, statuses] of Object.entries(statusPlans)) {
    const table = (plan.tables || []).find((item) => item.logicalSingularName === tableLogicalName);
    if (table) {
      await ensureStatusValues(table, statuses);
    }
  }

  for (const table of plan.tables || []) {
    for (const column of table.columns || []) {
      if (column.type === 'Lookup') {
        continue;
      }

      await ensureColumn(table, column);
    }
  }

  for (const relationship of plan.relationships || []) {
    const lookup = relationshipLookupMap[relationship.schemaName];
    if (!lookup) {
      throw new Error(`Missing lookup mapping for relationship ${relationship.schemaName}`);
    }

    await ensureRelationship({
      ...relationship,
      ...lookup,
    });
  }

  await publishAll();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});