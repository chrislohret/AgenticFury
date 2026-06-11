import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useIdeaSubmission,
  useIdeaScorecard,
  useSaveIdeaScorecard,
  useAiCoeTeam,
} from '@/hooks/usePrototypeData';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  SCORECARD_DIMENSIONS,
  SCORECARD_MAX_SCORE,
  SCORECARD_MAX_TOTAL,
  SCORECARD_MIN_SCORE,
  type ScorecardDimensionKey,
} from '@/constants/scorecard';
import { computeWeightedTotal, isScorecardComplete } from '@/lib/scorecard';
import { cn } from '@/lib/utils';

type ScoreState = Partial<Record<ScorecardDimensionKey, number>>;
type NotesState = Record<ScorecardDimensionKey, string>;

const emptyNotes: NotesState = {
  businessValue: '',
  efficiency: '',
  adoption: '',
  trustGovernance: '',
  technicalPerformance: '',
};

function scoreValueToState(score: number | undefined): number | undefined {
  return typeof score === 'number' && Number.isFinite(score) ? score : undefined;
}

function formatScoredOn(value: string): string {
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight by Date(), which
  // shifts to the previous day in negative-offset timezones. Parse them as a
  // local date instead; full ISO timestamps are left untouched.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  const date = dateOnly
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ScorecardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: submission, isLoading: submissionLoading } = useIdeaSubmission(id);
  const { data: scorecard, isLoading: scorecardLoading } = useIdeaScorecard(id);
  const { data: currentUser } = useCurrentUser();
  const { data: team } = useAiCoeTeam();
  const save = useSaveIdeaScorecard();

  const [scores, setScores] = useState<ScoreState>({});
  const [notes, setNotes] = useState<NotesState>(emptyNotes);

  useEffect(() => {
    if (scorecard) {
      setScores({
        businessValue: scoreValueToState(scorecard.businessValueScore),
        efficiency: scoreValueToState(scorecard.efficiencyScore),
        adoption: scoreValueToState(scorecard.adoptionScore),
        trustGovernance: scoreValueToState(scorecard.trustGovernanceScore),
        technicalPerformance: scoreValueToState(scorecard.technicalPerformanceScore),
      });
      setNotes({
        businessValue: scorecard.businessValueNotes ?? '',
        efficiency: scorecard.efficiencyNotes ?? '',
        adoption: scorecard.adoptionNotes ?? '',
        trustGovernance: scorecard.trustGovernanceNotes ?? '',
        technicalPerformance: scorecard.technicalPerformanceNotes ?? '',
      });
    }
  }, [scorecard]);

  const isReviewer = useMemo(() => {
    if (!currentUser || !team) return false;
    const email = currentUser.email?.toLowerCase();
    const name = currentUser.fullName?.toLowerCase();
    return team.some(
      (member) =>
        (email && member.userEmail?.toLowerCase() === email) ||
        (name && member.userName?.toLowerCase() === name),
    );
  }, [currentUser, team]);

  const liveTotal = useMemo(() => computeWeightedTotal(scores), [scores]);
  const complete = isScorecardComplete(scores);

  function setScore(key: ScorecardDimensionKey, value: number) {
    setScores((prev) => ({ ...prev, [key]: value }));
  }

  function setNote(key: ScorecardDimensionKey, value: string) {
    setNotes((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!id) return;
    if (!isReviewer) {
      toast.error('Only AI CoE reviewers can score an idea.');
      return;
    }
    if (!complete) {
      toast.error('Score every dimension before saving the scorecard.');
      return;
    }

    try {
      await save.mutateAsync({
        submissionId: id,
        businessValueScore: scores.businessValue,
        efficiencyScore: scores.efficiency,
        adoptionScore: scores.adoption,
        trustGovernanceScore: scores.trustGovernance,
        technicalPerformanceScore: scores.technicalPerformance,
        businessValueNotes: notes.businessValue.trim() || undefined,
        efficiencyNotes: notes.efficiency.trim() || undefined,
        adoptionNotes: notes.adoption.trim() || undefined,
        trustGovernanceNotes: notes.trustGovernance.trim() || undefined,
        technicalPerformanceNotes: notes.technicalPerformance.trim() || undefined,
        scoredByName: currentUser?.fullName,
      });
      toast.success('Scorecard saved.');
      navigate(`/submissions/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save the scorecard.');
    }
  }

  if (submissionLoading || scorecardLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-muted-foreground">This idea could not be found.</p>
        <Button asChild variant="outline">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/submissions/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to idea
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Idea Scorecard</h1>
          <p className="text-sm text-muted-foreground">{submission.title}</p>
        </div>
        <Card className="min-w-[220px]">
          <CardContent className="flex flex-col items-center justify-center py-4">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Weighted Total
            </span>
            <span className="text-4xl font-bold tabular-nums">
              {liveTotal}
              <span className="text-base font-normal text-muted-foreground">
                {' '}/ {SCORECARD_MAX_TOTAL}
              </span>
            </span>
          </CardContent>
        </Card>
      </div>

      {!isReviewer && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You are viewing this scorecard in read-only mode. Only AI CoE team members can score ideas.
        </div>
      )}

      <div className="space-y-4">
        {SCORECARD_DIMENSIONS.map((dimension) => {
          const selected = scores[dimension.key];
          const selectedRubric = dimension.rubric.find((level) => level.score === selected);
          return (
            <Card key={dimension.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{dimension.label}</CardTitle>
                  <Badge variant="secondary">Weight {dimension.weight}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{dimension.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2" role="group" aria-label={`${dimension.label} score`}>
                  {Array.from(
                    { length: SCORECARD_MAX_SCORE - SCORECARD_MIN_SCORE + 1 },
                    (_, i) => SCORECARD_MIN_SCORE + i,
                  ).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={selected === value ? 'default' : 'outline'}
                      disabled={!isReviewer}
                      aria-pressed={selected === value}
                      onClick={() => setScore(dimension.key, value)}
                      className="w-10"
                    >
                      {value}
                    </Button>
                  ))}
                </div>
                <p
                  className={cn(
                    'min-h-[1.25rem] text-sm',
                    selectedRubric ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {selectedRubric
                    ? `${selected} — ${selectedRubric.meaning}`
                    : 'Select a score from 0 to 5.'}
                </p>
                <Textarea
                  placeholder="Optional justification or notes"
                  value={notes[dimension.key]}
                  onChange={(event) => setNote(dimension.key, event.target.value)}
                  disabled={!isReviewer}
                  rows={2}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {scorecard?.scoredByName && (
        <p className="text-sm text-muted-foreground">
          Last scored by {scorecard.scoredByName}
          {scorecard.scoredOn ? ` on ${formatScoredOn(scorecard.scoredOn)}` : ''}.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link to={`/submissions/${id}`}>Cancel</Link>
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isReviewer || !complete || save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save scorecard'}
        </Button>
      </div>
    </div>
  );
}
