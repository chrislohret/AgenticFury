import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useBlocker } from 'react-router-dom';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CopilotAssistantPanel } from '@/components/copilot-assistant-panel';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useIdeaSubmission,
  useSaveIdeaSubmission,
  useLookupOptions,
  useCoeStructuredReview,
  useSaveCoeStructuredReview,
  useCoeNotes,
  useCreateCoeNote,
  useCoeApprovalHistory,
  useCreateCoeApprovalHistory,
  useAiCoeTeam,
  useAiCoeRoles,
  useAiCoeTeamApprovals,
  useSaveAiCoeTeamApproval,
  useDeleteAiCoeTeamApproval,
} from '@/hooks/usePrototypeData';
import { IDEA_STATUS, IDEA_STATUS_LABELS, IDEA_STATUS_BADGE_VARIANT } from '@/constants/ideaStatus';
import type {
  CoeStructuredReview,
  CoeNote,
  CoeApprovalHistoryEntry,
  AiCoeTeamApproval,
  AiCoeTeamMember,
  LookupOption,
} from '@/types/domain-models';
import { cn } from '@/lib/utils';

interface StructuredFormState {
  businessObjectiveIds: string[];
  intendedUserRoleIds: string[];
  dataSourceIds: string[];
  expectedOutcomeIds: string[];
  riskFactorIds: string[];
  departmentIds: string[];
}

const EMPTY_STRUCTURED_FORM: StructuredFormState = {
  businessObjectiveIds: [],
  intendedUserRoleIds: [],
  dataSourceIds: [],
  expectedOutcomeIds: [],
  riskFactorIds: [],
  departmentIds: [],
};

const IDEA_STATUS_OPTIONS = [
  IDEA_STATUS.DRAFT,
  IDEA_STATUS.SUBMITTED,
  IDEA_STATUS.UNDER_REVIEW,
  IDEA_STATUS.APPROVED,
  IDEA_STATUS.REJECTED,
  IDEA_STATUS.ON_HOLD,
  IDEA_STATUS.IN_PROGRESS,
  IDEA_STATUS.COMPLETED,
] as const;

interface OverallCostsFormState {
  monthlyCopilotCreditsCost: string;
  monthlyCopilotCreditsNotes: string;
  userBasedLicensingCost: string;
  userBasedLicensingNotes: string;
  dataSourceCost: string;
  dataSourceNotes: string;
}

const EMPTY_OVERALL_COSTS_FORM: OverallCostsFormState = {
  monthlyCopilotCreditsCost: '',
  monthlyCopilotCreditsNotes: '',
  userBasedLicensingCost: '',
  userBasedLicensingNotes: '',
  dataSourceCost: '',
  dataSourceNotes: '',
};

function normalizeOverallCostsForm(form: OverallCostsFormState): OverallCostsFormState {
  return {
    monthlyCopilotCreditsCost: form.monthlyCopilotCreditsCost.trim(),
    monthlyCopilotCreditsNotes: form.monthlyCopilotCreditsNotes.trim(),
    userBasedLicensingCost: form.userBasedLicensingCost.trim(),
    userBasedLicensingNotes: form.userBasedLicensingNotes.trim(),
    dataSourceCost: form.dataSourceCost.trim(),
    dataSourceNotes: form.dataSourceNotes.trim(),
  };
}

function parseCost(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeRichTextHtml(html: string): string {
  const collapsed = html.trim().replace(/>\s+</g, '><');
  if (!collapsed) return '';

  const withoutNbsp = collapsed.replace(/&nbsp;/gi, '').trim();
  if (!withoutNbsp) return '';

  if (new RegExp('^(<br\\s*\\/?>|<div><br\\s*\\/?></div>|<p><br\\s*\\/?></p>)$', 'i').test(withoutNbsp)) {
    return '';
  }

  return collapsed;
}

function toStructuredForm(review: CoeStructuredReview | null): StructuredFormState {
  if (!review) {
    return EMPTY_STRUCTURED_FORM;
  }
  return {
    businessObjectiveIds: review.businessObjectiveIds,
    intendedUserRoleIds: review.intendedUserRoleIds,
    dataSourceIds: review.dataSourceIds,
    expectedOutcomeIds: review.expectedOutcomeIds,
    riskFactorIds: review.riskFactorIds,
    departmentIds: review.departmentIds,
  };
}

// ── CoE Activity Notes (Dataverse `annotation` table) ──────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-green-600', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-600', 'bg-indigo-500', 'bg-teal-600',
] as const;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatNoteDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

