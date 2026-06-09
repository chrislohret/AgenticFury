import { MicrosoftCopilotStudioService } from '@/generated/services/MicrosoftCopilotStudioService';

export interface SubmissionCopilotContext {
  submissionId: string;
  title: string;
  statusLabel: string;
  department?: string;
  phiRequired: boolean;
  monthlyCopilotCreditsCost?: string;
  userBasedLicensingCost?: string;
  dataSourceCost?: string;
  approvalCount: number;
  approvalHistoryCount: number;
}

export interface SendCopilotRequest {
  message: string;
  context: SubmissionCopilotContext;
  conversationId?: string;
}

export interface CopilotAgentResponse {
  conversationId: string;
  lastResponse: string;
  responses: string[];
  completed: boolean;
}

/**
 * The published Copilot Studio agent's schema name (case-sensitive, includes the
 * publisher prefix). Overridable per-environment via VITE_COPILOT_AGENT_NAME.
 */
const COPILOT_AGENT_NAME =
  (import.meta.env.VITE_COPILOT_AGENT_NAME as string | undefined)?.trim() ||
  'afp_pageContextQAAssistant';

/**
 * Required by the connector contract but unused in synchronous (wait-for-response)
 * mode — the host resolves the agent reply inline.
 */
const NOTIFICATION_URL_PLACEHOLDER = 'https://notificationurlplaceholder';

/**
 * Serializes the current submission context so the agent can answer questions
 * grounded in the record the user is looking at.
 */
function buildContextPreamble(context: SubmissionCopilotContext): string {
  const facts: Record<string, unknown> = {
    submissionId: context.submissionId,
    title: context.title,
    status: context.statusLabel,
    department: context.department,
    phiRequired: context.phiRequired,
    monthlyCopilotCreditsCost: context.monthlyCopilotCreditsCost,
    userBasedLicensingCost: context.userBasedLicensingCost,
    dataSourceCost: context.dataSourceCost,
    approverCount: context.approvalCount,
    approvalHistoryEntries: context.approvalHistoryCount,
  };
  return `Submission context (JSON):\n${JSON.stringify(facts, null, 2)}`;
}

/** Response property casing can vary; read every known variant. */
function readString(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function readStringArray(data: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
  }
  return [];
}

export async function sendCopilotMessage(input: SendCopilotRequest): Promise<CopilotAgentResponse> {
  const prompt = `${buildContextPreamble(input.context)}\n\nUser question: ${input.message}`;

  // The generated service types the result payload as `void`, but the connector
  // returns the agent's reply inline in synchronous mode — read it off `data`.
  const result = await MicrosoftCopilotStudioService.ExecuteCopilotAsyncV2(
    COPILOT_AGENT_NAME,
    {
      message: prompt,
      notificationUrl: NOTIFICATION_URL_PLACEHOLDER,
    },
    input.conversationId,
  );

  if (!result.success) {
    throw result.error ?? new Error('Copilot agent request failed.');
  }

  const data = (result.data ?? {}) as unknown as Record<string, unknown>;

  const responses = readStringArray(data, 'responses', 'Responses');
  const lastResponse =
    readString(data, 'lastResponse', 'LastResponse') ??
    responses[responses.length - 1] ??
    'The agent did not return a response.';
  const conversationId =
    readString(data, 'conversationId', 'ConversationId', 'conversationID') ??
    input.conversationId ??
    crypto.randomUUID();

  return {
    conversationId,
    lastResponse,
    responses: responses.length > 0 ? responses : [lastResponse],
    completed: true,
  };
}
