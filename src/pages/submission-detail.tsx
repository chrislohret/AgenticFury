import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useBlocker } from 'react-router-dom';
import { ChevronDown, ChevronUp, Trash2, ChevronLeft, ChevronRight, ExternalLink, FileText, MessageSquare } from 'lucide-react';
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
import { SubmissionProcessFlow } from '@/components/SubmissionProcessFlow';
// Inlined as a base64 data URL via vite.config.ts `build.assetsInlineLimit`.
// A separate hashed asset file would be fetched through the Power Apps storage
// proxy at runtime, which is unreliable inside the host iframe (the image
// silently fails to load). A data URL has no runtime fetch.
import platformSelectorImg from '@/assets/platform_selector.png';
import m365AgentBuilderImg from '@/assets/M365 Agent Builder.png';
import copilotStudioImg from '@/assets/Microsoft Copilot Studio.png';
import aiFoundryImg from '@/assets/Microsoft AI Foundry.png';
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
  useIdeaScorecard,
  useCoeNotes,
  useCreateCoeNote,
  useCoeApprovalHistory,
  useCreateCoeApprovalHistory,
  useAiCoeTeam,
  useAiCoeRoles,
  useAiCoeTeamApprovals,
  useSaveAiCoeTeamApproval,
  useDeleteAiCoeTeamApproval,
  useIdeaRealization,
  useSaveIdeaRealization,
} from '@/hooks/usePrototypeData';
import {
  submissionStageLabel,
  type SubmissionStageValue,
} from '@/constants/submissionStage';
import {
  BUILD_STAGE,
  buildStageLabel,
} from '@/constants/buildStage';
import { approvalStatusLabel } from '@/constants/approvalStatus';
import { getScoreBand } from '@/constants/scorecard';
import { AI_PLATFORM_OPTIONS } from '@/constants/aiPlatform';
import type {
  CoeStructuredReview,
  CoeNote,
  CoeApprovalHistoryEntry,
  AiCoeTeamApproval,
  AiCoeTeamMember,
  LookupOption,
  IdeaOutcomeRating,
} from '@/types/domain-models';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

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

// ── Platform selection carousel slides ─────────────────────────────────────

const PLATFORM_SLIDES: { src: string; label: string }[] = [
  { src: m365AgentBuilderImg, label: 'Microsoft 365 Agent Builder' },
  { src: copilotStudioImg, label: 'Microsoft Copilot Studio' },
  { src: aiFoundryImg, label: 'Microsoft AI Foundry' },
];

// ── AI platform selection (afp_aiplatformselection choice column) ───────────

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
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32 rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
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

const DETAIL_SECTIONS = [
  { id: 'section-copilot', label: 'Copilot Assistant' },
  { id: 'section-intake', label: 'Submitted Idea + Normalized Idea' },
  { id: 'section-platform', label: 'Platform & Estimated Costs' },
  { id: 'section-approvals', label: 'Approvals' },
  { id: 'section-realization', label: 'Realized Outcomes' },
] as const;

// Realized outcomes are only relevant once an approved idea is being built.
const REALIZATION_BUILD_STAGES: number[] = [BUILD_STAGE.IN_PROGRESS, BUILD_STAGE.COMPLETED];