function NoteTimelineItem({ note }: { note: CoeNote }) {
  return (
    <div className="flex gap-3">
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 mt-0.5',
          getAvatarColor(note.createdByName),
        )}
      >
        {getInitials(note.createdByName)}
      </div>
      <div className="flex-1 min-w-0 pb-4 border-b last:border-b-0 last:pb-0">
        <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
          <span className="text-sm font-medium">{note.createdByName}</span>
          <span className="text-xs text-muted-foreground">{formatNoteDate(note.createdOn)}</span>
        </div>
        {note.subject && (
          <p className="text-xs font-medium text-muted-foreground mb-1">{note.subject}</p>
        )}
        <p className="text-sm whitespace-pre-wrap">{note.noteText}</p>
      </div>
    </div>
  );
}

const APPROVAL_HISTORY_LABELS: Record<CoeApprovalHistoryEntry['decision'], string> = {
  approved: 'Approved',
  denied: 'Denied',
};

const APPROVAL_HISTORY_VARIANTS: Record<CoeApprovalHistoryEntry['decision'], 'default' | 'destructive'> = {
  approved: 'default',
  denied: 'destructive',
};

function formatApprovalDate(iso: string) {
  return new Date(iso).toLocaleString();
}

const APPROVAL_STATUS_LABELS: Record<AiCoeTeamApproval['approvalStatus'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
};

const APPROVAL_STATUS_VARIANTS: Record<AiCoeTeamApproval['approvalStatus'], 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  denied: 'destructive',
};

function ApprovalActionRow({
  member,
  roleName,
  approval,
  comment,
  onCommentChange,
  onApprove,
  onDeny,
  onDelete,
  isSaving,
}: {
  member: AiCoeTeamMember;
  roleName: string;
  approval: AiCoeTeamApproval | undefined;
  comment: string;
  onCommentChange: (value: string) => void;
  onApprove: () => void;
  onDeny: () => void;
  onDelete: () => void;
  isSaving: boolean;
}) {
  const status = approval?.approvalStatus ?? 'pending';

  return (
    <TableRow>
      <TableCell className="align-top">
        <p className="font-medium">{member.userName}</p>
        <p className="text-xs text-muted-foreground">{member.userEmail}</p>
      </TableCell>
      <TableCell className="align-top">{roleName}</TableCell>
      <TableCell className="align-top w-[42%] min-w-80">
        <Textarea
          rows={2}
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Add notes for this approval decision."
        />
      </TableCell>
      <TableCell className="align-top">
        <Badge variant={APPROVAL_STATUS_VARIANTS[status]}>{APPROVAL_STATUS_LABELS[status]}</Badge>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-2">
          <Button size="sm" onClick={onApprove} disabled={isSaving}>Approve</Button>
          <Button size="sm" variant="destructive" onClick={onDeny} disabled={isSaving}>Deny</Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            disabled={isSaving}
            aria-label={`Remove ${member.userName} as approver`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | boolean | null }) {
  if (value === undefined || value === null || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{display}</p>
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 opacity-60 mt-0.5 shrink-0" /> : <ChevronDown className="h-4 w-4 opacity-60 mt-0.5 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-6">
          {children}
        </div>
      )}
    </section>
  );
}

