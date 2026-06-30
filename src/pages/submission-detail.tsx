import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useBlocker } from 'react-router-dom';
import { ChevronDown, ChevronUp, Trash2, ExternalLink, FileText, MessageSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
import { useCurrentUser } from '@/hooks/useCurrentUser';
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
  useAiCoeTeam,
  useAiCoeRoles,
  useAiCoeTeamApprovals,
  useSaveAiCoeTeamApproval,
  useDeleteAiCoeTeamApproval,
  useIdeaRealization,
  useSaveIdeaRealization,
  usePlatformsWithAttributes,
} from '@/hooks/usePrototypeData';
import {
  submissionStageLabel,
  type SubmissionStageValue,
} from '@/constants/submissionStage';
import {
  BUILD_STAGE,
  buildStageLabel,
} from '@/constants/buildStage';
import { approvalStatusLabel, APPROVAL_STATUS } from '@/constants/approvalStatus';
import {
  getScoreBand,
  SCORECARD_DIMENSIONS,
  SCORECARD_MAX_SCORE,
  type ScorecardDimensionKey,
} from '@/constants/scorecard';
import { isScorecardComplete } from '@/lib/scorecard';
import type {
  CoeStructuredReview,
  CoeNote,
  AiCoeTeamApproval,
  AiCoeTeamMember,
  LookupOption,
  IdeaOutcomeRating,
  PlatformAttribute,
  IdeaScorecard,
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

type ScorecardScoresMap = Partial<Record<ScorecardDimensionKey, number>>;

function ScorecardDimensionBars({ scores }: { scores: ScorecardScoresMap }) {
  return (
    <div className="space-y-2">
      {SCORECARD_DIMENSIONS.map((dim) => {
        const raw = scores[dim.key];
        const has = typeof raw === 'number';
        const pct = has ? (raw / SCORECARD_MAX_SCORE) * 100 : 0;
        return (
          <div key={dim.key} className="flex items-center gap-3">
            <span className="w-44 shrink-0 truncate text-xs text-muted-foreground" title={dim.label}>
              {dim.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', has ? 'bg-primary' : 'bg-transparent')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums">
              {has ? `${raw}/5` : '\u2014'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScorecardBanner({
  submissionId,
  scorecard,
  complete,
  scoredCount,
}: {
  submissionId: string;
  scorecard: IdeaScorecard | null | undefined;
  complete: boolean;
  scoredCount: number;
}) {
  const band = getScoreBand(scorecard?.weightedTotal);
  return (
    <div
      className={cn(
        'mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border p-4',
        complete ? 'bg-card' : 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/20',
      )}
    >
      <div className="flex flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Evaluation Scorecard
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">
            {typeof scorecard?.weightedTotal === 'number' ? scorecard.weightedTotal : '\u2014'}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
          {band && (
            <Badge variant={band.badgeVariant} title={band.description}>
              {band.label}
            </Badge>
          )}
        </div>
      </div>
      {complete ? (
        <Badge variant="outline" className="gap-1 border-green-600/40 text-green-700">
          <CheckCircle2 className="h-3 w-3" />
          Complete
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 border-amber-600/40 text-amber-700">
          <AlertTriangle className="h-3 w-3" />
          {scoredCount} / 5 scored
        </Badge>
      )}
      <Button variant={complete ? 'outline' : 'default'} size="sm" asChild className="ml-auto">
        <Link to={`/submissions/${submissionId}/scorecard`}>
          {complete ? 'Open scorecard' : 'Complete scorecard'}
        </Link>
      </Button>
    </div>
  );
}

function PlatformAttributeList({ title, items }: { title: string; items: PlatformAttribute[] }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">&mdash;</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id} className="text-sm leading-snug">
              {item.name}
            </li>
          ))}
        </ul>
      )}
    </div>
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


function ApprovalActionRow({
  member,
  roleName,
  comment,
  onCommentChange,
  onCommentBlur,
  onDelete,
  isSaving,
}: {
  member: AiCoeTeamMember;
  roleName: string;
  comment: string;
  onCommentChange: (value: string) => void;
  onCommentBlur: () => void;
  onDelete: () => void;
  isSaving: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="align-top">
        <p className="font-medium">{member.userName}</p>
      </TableCell>
      <TableCell className="align-top">{roleName}</TableCell>
      <TableCell className="align-top w-[60%] min-w-80">
        <Textarea
          rows={2}
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          onBlur={onCommentBlur}
          placeholder="Add notes for this contributor."
        />
      </TableCell>
      <TableCell className="align-top w-12">
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={isSaving}
          aria-label={`Remove ${member.userName} as contributor`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
  { id: 'section-platform', label: 'Platform Selection' },
  { id: 'section-scorecard', label: 'Scorecard' },
  { id: 'section-approvals', label: 'Contributors' },
  { id: 'section-costs', label: 'Estimated Costs' },
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
  const scorecardScores = useMemo(
    () => ({
      businessValue: scorecard?.businessValueScore,
      efficiency: scorecard?.efficiencyScore,
      adoption: scorecard?.adoptionScore,
      trustGovernance: scorecard?.trustGovernanceScore,
      technicalPerformance: scorecard?.technicalPerformanceScore,
    }),
    [scorecard],
  );
  const scorecardComplete = useMemo(() => isScorecardComplete(scorecardScores), [scorecardScores]);
  const scorecardScoredCount = useMemo(
    () => Object.values(scorecardScores).filter((value) => typeof value === 'number').length,
    [scorecardScores],
  );
  const { data: notes = [] } = useCoeNotes(relatedSubmissionId);
  const { data: members = [], isLoading: membersLoading } = useAiCoeTeam(canLoadRelatedData);
  const { data: currentUser } = useCurrentUser();
  const { data: approvals = [], isLoading: approvalsLoading } = useAiCoeTeamApprovals(relatedSubmissionId);
  const { data: approvalHistory = [] } = useCoeApprovalHistory(relatedSubmissionId);
  const { data: realization } = useIdeaRealization(relatedSubmissionId);
  const saveStructuredReview = useSaveCoeStructuredReview();
  const createNote = useCreateCoeNote();
  const saveApproval = useSaveAiCoeTeamApproval();
  const deleteApproval = useDeleteAiCoeTeamApproval(relatedSubmissionId);
  const saveRealization = useSaveIdeaRealization();

  const [addApproverMemberId, setAddApproverMemberId] = useState<string>('');

  const businessObjectiveOptions = useLookupOptions('business-objectives', canLoadRelatedData);
  const intendedUserRoleOptions = useLookupOptions('intended-user-roles', canLoadRelatedData);
  const dataSourceOptions = useLookupOptions('data-sources', canLoadRelatedData);
  const expectedOutcomeOptions = useLookupOptions('expected-outcomes', canLoadRelatedData);
  const riskFactorOptions = useLookupOptions('risk-factors', canLoadRelatedData);
  const departmentOptions = useLookupOptions('departments', canLoadRelatedData);
  const aiCoeRoleOptions = useAiCoeRoles(canLoadRelatedData);
  const platforms = usePlatformsWithAttributes(canLoadRelatedData);

  const [form, setForm] = useState<StructuredFormState>(EMPTY_STRUCTURED_FORM);
  const [newNoteText, setNewNoteText] = useState('');
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null);
  const [selectedBuildStage, setSelectedBuildStage] = useState<number | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<number | null>(null);
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [costPdfPreview, setCostPdfPreview] = useState<string | null>(null);
  const [costPdfName, setCostPdfName] = useState<string | null>(null);
  const [pdfEdited, setPdfEdited] = useState(false);
  const estimatedCostsFileInputRef = useRef<HTMLInputElement | null>(null);
  const [overallCostsForm, setOverallCostsForm] = useState<OverallCostsFormState>(EMPTY_OVERALL_COSTS_FORM);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
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
    'section-scorecard': true,
    'section-approvals': false,
    'section-costs': false,
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
    setSelectedPlatformId(submission?.platformId ?? '');
  }, [
    submission?.monthlyCopilotCreditsCost,
    submission?.monthlyCopilotCreditsNotes,
    submission?.userBasedLicensingCost,
    submission?.userBasedLicensingNotes,
    submission?.dataSourceCost,
    submission?.dataSourceNotes,
    submission?.platformId,
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

  // Only the user selected as the approver may change the submission/approval
  // statuses. The runtime user context exposes an email (UPN) but not the
  // systemuser GUID, so we bridge to the assigned reviewer's GUID via the CoE
  // team roster: find the member whose `memberId` is the assigned reviewer and
  // compare its email to the signed-in user's email (case-insensitive).
  const isAssignedApprover = useMemo(() => {
    if (!assignedReviewerId) return false;
    const myEmail = currentUser?.email?.trim().toLowerCase();
    if (!myEmail) return false;
    const approverMember = members.find((m) => m.memberId === assignedReviewerId);
    return approverMember?.userEmail?.trim().toLowerCase() === myEmail;
  }, [assignedReviewerId, currentUser?.email, members]);

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

    // Gate: an idea cannot be marked Approved until the scorecard is complete
    // (all five dimensions scored). This protects the approval decision from
    // being recorded without a finished evaluation.
    if (nextApproval === APPROVAL_STATUS.APPROVED && !scorecardComplete) {
      toast.error('Complete the scorecard (all five dimensions) before approving this idea.');
      return false;
    }

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
        platformId: selectedPlatformId || null,
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
        // Neutral placeholder — contributors carry no approval decision.
        approvalStatus: 'pending',
      });
      setAddApproverMemberId('');
      toast.success('Contributor added.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast.error(`Failed to add contributor: ${message}`);
    }
  }

  // Designate one contributor as the approver responsible for changing the
  // submission status and approval decision. The selection is persisted to the
  // submission's assignedReviewer lookup (systemuser GUID). Until an approver is
  // set, the status/approval controls in the header stay disabled.
  async function handleSelectApprover(memberId: string) {
    if (!submission || !memberId) return;
    const previous = assignedReviewerId;
    setAssignedReviewerId(memberId);
    try {
      await saveIdeaSubmission.mutateAsync({
        id: submission.id,
        assignedReviewer: memberId,
      });
      toast.success('Approver updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      setAssignedReviewerId(previous);
      toast.error(`Failed to update approver: ${message}`);
    }
  }

  async function handleDeleteApprover(approval: AiCoeTeamApproval, memberName: string) {
    try {
      await deleteApproval.mutateAsync(approval.id);
      toast.success(`${memberName} removed as contributor.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast.error(`Failed to remove contributor: ${message}`);
    }
  }

  async function handleSaveComment(member: AiCoeTeamMember) {
    if (!relatedSubmissionId) return;

    const comment = approvalComments[member.id]?.trim() ?? '';
    const existing = approvalMap.get(member.id);

    // Skip redundant saves when the comment hasn't changed.
    if ((existing?.comment ?? '') === comment) return;

    try {
      await saveApproval.mutateAsync({
        submissionId: relatedSubmissionId,
        teamMemberId: member.id,
        // Contributors carry no approval decision. 'pending' is a neutral
        // placeholder until approvals are reworked solution-wide.
        approvalStatus: 'pending',
        comment: comment || undefined,
      });
      toast.success(`Comment saved for ${member.userName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast.error(`Failed to save comment: ${message}`);
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
              {submission.submissionRef && (
                <Badge variant="secondary" className="font-mono">{submission.submissionRef}</Badge>
              )}
              {submission.phiRequired && <Badge variant="destructive">PHI</Badge>}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {submission.department && `${submission.department} · `}
          Submitted {submission.createdOn ?? 'unknown'}
          {assignedReviewerLabel && ` · Approver: ${assignedReviewerLabel}`}
        </p>
        <ScorecardBanner
          submissionId={submission.id}
          scorecard={scorecard}
          complete={scorecardComplete}
          scoredCount={scorecardScoredCount}
        />
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
            disabled={saveIdeaSubmission.isPending || !assignedReviewerId || !isAssignedApprover}
            approveDisabled={!scorecardComplete}
          />
          {!assignedReviewerId ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Select an approver in the Contributors section to enable the status and approval controls.
            </p>
          ) : !isAssignedApprover ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Only the assigned approver{assignedReviewerLabel ? ` (${assignedReviewerLabel})` : ''} can
              change the submission and approval statuses.
            </p>
          ) : null}
          {!scorecardComplete && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                The scorecard must be completed (all five dimensions scored) before this idea can be
                approved.
              </span>
              <Button variant="outline" size="sm" asChild className="ml-auto h-7">
                <Link to={`/submissions/${submission.id}/scorecard`}>Complete scorecard</Link>
              </Button>
            </div>
          )}
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
        title="Section 2: Platform Selection"
        subtitle="Choose the target AI platform for this idea."
        open={openSections['section-platform']}
        onToggle={toggleSection}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform Selection</CardTitle>
            <p className="text-xs text-muted-foreground">
              Review each platform&rsquo;s capabilities, decision criteria, and cost mechanisms, then
              select the best fit for this idea.
            </p>
          </CardHeader>
          <CardContent>
            {platforms.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading platforms…</p>
            ) : (platforms.data ?? []).filter((p) => p.isActive).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No platforms are configured yet. A CoE administrator can add them in the Platform
                Catalog.
              </p>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto pr-1 space-y-3">
                {(platforms.data ?? [])
                  .filter((platform) => platform.isActive || platform.id === selectedPlatformId)
                  .map((platform) => {
                    const isSelected = selectedPlatformId === platform.id;
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => {
                          markEdited();
                          setSelectedPlatformId(platform.id);
                        }}
                        disabled={saveIdeaSubmission.isPending}
                        aria-pressed={isSelected}
                        className={cn(
                          'w-full text-left rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected
                            ? 'border-primary ring-1 ring-primary bg-primary/5'
                            : 'hover:bg-muted/50',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2',
                              isSelected ? 'border-primary bg-primary' : 'border-muted-foreground',
                            )}
                            aria-hidden
                          />
                          <div className="flex-1 min-w-0 space-y-3">
                            <div>
                              <div className="font-medium">{platform.name}</div>
                              {platform.description && (
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {platform.description}
                                </p>
                              )}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <PlatformAttributeList title="Capabilities" items={platform.capabilities} />
                              <PlatformAttributeList
                                title="Decision Criteria"
                                items={platform.decisionCriteria}
                              />
                              <PlatformAttributeList
                                title="Cost Mechanisms"
                                items={platform.costMechanisms}
                              />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleSection>

      <CollapsibleSection
        id="section-scorecard"
        title="Scorecard"
        subtitle="Weighted evaluation across the five scoring dimensions."
        open={openSections['section-scorecard']}
        onToggle={toggleSection}
      >
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">Evaluation Scorecard</CardTitle>
              <p className="text-xs text-muted-foreground">
                {scorecardComplete
                  ? 'All five dimensions scored.'
                  : `${scorecardScoredCount} of 5 dimensions scored — complete the scorecard before approval.`}
              </p>
            </div>
            <Button variant={scorecardComplete ? 'outline' : 'default'} size="sm" asChild>
              <Link to={`/submissions/${submission.id}/scorecard`}>
                {scorecardComplete ? 'Open scorecard' : 'Complete scorecard'}
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-semibold tabular-nums">
                {typeof scorecard?.weightedTotal === 'number' ? scorecard.weightedTotal : '\u2014'}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
              {(() => {
                const band = getScoreBand(scorecard?.weightedTotal);
                return band ? (
                  <Badge variant={band.badgeVariant} title={band.description}>
                    {band.label}
                  </Badge>
                ) : null;
              })()}
              {scorecardComplete ? (
                <Badge variant="outline" className="gap-1 border-green-600/40 text-green-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Complete
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-amber-600/40 text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  Incomplete
                </Badge>
              )}
            </div>
            <ScorecardDimensionBars scores={scorecardScores} />
          </CardContent>
        </Card>
      </CollapsibleSection>

      <CollapsibleSection
        id="section-approvals"
        title="Section 3: Contributors"
        subtitle="Contributors and their comments for this idea."
        open={openSections['section-approvals']}
        onToggle={toggleSection}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contributors</CardTitle>
            <p className="text-xs text-muted-foreground">
              Add CoE team members as contributors and capture their comments for this idea.
            </p>
          </CardHeader>
          <CardContent>
            {membersLoading || approvalsLoading ? (
              <p className="text-sm text-muted-foreground">Loading contributors…</p>
            ) : (
              <div className="space-y-4">
                {/* Add Contributor row */}
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
                      Add Contributor
                    </Button>
                  </div>
                )}

                {/* Designated approver */}
                {approverMembers.length > 0 && (
                  <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                    <Label className="text-sm font-medium">Approver</Label>
                    <p className="text-xs text-muted-foreground">
                      Select the contributor responsible for changing the submission status and
                      approval decision. Those controls stay disabled until an approver is selected.
                    </p>
                    <Select
                      value={assignedReviewerId || undefined}
                      onValueChange={(value) => void handleSelectApprover(value)}
                    >
                      <SelectTrigger className="w-72">
                        <SelectValue placeholder="Select an approver…" />
                      </SelectTrigger>
                      <SelectContent>
                        {approverMembers.map((m) => (
                          <SelectItem key={m.id} value={m.memberId}>
                            {m.userName} — {roleMap.get(m.roleId) ?? 'Unknown role'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Contributors table */}
                {approverMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No contributors added yet. Use the picker above to add CoE team members.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Comments</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approverMembers.map((member) => (
                          <ApprovalActionRow
                            key={member.id}
                            member={member}
                            roleName={roleMap.get(member.roleId) ?? 'Unknown role'}
                            comment={approvalComments[member.id] ?? ''}
                            onCommentChange={(value) =>
                              setApprovalComments((current) => ({ ...current, [member.id]: value }))
                            }
                            onCommentBlur={() => void handleSaveComment(member)}
                            onDelete={() => {
                              const approval = approvalMap.get(member.id);
                              if (approval) void handleDeleteApprover(approval, member.userName);
                            }}
                            isSaving={saveApproval.isPending || deleteApproval.isPending}
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
      </CollapsibleSection>

      <CollapsibleSection
        id="section-costs"
        title="Section 4: Estimated Costs"
        subtitle="Capture agent credit costs and overall cost estimates with supporting notes."
        open={openSections['section-costs']}
        onToggle={toggleSection}
      >
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Agent Credit Costs</CardTitle>
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
            <CardTitle className="text-base">Overall Costs</CardTitle>
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
        id="section-realization"
        title="Section 5: Realized Outcomes"
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
