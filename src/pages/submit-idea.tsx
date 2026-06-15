import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useIdeaSubmission, useSaveIdeaSubmission } from '@/hooks/usePrototypeData';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { IDEA_STATUS } from '@/constants/ideaStatus';
import { SUBMISSION_STAGE, SUBMISSION_STAGE_DRAFT, type SubmissionStageValue } from '@/constants/submissionStage';
import type { IdeaSubmission } from '@/types/domain-models';

type FormState = Omit<IdeaSubmission, 'id' | 'submittedBy' | 'createdOn'>;

const emptyForm: FormState = {
  title: '',
  businessObjectives: '',
  intendedUserRoles: '',
  dataSources: '',
  phiRequired: false,
  expectedOutcomes: '',
  riskFactors: '',
  status: IDEA_STATUS.DRAFT,
  department: '',
};

function RequiredMark() {
  return <span className="text-red-500 ml-1" aria-hidden>*</span>;
}

export default function SubmitIdeaPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { data: existing } = useIdeaSubmission(id);
  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser();
  const save = useSaveIdeaSubmission();

  const [form, setForm] = useState<FormState>(emptyForm);

  const isReadOnlyDraftByAnotherUser = Boolean(
    existing
      && (existing.submissionStage ?? SUBMISSION_STAGE_DRAFT) === SUBMISSION_STAGE_DRAFT
      && existing.submittedBy
      && currentUser?.id
      && existing.submittedBy !== currentUser.id,
  );

  useEffect(() => {
    if (existing) {
      const { id: _id, submittedBy: _sub, createdOn: _created, ...rest } = existing;
      setForm(rest);
    }
  }, [existing]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isSubmitDisabled =
    !form.title.trim() ||
    !form.businessObjectives.trim() ||
    !form.intendedUserRoles.trim() ||
    !form.expectedOutcomes.trim() ||
    save.isPending;

  const isDraftDisabled = save.isPending;

  async function handleSave(submissionStage: SubmissionStageValue | null) {
    if (!currentUser?.id) {
      toast.error('Unable to resolve the current user.');
      return;
    }

    if (isReadOnlyDraftByAnotherUser) {
      toast.error('Only the idea creator can edit a draft idea.');
      return;
    }

    try {
      await save.mutateAsync({
        ...form,
        submissionStage,
        submittedBy: currentUser.id,
        ...(id ? { id } : {}),
      });
      toast.success(
        submissionStage === SUBMISSION_STAGE_DRAFT ? 'Saved as draft.' : 'Idea submitted successfully.',
      );
      navigate('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? `Failed to save: ${error.message}` : 'Failed to save. Please try again.');
    }
  }

  const actionDisabled = save.isPending || currentUserLoading;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{id ? 'Edit Idea' : 'Submit New Idea'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Describe your Agentic AI use case so the CoE team can evaluate it.
        </p>
        {isReadOnlyDraftByAnotherUser && (
          <p className="text-sm text-destructive mt-2">
            This idea is in Draft and is read-only. Only the user who created it can edit draft ideas.
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Use Case Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Title <RequiredMark />
            </Label>
            <Input
              id="title"
              placeholder="Short title for your use case idea"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              disabled={isReadOnlyDraftByAnotherUser}
              aria-required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="businessObjectives">
              Business Objectives <RequiredMark />
            </Label>
            <Textarea
              id="businessObjectives"
              placeholder="What business problem does this solve? What outcomes are you targeting?"
              rows={3}
              value={form.businessObjectives}
              onChange={(e) => set('businessObjectives', e.target.value)}
              disabled={isReadOnlyDraftByAnotherUser}
              aria-required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="intendedUserRoles">
              Intended Users / Roles <RequiredMark />
            </Label>
            <Textarea
              id="intendedUserRoles"
              placeholder="Who will use this AI agent? List roles or teams."
              rows={2}
              value={form.intendedUserRoles}
              onChange={(e) => set('intendedUserRoles', e.target.value)}
              disabled={isReadOnlyDraftByAnotherUser}
              aria-required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dataSources">Data Sources</Label>
            <Textarea
              id="dataSources"
              placeholder="What data will the agent need access to? (e.g. CRM, SharePoint, ERP)"
              rows={2}
              value={form.dataSources ?? ''}
              onChange={(e) => set('dataSources', e.target.value)}
              disabled={isReadOnlyDraftByAnotherUser}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expectedOutcomes">
              Expected Outcomes <RequiredMark />
            </Label>
            <Textarea
              id="expectedOutcomes"
              placeholder="What measurable results do you expect? (e.g. reduce processing time by 30%)"
              rows={3}
              value={form.expectedOutcomes}
              onChange={(e) => set('expectedOutcomes', e.target.value)}
              disabled={isReadOnlyDraftByAnotherUser}
              aria-required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="riskFactors">Risk Factors / Regulatory Impact</Label>
            <Textarea
              id="riskFactors"
              placeholder="Any known risks, compliance concerns, or regulatory considerations?"
              rows={2}
              value={form.riskFactors ?? ''}
              onChange={(e) => set('riskFactors', e.target.value)}
              disabled={isReadOnlyDraftByAnotherUser}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              placeholder="Your department or business unit"
              value={form.department ?? ''}
              onChange={(e) => set('department', e.target.value)}
              disabled={isReadOnlyDraftByAnotherUser}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="phiRequired"
              checked={form.phiRequired}
              onCheckedChange={(checked) => set('phiRequired', checked === true)}
              disabled={isReadOnlyDraftByAnotherUser}
            />
            <Label htmlFor="phiRequired" className="cursor-pointer">
              This use case requires access to Protected Health Information (PHI)
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 mt-6">
        <Button
          variant="outline"
          onClick={() => handleSave(SUBMISSION_STAGE_DRAFT)}
          disabled={isDraftDisabled || isReadOnlyDraftByAnotherUser || actionDisabled}
        >
          Save as Draft
        </Button>
        <Button
          onClick={() => handleSave(SUBMISSION_STAGE.SUBMITTED)}
          disabled={isSubmitDisabled || isReadOnlyDraftByAnotherUser || actionDisabled}
        >
          Submit Idea
        </Button>
        <Button variant="ghost" onClick={() => navigate(-1)} disabled={actionDisabled}>
          Cancel
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Fields marked <span className="text-red-500">*</span> are required to submit.
      </p>
    </div>
  );
}