const OUTCOME_RATING_OPTIONS: { value: IdeaOutcomeRating; label: string }[] = [
  { value: 747150000, label: 'Exceeded Expectations' },
  { value: 747150001, label: 'Met Expectations' },
  { value: 747150002, label: 'Below Expectations' },
  { value: 747150003, label: 'Failed / Abandoned' },
];

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: submission, isLoading } = useIdeaSubmission(id);
  const relatedSubmissionId = submission?.id;
  const canLoadRelatedData = Boolean(relatedSubmissionId);
  const saveIdeaSubmission = useSaveIdeaSubmission();
  const { data: structuredReview } = useCoeStructuredReview(relatedSubmissionId);
  const { data: scorecard } = useIdeaScorecard(relatedSubmissionId);
  const { data: notes = [] } = useCoeNotes(relatedSubmissionId);
  const { data: members = [], isLoading: membersLoading } = useAiCoeTeam(canLoadRelatedData);
  const { data: approvals = [], isLoading: approvalsLoading } = useAiCoeTeamApprovals(relatedSubmissionId);
  const { data: approvalHistory = [], isLoading: approvalHistoryLoading } = useCoeApprovalHistory(relatedSubmissionId);
  const { data: realization } = useIdeaRealization(relatedSubmissionId);
  const saveStructuredReview = useSaveCoeStructuredReview();
  const createNote = useCreateCoeNote();
  const saveApproval = useSaveAiCoeTeamApproval();
  const deleteApproval = useDeleteAiCoeTeamApproval(relatedSubmissionId);
  const createApprovalHistory = useCreateCoeApprovalHistory();
  const saveRealization = useSaveIdeaRealization();

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
  const [selectedBuildStage, setSelectedBuildStage] = useState<number | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<number | null>(null);
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [platformCarouselOpen, setPlatformCarouselOpen] = useState(false);
  const [platformSlideIndex, setPlatformSlideIndex] = useState(0);
  const [costPdfPreview, setCostPdfPreview] = useState<string | null>(null);
  const [costPdfName, setCostPdfName] = useState<string | null>(null);
  const [pdfEdited, setPdfEdited] = useState(false);
  const estimatedCostsFileInputRef = useRef<HTMLInputElement | null>(null);
  const [overallCostsForm, setOverallCostsForm] = useState<OverallCostsFormState>(EMPTY_OVERALL_COSTS_FORM);
  const [platformSelection, setPlatformSelection] = useState<string>('');
  const [assignedReviewerId, setAssignedReviewerId] = useState<string>('');
  const [realizationForm, setRealizationForm] = useState({
    actualMonthlyCost: '',
    realizedBenefit: '',
    actualGoLiveDate: '',
    outcomeRating: '',
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'section-copilot': false,
    'section-intake': true,
    'section-platform': false,
    'section-approvals': false,
    'section-realization': false,
  });
  const allSectionsOpen = DETAIL_SECTIONS.every((s) => openSections[s.id]);
  const toggleSection = (sectionId: string) =>
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  const setAllSections = (open: boolean) =>
    setOpenSections(Object.fromEntries(DETAIL_SECTIONS.map((s) => [s.id, open])));
  const goToSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: true }));
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const [activeSection, setActiveSection] = useState<string>(DETAIL_SECTIONS[0].id);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-140px 0px -55% 0px', threshold: 0 },
    );
    DETAIL_SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [openSections]);

  useEffect(() => {
    setForm(toStructuredForm(structuredReview ?? null));
  }, [structuredReview]);

  useEffect(() => {
    setSelectedStatus(submission?.submissionStage ?? null);
    setStatusChangeReason('');
  }, [submission?.submissionStage]);

  useEffect(() => {
    setSelectedBuildStage(submission?.buildStage ?? null);
  }, [submission?.buildStage]);

  useEffect(() => {
    setSelectedApproval(submission?.approvalStatus ?? null);
  }, [submission?.approvalStatus]);

  useEffect(() => {
    setTitleDraft(submission?.title ?? '');
  }, [submission?.title]);

  useEffect(() => {
    setAssignedReviewerId(submission?.assignedReviewer ?? '');
  }, [submission?.assignedReviewer]);

  useEffect(() => {
    setRealizationForm({
      actualMonthlyCost: realization?.actualMonthlyCost?.toString() ?? '',
      realizedBenefit: realization?.realizedBenefit ?? '',
      actualGoLiveDate: realization?.actualGoLiveDate ? realization.actualGoLiveDate.split('T')[0] : '',
      outcomeRating: realization?.outcomeRating != null ? String(realization.outcomeRating) : '',
    });
  }, [realization]);

  useEffect(() => {
    setCostPdfPreview(submission?.copilotCreditEstimatorPdfUrl ?? null);
    setCostPdfName(submission?.copilotCreditEstimatorPdfName ?? null);
    setPdfEdited(false);
  }, [submission?.copilotCreditEstimatorPdfUrl, submission?.copilotCreditEstimatorPdfName]);

  useEffect(() => {
    setOverallCostsForm({
      monthlyCopilotCreditsCost: submission?.monthlyCopilotCreditsCost?.toString() ?? '',
      monthlyCopilotCreditsNotes: submission?.monthlyCopilotCreditsNotes ?? '',
      userBasedLicensingCost: submission?.userBasedLicensingCost?.toString() ?? '',
      userBasedLicensingNotes: submission?.userBasedLicensingNotes ?? '',
      dataSourceCost: submission?.dataSourceCost?.toString() ?? '',
      dataSourceNotes: submission?.dataSourceNotes ?? '',
    });
    setPlatformSelection(
      submission?.aiPlatformSelection != null ? String(submission.aiPlatformSelection) : '',
    );
  }, [
    submission?.monthlyCopilotCreditsCost,
    submission?.monthlyCopilotCreditsNotes,
    submission?.userBasedLicensingCost,
    submission?.userBasedLicensingNotes,
    submission?.dataSourceCost,
    submission?.dataSourceNotes,
    submission?.aiPlatformSelection,
  ]);

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

  // Resolve the assigned reviewer's display name from the CoE team roster
  // (members carry the systemuser GUID in `memberId`), falling back to the
  // expanded name the provider returns on the submission record.
  const assignedReviewerLabel = useMemo(() => {
    if (!assignedReviewerId) return submission?.assignedReviewerName ?? '';
    const match = members.find((m) => m.memberId === assignedReviewerId);
    return match?.userName ?? submission?.assignedReviewerName ?? '';
  }, [assignedReviewerId, members, submission?.assignedReviewerName]);

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
      statusLabel: submissionStageLabel(submission?.submissionStage ?? null),
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
      submission?.submissionStage,
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

  function handleBuildStageChange(value: string) {
    markEdited();
    setSelectedBuildStage(value === 'none' ? null : Number(value));
  }

  function handleApprovalChange(value: string) {
    markEdited();
    setSelectedApproval(value === 'pending' ? null : Number(value));
  }

  async function handleAssignReviewer(memberSystemUserId: string) {
    if (!submission) return;
    const previous = assignedReviewerId;
    setAssignedReviewerId(memberSystemUserId);
    try {
      await saveIdeaSubmission.mutateAsync({ id: submission.id, assignedReviewer: memberSystemUserId });
      toast.success('Reviewer assigned.');
    } catch (error) {
      setAssignedReviewerId(previous);
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast.error(`Failed to assign reviewer: ${message}`);
    }
  }

  async function handleSaveRealization() {
    if (!relatedSubmissionId) return;
    const cost = realizationForm.actualMonthlyCost.trim();
    const parsedCost = cost === '' ? undefined : Number(cost);
    if (parsedCost !== undefined && !Number.isFinite(parsedCost)) {
      toast.error('Actual monthly cost must be a number.');
      return;
    }
    try {
      await saveRealization.mutateAsync({
        submissionId: relatedSubmissionId,
        actualMonthlyCost: parsedCost,
        realizedBenefit: realizationForm.realizedBenefit.trim() || undefined,
        actualGoLiveDate: realizationForm.actualGoLiveDate || undefined,
        outcomeRating: realizationForm.outcomeRating
          ? (Number(realizationForm.outcomeRating) as IdeaOutcomeRating)
          : undefined,
      });
      toast.success('Realized outcomes saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast.error(`Failed to save realized outcomes: ${message}`);
    }
  }

  async function handleSaveAll(): Promise<boolean> {
    if (!submission || !relatedSubmissionId) return false;

    const normalizedOverallCosts = normalizeOverallCostsForm(overallCostsForm);

    const structuredChanged =
      structuredFormKey(form) !== structuredFormKey(toStructuredForm(structuredReview ?? null));

    const nextStage = selectedStatus ?? submission.submissionStage ?? null;
    const currentStage = submission.submissionStage ?? null;
    const stageChanged = nextStage !== currentStage;
    if (stageChanged && !statusChangeReason.trim()) {
      toast.error('Add a reason for the status change.');
      return false;
    }

    const nextBuildStage = selectedBuildStage;
    const currentBuildStage = submission.buildStage ?? null;
    const buildStageChanged = nextBuildStage !== currentBuildStage;

    const nextApproval = selectedApproval;
    const currentApproval = submission.approvalStatus ?? null;
    const approvalChanged = nextApproval !== currentApproval;

    try {
      await saveIdeaSubmission.mutateAsync({
        id: submission.id,
        title: titleDraft.trim() || submission.title,
        submissionStage: nextStage as SubmissionStageValue | null,
        approvalStatus: nextApproval,
        buildStage: nextBuildStage,
        // Only send the PDF when the user actually changed it. Re-sending the
        // downloaded data URL on every save forces a needless re-upload of the
        // afp_copilotcreditestimatorpdf File column, which can fail and abort the
        // whole save after the text fields were already committed.
        ...(pdfEdited
          ? {
              copilotCreditEstimatorPdfUrl: costPdfPreview ?? '',
              copilotCreditEstimatorPdfName: costPdfName ?? undefined,
            }
          : {}),
        monthlyCopilotCreditsCost: parseCost(normalizedOverallCosts.monthlyCopilotCreditsCost),
        monthlyCopilotCreditsNotes: normalizedOverallCosts.monthlyCopilotCreditsNotes || undefined,
        userBasedLicensingCost: parseCost(normalizedOverallCosts.userBasedLicensingCost),
        userBasedLicensingNotes: normalizedOverallCosts.userBasedLicensingNotes || undefined,
        dataSourceCost: parseCost(normalizedOverallCosts.dataSourceCost),
        dataSourceNotes: normalizedOverallCosts.dataSourceNotes || undefined,
        aiPlatformSelection: platformSelection ? Number(platformSelection) : undefined,
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

      if (stageChanged) {
        const fromLabel = submissionStageLabel(currentStage);
        const toLabel = submissionStageLabel(nextStage);
        try {
          await createNote.mutateAsync({
            submissionId: relatedSubmissionId,
            subject: 'Status change',
            noteText: `Submission stage changed: ${fromLabel} → ${toLabel}. Reason: ${statusChangeReason.trim()}`,
          });
        } catch {
          // The status itself saved; a failed activity note should not abort.
          toast.warning('Status saved, but the activity note could not be recorded.');
        }
        setStatusChangeReason('');
      }

      if (buildStageChanged) {
        const fromLabel = buildStageLabel(currentBuildStage);
        const toLabel = buildStageLabel(nextBuildStage);
        try {
          await createNote.mutateAsync({
            submissionId: relatedSubmissionId,
            subject: 'Build phase change',
            noteText: `Build phase changed: ${fromLabel} → ${toLabel}.`,
          });
        } catch {
          toast.warning('Build phase saved, but the activity note could not be recorded.');
        }
      }

      if (approvalChanged) {
        const fromLabel = approvalStatusLabel(currentApproval);
        const toLabel = approvalStatusLabel(nextApproval);
        try {
          await createNote.mutateAsync({
            submissionId: relatedSubmissionId,
            subject: 'Approval decision change',
            noteText: `Approval decision changed: ${fromLabel} → ${toLabel}.`,
          });
        } catch {
          toast.warning('Approval decision saved, but the activity note could not be recorded.');
        }
      }

      toast.success('Changes saved.');
      setOverallCostsForm(normalizedOverallCosts);
      setPdfEdited(false);
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

  function handleEstimatedCostsPdfUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        toast.error('Unable to read selected PDF file.');
        return;
      }
      // The PDF is its own standalone artifact: persist it immediately so the
      // upload does not flip the form into a "dirty" state and prompt the user
      // to Save when they navigate away. It writes only the File column and
      // merges every other field from the existing record server-side.
      setCostPdfPreview(result);
      setCostPdfName(file.name);
      if (!submission) return;
      try {
        await saveIdeaSubmission.mutateAsync({
          id: submission.id,
          copilotCreditEstimatorPdfUrl: result,
          copilotCreditEstimatorPdfName: file.name,
        });
        toast.success('PDF uploaded.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error.';
        toast.error(`Failed to upload PDF: ${message}`);
      }
    };
    reader.onerror = () => {
      toast.error('Unable to read selected PDF file.');
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async function handleRemovePdf() {
    setCostPdfPreview(null);
    setCostPdfName(null);
    if (!submission) return;
    try {
      await saveIdeaSubmission.mutateAsync({
        id: submission.id,
        copilotCreditEstimatorPdfUrl: '',
        copilotCreditEstimatorPdfName: undefined,
      });
      toast.success('PDF removed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast.error(`Failed to remove PDF: ${message}`);
    }
  }

  function handleOpenPdf() {
    if (!costPdfPreview) return;
    try {
      let blobUrl: string;
      if (costPdfPreview.startsWith('data:')) {
        const commaIndex = costPdfPreview.indexOf(',');
        const base64 = costPdfPreview.slice(commaIndex + 1);
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        blobUrl = URL.createObjectURL(blob);
      } else {
        blobUrl = costPdfPreview;
      }
      const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        toast.error('Unable to open PDF. Please allow pop-ups for this app.');
      }
    } catch {
      toast.error('Unable to open the PDF.');
    }
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
    <div className="p-6 max-w-7xl space-y-6">
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
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{submission.title}</h1>
              {submission.phiRequired && <Badge variant="destructive">PHI</Badge>}
            </div>
          </div>
          <div className="flex items-start gap-2 shrink-0 rounded-lg border bg-card p-3">
            <div className="space-y-1.5">
              <Label>Scorecard</Label>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/submissions/${submission.id}/scorecard`}>
                  Scorecard
                  {typeof scorecard?.weightedTotal === 'number' && (
                    <Badge variant="secondary" className="ml-2">
                      {scorecard.weightedTotal} / 100
                    </Badge>
                  )}
                </Link>
              </Button>
              {(() => {
                const band = getScoreBand(scorecard?.weightedTotal);
                return band ? (
                  <Badge variant={band.badgeVariant} title={band.description}>
                    {band.label}
                  </Badge>
                ) : null;
              })()}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {submission.department && `${submission.department} · `}
          Submitted {submission.createdOn ?? 'unknown'}
          {assignedReviewerLabel && ` · Reviewer: ${assignedReviewerLabel}`}
        </p>
        <div className="mt-4">
          <SubmissionProcessFlow
            submissionStage={submission.submissionStage ?? null}
            approvalStatus={submission.approvalStatus ?? null}
            buildStage={submission.buildStage ?? null}
            selectedStage={selectedStatus}
            selectedApproval={selectedApproval}
            selectedBuildStage={selectedBuildStage}
            onStageChange={handleStatusChange}
            onApprovalChange={handleApprovalChange}
            onBuildChange={handleBuildStageChange}
            statusChangeReason={statusChangeReason}
            onReasonChange={setStatusChangeReason}
            disabled={saveIdeaSubmission.isPending}
          />
        </div>
      </div>

      <div className="sticky top-12 z-10 -mx-6 flex flex-wrap items-center gap-2 border-b bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <span className="text-xs font-medium text-muted-foreground mr-1">Jump to:</span>
        {DETAIL_SECTIONS.map((section) => (
          <Button
            key={section.id}
            variant={activeSection === section.id ? 'secondary' : 'ghost'}
            size="sm"
            aria-current={activeSection === section.id ? 'true' : undefined}
            className={cn('h-7 px-2 text-xs', activeSection === section.id && 'font-medium')}
            onClick={() => goToSection(section.id)}
          >
            {section.label}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-7 px-2 text-xs"
          onClick={() => setAllSections(!allSectionsOpen)}
        >
          {allSectionsOpen ? 'Collapse all' : 'Expand all'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setNotesOpen(true)}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Notes
          {notes.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] leading-4">
              {notes.length}
            </Badge>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 items-start">
        <div className="space-y-6 min-w-0">
      <CollapsibleSection
        id="section-copilot"
        title="Copilot Assistant"
        subtitle="Scaffolded assistant panel grounded on this submission context."
        open={openSections['section-copilot']}
        onToggle={toggleSection}
      >
        <CopilotAssistantPanel context={copilotContext} />
      </CollapsibleSection>

      <CollapsibleSection
        id="section-intake"
        title="Section 1: Submitted Idea + Normalized Idea"
        subtitle="Read-only original idea details and editable structured CoE intake."
        open={openSections['section-intake']}
        onToggle={toggleSection}
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
            <CardHeader><CardTitle className="text-base">Normalized Idea</CardTitle></CardHeader>
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
        id="section-platform"
        title="Section 2: Platform Selection and Estimated Costs"
        subtitle="Capture overall costs, agent credit image evidence, and supporting notes."
        open={openSections['section-platform']}
        onToggle={toggleSection}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Section A: Platform Selection</CardTitle>
            <p className="text-xs text-muted-foreground">
              Choose the target AI platform for this idea.
            </p>
            <button
              type="button"
              onClick={() => { setPlatformSlideIndex(0); setPlatformCarouselOpen(true); }}
              className="mt-3 block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open platform options carousel"
            >
              <img
                src={platformSelectorImg}
                alt="Platform selector — click to view platform options"
                className="w-full max-w-2xl rounded-md border bg-background cursor-pointer transition-opacity hover:opacity-90"
              />
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="ai-platform-selection">AI Platform</Label>
              <Select
                value={platformSelection}
                onValueChange={(value) => { markEdited(); setPlatformSelection(value); }}
                disabled={saveIdeaSubmission.isPending}
              >
                <SelectTrigger id="ai-platform-selection">
                  <SelectValue placeholder="Select a platform…" />
                </SelectTrigger>
                <SelectContent>
                  {AI_PLATFORM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Section B: Agent Credit Costs</CardTitle>
            <p className="text-xs text-muted-foreground">
              Upload the PDF exported from the Copilot Studio Estimator
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
                Upload PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(
                    'https://microsoft.github.io/copilot-studio-estimator/',
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Open Copilot Studio Estimator
              </Button>
              <input
                id="estimated-costs-pdf"
                type="file"
                accept="application/pdf"
                onChange={handleEstimatedCostsPdfUpload}
                disabled={saveIdeaSubmission.isPending}
                ref={estimatedCostsFileInputRef}
                className="hidden"
              />
              {costPdfPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemovePdf}
                  disabled={saveIdeaSubmission.isPending}
                >
                  Remove PDF
                </Button>
              )}
            </div>

            {costPdfPreview ? (
              <div className="flex items-center gap-3 rounded-md border p-3 bg-muted/20">
                <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {costPdfName ?? 'Copilot credit estimate.pdf'}
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenPdf}
                    className="text-xs text-primary underline"
                  >
                    Open PDF
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No estimate PDF uploaded.</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Section C: Overall Costs</CardTitle>
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
      </CollapsibleSection>

      <CollapsibleSection
        id="section-approvals"
        title="Section 3: Approvals"
        subtitle="Current approvals and read-only approval history for this idea."
        open={openSections['section-approvals']}
        onToggle={toggleSection}
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
                {/* Assigned reviewer */}
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm">Assigned reviewer</Label>
                  <Select
                    value={assignedReviewerId || '__none'}
                    onValueChange={(value) => void handleAssignReviewer(value === '__none' ? '' : value)}
                    disabled={saveIdeaSubmission.isPending || members.length === 0}
                  >
                    <SelectTrigger className="w-72">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.memberId}>
                          {m.userName} — {roleMap.get(m.roleId) ?? 'Unknown role'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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

      <CollapsibleSection
        id="section-realization"
        title="Section 4: Realized Outcomes"
        subtitle="Track post-approval delivery outcomes once the idea is in progress or completed."
        open={openSections['section-realization']}
        onToggle={toggleSection}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Realized Outcomes</CardTitle>
            <p className="text-xs text-muted-foreground">
              Capture what actually happened after go-live: real run cost, the realized benefit, the
              go-live date, and an overall outcome rating.
            </p>
          </CardHeader>
          <CardContent>
            {!REALIZATION_BUILD_STAGES.includes(submission.buildStage ?? -1) ? (
              <p className="text-sm text-muted-foreground">
                Realized outcomes become editable once this idea's build phase reaches{' '}
                <strong>In Progress</strong> or <strong>Completed</strong>. Current build phase:{' '}
                {buildStageLabel(submission.buildStage ?? null)}.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="realization-cost">Actual monthly cost</Label>
                    <Input
                      id="realization-cost"
                      type="number"
                      min={0}
                      step="0.01"
                      value={realizationForm.actualMonthlyCost}
                      onChange={(e) =>
                        setRealizationForm((prev) => ({ ...prev, actualMonthlyCost: e.target.value }))
                      }
                      placeholder="e.g. 1850"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="realization-golive">Actual go-live date</Label>
                    <Input
                      id="realization-golive"
                      type="date"
                      value={realizationForm.actualGoLiveDate}
                      onChange={(e) =>
                        setRealizationForm((prev) => ({ ...prev, actualGoLiveDate: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="realization-rating">Outcome rating</Label>
                  <Select
                    value={realizationForm.outcomeRating || '__none'}
                    onValueChange={(value) =>
                      setRealizationForm((prev) => ({
                        ...prev,
                        outcomeRating: value === '__none' ? '' : value,
                      }))
                    }
                  >
                    <SelectTrigger id="realization-rating" className="w-72">
                      <SelectValue placeholder="Not rated" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Not rated</SelectItem>
                      {OUTCOME_RATING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="realization-benefit">Realized benefit</Label>
                  <Textarea
                    id="realization-benefit"
                    rows={4}
                    value={realizationForm.realizedBenefit}
                    onChange={(e) =>
                      setRealizationForm((prev) => ({ ...prev, realizedBenefit: e.target.value }))
                    }
                    placeholder="Describe the measurable business benefit that was actually realized."
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => void handleSaveRealization()}
                    disabled={saveRealization.isPending}
                  >
                    {saveRealization.isPending ? 'Saving…' : 'Save realized outcomes'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleSection>
        </div>
      </div>

      <Sheet open={notesOpen} onOpenChange={setNotesOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>CoE Activity Notes</SheetTitle>
            <SheetDescription>
              Notes are visible to all CoE reviewers and stored as activity records in Dataverse.
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
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
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={platformCarouselOpen} onOpenChange={setPlatformCarouselOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{PLATFORM_SLIDES[platformSlideIndex].label}</DialogTitle>
            <DialogDescription>
              {platformSlideIndex + 1} of {PLATFORM_SLIDES.length} — use the arrows to browse platform options.
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex items-center justify-center">
            <img
              src={PLATFORM_SLIDES[platformSlideIndex].src}
              alt={PLATFORM_SLIDES[platformSlideIndex].label}
              className="max-h-[60vh] w-auto rounded-md border bg-background"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow"
              onClick={() =>
                setPlatformSlideIndex((i) => (i - 1 + PLATFORM_SLIDES.length) % PLATFORM_SLIDES.length)
              }
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow"
              onClick={() => setPlatformSlideIndex((i) => (i + 1) % PLATFORM_SLIDES.length)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2">
            {PLATFORM_SLIDES.map((slide, i) => (
              <button
                key={slide.label}
                type="button"
                aria-label={`Go to ${slide.label}`}
                aria-current={i === platformSlideIndex}
                onClick={() => setPlatformSlideIndex(i)}
                className={
                  i === platformSlideIndex
                    ? 'h-2 w-6 rounded-full bg-primary transition-all'
                    : 'h-2 w-2 rounded-full bg-muted-foreground/40 transition-all hover:bg-muted-foreground/70'
                }
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