function LookupMultiSelectField({
  label,
  options,
  selectedIds,
  onChange,
}: {
  label: string;
  options: LookupOption[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const selectedItems = options.filter((option) => selectedIds.includes(option.id));

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
      >
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <span className="text-xs text-muted-foreground">{selectedItems.length} selected</span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 opacity-50" /> : <ChevronDown className="h-4 w-4 opacity-50" />}
        </div>
      </button>

      {expanded && (
        <div className="rounded-md border bg-background divide-y max-h-48 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No options available.</p>
          ) : (
            options.map((option) => (
              <label
                key={option.id}
                className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <Checkbox
                  checked={selectedIds.includes(option.id)}
                  onCheckedChange={() => toggle(option.id)}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-sm">{option.name}</span>
                  {option.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  )}
                </div>
              </label>
            ))
          )}
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {selectedItems.map((item) => (
            <Badge key={item.id} variant="secondary" className="text-xs">{item.name}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function structuredFormKey(form: StructuredFormState) {
  return JSON.stringify([
    [...form.businessObjectiveIds].sort(),
    [...form.intendedUserRoleIds].sort(),
    [...form.dataSourceIds].sort(),
    [...form.expectedOutcomeIds].sort(),
    [...form.riskFactorIds].sort(),
    [...form.departmentIds].sort(),
  ]);
}

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: submission, isLoading } = useIdeaSubmission(id);
  const relatedSubmissionId = submission?.id;
  const canLoadRelatedData = Boolean(relatedSubmissionId);
  const saveIdeaSubmission = useSaveIdeaSubmission();
  const { data: structuredReview } = useCoeStructuredReview(relatedSubmissionId);
  const { data: notes = [] } = useCoeNotes(relatedSubmissionId);
  const { data: members = [], isLoading: membersLoading } = useAiCoeTeam(canLoadRelatedData);
  const { data: approvals = [], isLoading: approvalsLoading } = useAiCoeTeamApprovals(relatedSubmissionId);
  const { data: approvalHistory = [], isLoading: approvalHistoryLoading } = useCoeApprovalHistory(relatedSubmissionId);
  const saveStructuredReview = useSaveCoeStructuredReview();
  const createNote = useCreateCoeNote();
  const saveApproval = useSaveAiCoeTeamApproval();
  const deleteApproval = useDeleteAiCoeTeamApproval(relatedSubmissionId);
  const createApprovalHistory = useCreateCoeApprovalHistory();

  const [addApproverMemberId, setAddApproverMemberId] = useState<string>('');

  const businessObjectiveOptions = useLookupOptions('business-objectives', canLoadRelatedData);
  const intendedUserRoleOptions = useLookupOptions('intended-user-roles', canLoadRelatedData);
  const dataSourceOptions = useLookupOptions('data-sources', canLoadRelatedData);
  const expectedOutcomeOptions = useLookupOptions('expected-outcomes', canLoadRelatedData);
  const riskFactorOptions = useLookupOptions('risk-factors', canLoadRelatedData);
  const departmentOptions = useLookupOptions('departments', canLoadRelatedData);
  const aiCoeRoleOptions = useAiCoeRoles(canLoadRelatedData);

  const [form, setForm] = useState<StructuredFormState>(EMPTY_STRUCTURED_FORM);
  const [newNoteText, setNewNoteText] = useState('');
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [costImagePreview, setCostImagePreview] = useState<string | null>(null);
  const [imageEdited, setImageEdited] = useState(false);
  const estimatedCostsFileInputRef = useRef<HTMLInputElement | null>(null);
  const overallNotesEditorRef = useRef<HTMLDivElement | null>(null);
  const [overallCostsForm, setOverallCostsForm] = useState<OverallCostsFormState>(EMPTY_OVERALL_COSTS_FORM);
  const [overallNotesHtml, setOverallNotesHtml] = useState<string>('');

  useEffect(() => {
    setForm(toStructuredForm(structuredReview ?? null));
  }, [structuredReview]);

  useEffect(() => {
    setSelectedStatus(submission?.status ?? null);
  }, [submission?.status]);

  useEffect(() => {
    setTitleDraft(submission?.title ?? '');
  }, [submission?.title]);

  useEffect(() => {
    setCostImagePreview(submission?.estimatedCostsImageUrl ?? null);
    setImageEdited(false);
  }, [submission?.estimatedCostsImageUrl]);

  useEffect(() => {
    setOverallCostsForm({
      monthlyCopilotCreditsCost: submission?.monthlyCopilotCreditsCost?.toString() ?? '',
      monthlyCopilotCreditsNotes: submission?.monthlyCopilotCreditsNotes ?? '',
      userBasedLicensingCost: submission?.userBasedLicensingCost?.toString() ?? '',
      userBasedLicensingNotes: submission?.userBasedLicensingNotes ?? '',
      dataSourceCost: submission?.dataSourceCost?.toString() ?? '',
      dataSourceNotes: submission?.dataSourceNotes ?? '',
    });
    setOverallNotesHtml(normalizeRichTextHtml(submission?.overallCostNotesHtml ?? ''));
  }, [
    submission?.monthlyCopilotCreditsCost,
    submission?.monthlyCopilotCreditsNotes,
    submission?.userBasedLicensingCost,
    submission?.userBasedLicensingNotes,
    submission?.dataSourceCost,
    submission?.dataSourceNotes,
    submission?.overallCostNotesHtml,
  ]);

  useEffect(() => {
    if (!overallNotesEditorRef.current) return;
    if (normalizeRichTextHtml(overallNotesEditorRef.current.innerHTML) !== overallNotesHtml) {
      overallNotesEditorRef.current.innerHTML = overallNotesHtml;
    }
  }, [overallNotesHtml]);

  const activeBusinessObjectiveOptions = useMemo(
    () => (businessObjectiveOptions.data ?? []).filter((option) => option.isActive),
    [businessObjectiveOptions.data],
  );
  const activeIntendedUserRoleOptions = useMemo(
    () => (intendedUserRoleOptions.data ?? []).filter((option) => option.isActive),
    [intendedUserRoleOptions.data],
  );
  const activeDataSourceOptions = useMemo(
    () => (dataSourceOptions.data ?? []).filter((option) => option.isActive),
    [dataSourceOptions.data],
  );
  const activeExpectedOutcomeOptions = useMemo(
    () => (expectedOutcomeOptions.data ?? []).filter((option) => option.isActive),
    [expectedOutcomeOptions.data],
  );
  const activeRiskFactorOptions = useMemo(
    () => (riskFactorOptions.data ?? []).filter((option) => option.isActive),
    [riskFactorOptions.data],
  );
  const activeDepartmentOptions = useMemo(
    () => (departmentOptions.data ?? []).filter((option) => option.isActive),
    [departmentOptions.data],
  );

  const roleMap = useMemo(
    () =>
      new Map(
        (aiCoeRoleOptions.data ?? []).map((role) => [role.id, role.name]),
      ),
    [aiCoeRoleOptions.data],
  );

  const approvalMap = useMemo(
    () => new Map(approvals.map((approval) => [approval.teamMemberId, approval])),
    [approvals],
  );

  // Only team members who have an explicit approval record on this submission
  const approvedMemberIds = useMemo(
    () => new Set(approvals.map((a) => a.teamMemberId)),
    [approvals],
  );

  const approverMembers = useMemo(
    () =>
      members
        .filter((m) => approvedMemberIds.has(m.id))
        .sort((a, b) => a.userName.localeCompare(b.userName)),
    [members, approvedMemberIds],
  );

  // Members not yet added as approvers — available for the Add Approver picker
  const addableMembers = useMemo(
    () =>
      members
        .filter((m) => !approvedMemberIds.has(m.id))
        .sort((a, b) => a.userName.localeCompare(b.userName)),
    [members, approvedMemberIds],
  );

  const copilotContext = useMemo(
    () => ({
      submissionId: submission?.id ?? '',
      title: submission?.title ?? 'Unknown submission',
      statusLabel: IDEA_STATUS_LABELS[submission?.status ?? -1] ?? 'Unknown',
      department: submission?.department,
      phiRequired: submission?.phiRequired ?? false,
      monthlyCopilotCreditsCost: overallCostsForm.monthlyCopilotCreditsCost || undefined,
      userBasedLicensingCost: overallCostsForm.userBasedLicensingCost || undefined,
      dataSourceCost: overallCostsForm.dataSourceCost || undefined,
      approvalCount: approvals.length,
      approvalHistoryCount: approvalHistory.length,
    }),
    [
      approvalHistory.length,
      approvals.length,
      overallCostsForm.dataSourceCost,
      overallCostsForm.monthlyCopilotCreditsCost,
      overallCostsForm.userBasedLicensingCost,
      submission?.department,
      submission?.id,
      submission?.phiRequired,
      submission?.status,
      submission?.title,
    ],
  );

  useEffect(() => {
    setApprovalComments((current) => {
      const next: Record<string, string> = {};
      let changed = Object.keys(current).length !== members.length;
      for (const member of members) {
        const value = current[member.id] ?? approvalMap.get(member.id)?.comment ?? '';
        next[member.id] = value;
        if (current[member.id] !== value) changed = true;
      }
      // Return the existing reference when nothing changed so React bails out of
      // the state update. `members`/`approvalMap` can be fresh references on every
      // render (the underlying queries default to a new `[]` while data is
      // undefined), so unconditionally returning a new object here creates an
      // infinite render loop that freezes all navigation on this page.
      return changed ? next : current;
    });
  }, [members, approvalMap]);

  // The page tracks unsaved edits explicitly: the flag flips to true only when
  // the user changes a field, and resets to false when a different record loads
  // or a save succeeds. Tracking explicit edits — rather than diffing snapshots
  // of server data against local state — avoids false "dirty" positives caused
  // by the post-save server round-trip re-hydrating local state with normalized
  // or re-categorized values.
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  function markEdited() {
    setHasUnsavedEdits(true);
  }

  const loadedRecordKey = `${submission?.id ?? ''}|${structuredReview?.id ?? ''}`;
  const loadedRecordKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadedRecordKeyRef.current !== loadedRecordKey) {
      loadedRecordKeyRef.current = loadedRecordKey;
      setHasUnsavedEdits(false);
    }
  }, [loadedRecordKey]);

  const isDirty = hasUnsavedEdits;
  const isSaving = saveIdeaSubmission.isPending || saveStructuredReview.isPending;

  const blocker = useBlocker(isDirty);

  // Safety net: if the record becomes clean (e.g. after a save) while a
  // navigation is still parked in the blocked state, release the blocker so the
  // "Unsaved changes" dialog can't linger once there is nothing left to save.
  useEffect(() => {
    if (!isDirty && blocker.state === 'blocked') {
      blocker.reset?.();
    }
  }, [isDirty, blocker]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  function handleStatusChange(value: string) {
    markEdited();
    setSelectedStatus(Number(value));
  }

  async function handleSaveAll(): Promise<boolean> {
    if (!submission || !relatedSubmissionId) return false;

    const html = normalizeRichTextHtml(overallNotesEditorRef.current?.innerHTML ?? overallNotesHtml);
    const normalizedOverallCosts = normalizeOverallCostsForm(overallCostsForm);
    const normalizedOverallNotesHtml = html;
    if (normalizedOverallNotesHtml !== overallNotesHtml) {
      setOverallNotesHtml(normalizedOverallNotesHtml);
    }

    const structuredChanged =
      structuredFormKey(form) !== structuredFormKey(toStructuredForm(structuredReview ?? null));

    try {
      await saveIdeaSubmission.mutateAsync({
        id: submission.id,
        title: titleDraft.trim() || submission.title,
        status: selectedStatus ?? submission.status,
        // Only send the image when the user actually changed it. Re-sending the
        // downloaded data URL on every save forces a needless re-upload of the
        // virtual afp_estimatedcostsimage column, which can fail and abort the
        // whole save after the text fields were already committed.
        ...(imageEdited ? { estimatedCostsImageUrl: costImagePreview ?? '' } : {}),
        monthlyCopilotCreditsCost: parseCost(normalizedOverallCosts.monthlyCopilotCreditsCost),
        monthlyCopilotCreditsNotes: normalizedOverallCosts.monthlyCopilotCreditsNotes || undefined,
        userBasedLicensingCost: parseCost(normalizedOverallCosts.userBasedLicensingCost),
        userBasedLicensingNotes: normalizedOverallCosts.userBasedLicensingNotes || undefined,
        dataSourceCost: parseCost(normalizedOverallCosts.dataSourceCost),
        dataSourceNotes: normalizedOverallCosts.dataSourceNotes || undefined,
        overallCostNotesHtml: normalizedOverallNotesHtml || undefined,
      });

      if (structuredChanged) {
        await saveStructuredReview.mutateAsync({
          submissionId: relatedSubmissionId,
          ...(structuredReview?.id ? { id: structuredReview.id } : {}),
          businessObjectiveIds: form.businessObjectiveIds,
          intendedUserRoleIds: form.intendedUserRoleIds,
          dataSourceIds: form.dataSourceIds,
          expectedOutcomeIds: form.expectedOutcomeIds,
          riskFactorIds: form.riskFactorIds,
          departmentIds: form.departmentIds,
        });
      }

      toast.success('Changes saved.');
      setOverallCostsForm(normalizedOverallCosts);
      setImageEdited(false);
      setHasUnsavedEdits(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast.error(`Failed to save changes: ${message}`);
      return false;
    }
  }

  async function handleSaveAndLeave() {
    const ok = await handleSaveAll();
    if (ok) blocker.proceed?.();
  }

  function applyOverallNotesCommand(command: 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList' | 'createLink') {
    if (!overallNotesEditorRef.current) return;
    overallNotesEditorRef.current.focus();
    markEdited();

    if (command === 'createLink') {
      const url = window.prompt('Enter link URL (include https://):');
      if (!url) return;
      document.execCommand('createLink', false, url);
      setOverallNotesHtml(normalizeRichTextHtml(overallNotesEditorRef.current.innerHTML));
      return;
    }

    document.execCommand(command, false);
    setOverallNotesHtml(normalizeRichTextHtml(overallNotesEditorRef.current.innerHTML));
  }

  function handleEstimatedCostsImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        markEdited();
        setImageEdited(true);
        setCostImagePreview(result);
      } else {
        toast.error('Unable to read selected image file.');
      }
    };
    reader.onerror = () => {
      toast.error('Unable to read selected image file.');
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async function handleAddNote() {
    if (!relatedSubmissionId || !newNoteText.trim()) return;
    try {
      await createNote.mutateAsync({ submissionId: relatedSubmissionId, noteText: newNoteText.trim() });
      setNewNoteText('');
      toast.success('Note added.');
    } catch {
      toast.error('Failed to add note.');
    }
  }

  async function handleAddApprover() {
    if (!relatedSubmissionId || !addApproverMemberId) return;
    try {
      await saveApproval.mutateAsync({
        submissionId: relatedSubmissionId,
        teamMemberId: addApproverMemberId,
        approvalStatus: 'pending',
      });
      setAddApproverMemberId('');
      toast.success('Approver added.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast.error(`Failed to add approver: ${message}`);
    }
  }

  async function handleDeleteApprover(approval: AiCoeTeamApproval, memberName: string) {
    try {
      await deleteApproval.mutateAsync(approval.id);
      toast.success(`${memberName} removed as approver.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast.error(`Failed to remove approver: ${message}`);
    }
  }

  async function handleApprovalDecision(member: AiCoeTeamMember, decision: 'approved' | 'denied') {
    if (!relatedSubmissionId) return;

    const comment = approvalComments[member.id]?.trim() ?? '';

    const roleName = roleMap.get(member.roleId) ?? 'Unknown role';

    try {
      await saveApproval.mutateAsync({
        submissionId: relatedSubmissionId,
        teamMemberId: member.id,
        approvalStatus: decision,
        comment: comment || undefined,
      });

      await createApprovalHistory.mutateAsync({
        submissionId: relatedSubmissionId,
        userName: member.userName,
        roleName,
        decision,
        comments: comment || undefined,
      });

      toast.success(`${member.userName} marked as ${decision}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast.error(`Failed to save approval decision: ${message}`);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Submission not found.</p>
        <Button variant="link" asChild className="px-0 mt-2">
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="sticky top-0 z-20 -mx-6 -mt-6 flex items-center justify-between gap-4 border-b bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <p className="text-sm text-muted-foreground">
          {isDirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </p>
        <Button onClick={() => void handleSaveAll()} disabled={!isDirty || isSaving}>
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
      <div>
        <Button variant="link" asChild className="px-0 mb-2 h-auto text-muted-foreground">
          <Link to="/dashboard">← Back to Dashboard</Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{submission.title}</h1>
          <div className="flex items-start gap-3 shrink-0">
            <div className="min-w-48 space-y-1.5">
              <Label>Update submission status to:</Label>
              <Select
                value={String(selectedStatus ?? submission.status)}
                onValueChange={handleStatusChange}
                disabled={saveIdeaSubmission.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {IDEA_STATUS_OPTIONS.map((statusValue) => (
                    <SelectItem key={statusValue} value={String(statusValue)}>
                      {IDEA_STATUS_LABELS[statusValue] ?? `Status ${statusValue}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Current Status</Label>
              <div className="flex items-center gap-2">
                {submission.phiRequired && <Badge variant="destructive">PHI</Badge>}
                <Badge variant={IDEA_STATUS_BADGE_VARIANT[submission.status]}>
                  {IDEA_STATUS_LABELS[submission.status] ?? 'Unknown'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {submission.department && `${submission.department} · `}
          Submitted {submission.createdOn ?? 'unknown'}
        </p>
      </div>

      <CollapsibleSection
        title="Copilot Assistant"
        subtitle="Scaffolded assistant panel grounded on this submission context."
        defaultOpen={false}
      >
        <CopilotAssistantPanel context={copilotContext} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Section 1: Submitted Idea + CoE Structured Intake"
        subtitle="Read-only original idea details and editable structured CoE intake."
      >
        <div className="grid xl:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader><CardTitle className="text-base">Submitted Idea (Read Only)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <DetailRow label="Title" value={submission.title} />
              <Separator />
              <DetailRow label="Business Objectives" value={submission.businessObjectives} />
              <Separator />
              <DetailRow label="Intended Users / Roles" value={submission.intendedUserRoles} />
              <Separator />
              <DetailRow label="Data Sources" value={submission.dataSources} />
              <Separator />
              <DetailRow label="Expected Outcomes" value={submission.expectedOutcomes} />
              <Separator />
              <DetailRow label="Risk Factors / Regulatory Impact" value={submission.riskFactors} />
              <Separator />
              <DetailRow label="PHI Required" value={submission.phiRequired} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">CoE Structured Intake</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="coe-intake-title">Title</Label>
                <Input
                  id="coe-intake-title"
                  value={titleDraft}
                  onChange={(e) => { markEdited(); setTitleDraft(e.target.value); }}
                  placeholder="Idea title"
                  disabled={saveIdeaSubmission.isPending}
                />
              </div>

              <LookupMultiSelectField
                label="Business Objectives"
                options={activeBusinessObjectiveOptions}
                selectedIds={form.businessObjectiveIds}
                onChange={(next) => { markEdited(); setForm((prev) => ({ ...prev, businessObjectiveIds: next })); }}
              />

              <LookupMultiSelectField
                label="Intended User Roles"
                options={activeIntendedUserRoleOptions}
                selectedIds={form.intendedUserRoleIds}
                onChange={(next) => { markEdited(); setForm((prev) => ({ ...prev, intendedUserRoleIds: next })); }}
              />

              <LookupMultiSelectField
                label="Data Sources"
                options={activeDataSourceOptions}
                selectedIds={form.dataSourceIds}
                onChange={(next) => { markEdited(); setForm((prev) => ({ ...prev, dataSourceIds: next })); }}
              />

              <LookupMultiSelectField
                label="Expected Outcomes"
                options={activeExpectedOutcomeOptions}
                selectedIds={form.expectedOutcomeIds}
                onChange={(next) => { markEdited(); setForm((prev) => ({ ...prev, expectedOutcomeIds: next })); }}
              />

              <LookupMultiSelectField
                label="Risk Factors"
                options={activeRiskFactorOptions}
                selectedIds={form.riskFactorIds}
                onChange={(next) => { markEdited(); setForm((prev) => ({ ...prev, riskFactorIds: next })); }}
              />

              <LookupMultiSelectField
                label="Department"
                options={activeDepartmentOptions}
                selectedIds={form.departmentIds}
                onChange={(next) => { markEdited(); setForm((prev) => ({ ...prev, departmentIds: next })); }}
              />

            </CardContent>
          </Card>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Section 2: CoE Activities"
        subtitle="Activity notes related to this idea."
      >
        {/* CoE Activity Notes — backed by Dataverse annotation table */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">CoE Activity Notes</CardTitle>
            <p className="text-xs text-muted-foreground">
              Notes are visible to all CoE reviewers and stored as activity records in Dataverse.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                rows={3}
                placeholder="Add a note visible to all CoE reviewers…"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!newNoteText.trim() || createNote.isPending}
              >
                Post Note
              </Button>
            </div>

            {notes.length > 0 && (
              <>
                <Separator />
                <div className="space-y-0">
                  {notes.map((note) => (
                    <NoteTimelineItem key={note.id} note={note} />
                  ))}
                </div>
              </>
            )}

            {notes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No notes yet. Post the first note above.
              </p>
            )}
          </CardContent>
        </Card>
      </CollapsibleSection>

      <CollapsibleSection
        title="Section 3: Estimated Costs"
        subtitle="Capture overall costs, agent credit image evidence, and supporting notes."
      >
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Section A: Overall Costs</CardTitle>
            <p className="text-xs text-muted-foreground">
              Capture high-level costs and rationale notes.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="monthly-copilot-credits-cost">Monthly Copilot Credits</Label>
                <Input
                  id="monthly-copilot-credits-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={overallCostsForm.monthlyCopilotCreditsCost}
                  onChange={(e) => {
                    markEdited();
                    setOverallCostsForm((current) => ({ ...current, monthlyCopilotCreditsCost: e.target.value }));
                  }}
                  placeholder="e.g., 12500"
                  disabled={saveIdeaSubmission.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly-copilot-credits-notes">Monthly Copilot Credits Notes</Label>
                <Textarea
                  id="monthly-copilot-credits-notes"
                  rows={2}
                  value={overallCostsForm.monthlyCopilotCreditsNotes}
                  onChange={(e) => {
                    markEdited();
                    setOverallCostsForm((current) => ({ ...current, monthlyCopilotCreditsNotes: e.target.value }));
                  }}
                  placeholder="Assumptions and details for monthly credit usage."
                  disabled={saveIdeaSubmission.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-based-licensing-cost">User Based Licensing Costs</Label>
                <Input
                  id="user-based-licensing-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={overallCostsForm.userBasedLicensingCost}
                  onChange={(e) => {
                    markEdited();
                    setOverallCostsForm((current) => ({ ...current, userBasedLicensingCost: e.target.value }));
                  }}
                  placeholder="e.g., 1200"
                  disabled={saveIdeaSubmission.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-based-licensing-notes">User Based Licensing Notes</Label>
                <Textarea
                  id="user-based-licensing-notes"
                  rows={2}
                  value={overallCostsForm.userBasedLicensingNotes}
                  onChange={(e) => {
                    markEdited();
                    setOverallCostsForm((current) => ({ ...current, userBasedLicensingNotes: e.target.value }));
                  }}
                  placeholder="Number of users, SKUs, and licensing assumptions."
                  disabled={saveIdeaSubmission.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data-source-cost">Data Source Costs</Label>
                <Input
                  id="data-source-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={overallCostsForm.dataSourceCost}
                  onChange={(e) => {
                    markEdited();
                    setOverallCostsForm((current) => ({ ...current, dataSourceCost: e.target.value }));
                  }}
                  placeholder="e.g., 450"
                  disabled={saveIdeaSubmission.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data-source-notes">Data Source Costs Notes</Label>
                <Textarea
                  id="data-source-notes"
                  rows={2}
                  value={overallCostsForm.dataSourceNotes}
                  onChange={(e) => {
                    markEdited();
                    setOverallCostsForm((current) => ({ ...current, dataSourceNotes: e.target.value }));
                  }}
                  placeholder="Connector, API, storage, or compute cost assumptions."
                  disabled={saveIdeaSubmission.isPending}
                />
              </div>
            </div>

          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Section B: Agent Credit Costs</CardTitle>
            <p className="text-xs text-muted-foreground">
              Upload a screenshot from the Copilot Credit Estimator
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => estimatedCostsFileInputRef.current?.click()}
                disabled={saveIdeaSubmission.isPending}
              >
                Upload Image
              </Button>
              <input
                id="estimated-costs-image"
                type="file"
                accept="image/*"
                onChange={handleEstimatedCostsImageUpload}
                disabled={saveIdeaSubmission.isPending}
                ref={estimatedCostsFileInputRef}
                className="hidden"
              />
              {costImagePreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { markEdited(); setImageEdited(true); setCostImagePreview(null); }}
                  disabled={saveIdeaSubmission.isPending}
                >
                  Remove Image
                </Button>
              )}
            </div>

            {costImagePreview ? (
              <div className="rounded-md border p-3 bg-muted/20">
                <p className="text-sm font-medium mb-2">Agent Credit Costs</p>
                <img
                  src={costImagePreview}
                  alt="Estimated costs"
                  className="max-h-[420px] w-auto rounded-md border bg-background"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No estimated costs image uploaded.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Section C: Overall Notes</CardTitle>
            <p className="text-xs text-muted-foreground">
              Add rich-text notes with formatting, lists, and links.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => applyOverallNotesCommand('bold')}>
                Bold
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyOverallNotesCommand('italic')}>
                Italic
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyOverallNotesCommand('underline')}>
                Underline
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyOverallNotesCommand('insertUnorderedList')}>
                Bulleted List
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyOverallNotesCommand('insertOrderedList')}>
                Numbered List
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyOverallNotesCommand('createLink')}>
                Add Link
              </Button>
            </div>

            <div
              ref={overallNotesEditorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                markEdited();
                setOverallNotesHtml(
                  normalizeRichTextHtml((e.currentTarget as HTMLDivElement).innerHTML),
                );
              }}
              className="min-h-44 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Overall notes rich text editor"
            />

          </CardContent>
        </Card>
      </CollapsibleSection>

      <CollapsibleSection
        title="Section 4: Approvals"
        subtitle="Current approvals and read-only approval history for this idea."
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approvals</CardTitle>
            <p className="text-xs text-muted-foreground">
              Decide approval or denial per CoE team member for this idea.
            </p>
          </CardHeader>
          <CardContent>
            {membersLoading || approvalsLoading ? (
              <p className="text-sm text-muted-foreground">Loading approvals…</p>
            ) : (
              <div className="space-y-4">
                {/* Add Approver row */}
                {members.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Select value={addApproverMemberId} onValueChange={setAddApproverMemberId}>
                      <SelectTrigger className="w-72">
                        <SelectValue placeholder="Select a team member to add…" />
                      </SelectTrigger>
                      <SelectContent>
                        {addableMembers.length === 0 ? (
                          <SelectItem value="__none" disabled>All team members added</SelectItem>
                        ) : (
                          addableMembers.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.userName} — {roleMap.get(m.roleId) ?? 'Unknown role'}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => void handleAddApprover()}
                      disabled={!addApproverMemberId || saveApproval.isPending}
                    >
                      Add Approver
                    </Button>
                  </div>
                )}

                {/* Approvers table */}
                {approverMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No approvers assigned yet. Use the picker above to add CoE team members.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Comments</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-36">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approverMembers.map((member) => (
                          <ApprovalActionRow
                            key={member.id}
                            member={member}
                            roleName={roleMap.get(member.roleId) ?? 'Unknown role'}
                            approval={approvalMap.get(member.id)}
                            comment={approvalComments[member.id] ?? ''}
                            onCommentChange={(value) =>
                              setApprovalComments((current) => ({ ...current, [member.id]: value }))
                            }
                            onApprove={() => void handleApprovalDecision(member, 'approved')}
                            onDeny={() => void handleApprovalDecision(member, 'denied')}
                            onDelete={() => {
                              const approval = approvalMap.get(member.id);
                              if (approval) void handleDeleteApprover(approval, member.userName);
                            }}
                            isSaving={saveApproval.isPending || deleteApproval.isPending || createApprovalHistory.isPending}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval History</CardTitle>
            <p className="text-xs text-muted-foreground">
              Read-only log of every approval and denial related to this idea.
            </p>
          </CardHeader>
          <CardContent>
            {approvalHistoryLoading ? (
              <p className="text-sm text-muted-foreground">Loading approval history…</p>
            ) : approvalHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approval history yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead>Date / Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="align-top">
                          <p className="font-medium">{entry.userName}</p>
                        </TableCell>
                        <TableCell className="align-top">{entry.roleName}</TableCell>
                        <TableCell className="align-top">
                          <Badge variant={APPROVAL_HISTORY_VARIANTS[entry.decision]}>
                            {APPROVAL_HISTORY_LABELS[entry.decision]}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <p className="text-sm whitespace-pre-wrap">{entry.comments ?? '—'}</p>
                        </TableCell>
                        <TableCell className="align-top text-sm text-muted-foreground">
                          {formatApprovalDate(entry.reviewedOn)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleSection>

      <Dialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes on this page. Do you want to save them before leaving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => blocker.proceed?.()}
              disabled={isSaving}
            >
              Leave without saving
            </Button>
            <Button onClick={() => void handleSaveAndLeave()} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save & leave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
