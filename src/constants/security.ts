/**
 * Name of the Dataverse owner team whose members are AI CoE administrators.
 * Membership in this team gates the admin-only navigation and write access in
 * the app. This is a platform security construct and is intentionally distinct
 * from the AI CoE Roles (`afp_aicoeroles`) application data, which captures
 * functional labels and has no bearing on access control.
 */
export const AI_COE_FULL_TEAM_NAME = 'AI CoE Team Full';

/**
 * Name of the Dataverse owner team for read-only solution access. Members can
 * read all records and create/edit their own ideas, but cannot administer the
 * solution. Retained here for reference; the app gates admin UI solely on
 * membership in {@link AI_COE_FULL_TEAM_NAME}.
 */
export const AI_COE_READ_ONLY_TEAM_NAME = 'AI CoE Team Read Only';
