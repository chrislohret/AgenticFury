import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIdeaSubmissions } from '@/hooks/usePrototypeData';
import { IdeaListPanel, StatusCard } from '@/components/IdeaListPanel';
import {
  SUBMISSION_STAGE,
  SUBMISSION_STAGE_DRAFT,
  submissionStageLabel,
  submissionStageBadgeVariant,
} from '@/constants/submissionStage';
import {
  APPROVAL_STATUS,
  approvalStatusLabel,
  approvalStatusBadgeVariant,
} from '@/constants/approvalStatus';
import type { IdeaSubmission } from '@/types/domain-models';

type DashboardFilter =
  | 'all'
  | 'submitted'
  | 'underReview'
  | 'onHold'
  | 'approved'
  | 'denied';

function stageOf(s: IdeaSubmission): number | null {
  return s.submissionStage ?? SUBMISSION_STAGE_DRAFT;
}

export default function DashboardPage() {
  const { data: submissions, isLoading } = useIdeaSubmissions();
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>('all');

  const counts = {
    total: submissions?.length ?? 0,
    submitted: submissions?.filter((s) => stageOf(s) === SUBMISSION_STAGE.SUBMITTED).length ?? 0,
    underReview: submissions?.filter((s) => stageOf(s) === SUBMISSION_STAGE.IN_REVIEW).length ?? 0,
    onHold: submissions?.filter((s) => stageOf(s) === SUBMISSION_STAGE.ON_HOLD).length ?? 0,
    approved: submissions?.filter((s) => s.approvalStatus === APPROVAL_STATUS.APPROVED).length ?? 0,
    denied: submissions?.filter((s) => s.approvalStatus === APPROVAL_STATUS.DENIED).length ?? 0,
  };

  const filteredSubmissions = useMemo(() => {
    const source = submissions ?? [];
    switch (activeFilter) {
      case 'submitted':
        return source.filter((s) => stageOf(s) === SUBMISSION_STAGE.SUBMITTED);
      case 'underReview':
        return source.filter((s) => stageOf(s) === SUBMISSION_STAGE.IN_REVIEW);
      case 'onHold':
        return source.filter((s) => stageOf(s) === SUBMISSION_STAGE.ON_HOLD);
      case 'approved':
        return source.filter((s) => s.approvalStatus === APPROVAL_STATUS.APPROVED);
      case 'denied':
        return source.filter((s) => s.approvalStatus === APPROVAL_STATUS.DENIED);
      case 'all':
      default:
        return source;
    }
  }, [submissions, activeFilter]);

  function handleFilterClick(nextFilter: DashboardFilter) {
    setActiveFilter((current) => (current === nextFilter ? 'all' : nextFilter));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Submission Status</h1>
          <p className="text-sm text-muted-foreground mt-1">Agentic AI use case submission pipeline overview</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/my-ideas">My Ideas</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-10 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatusCard
            label="Total Ideas"
            count={counts.total}
            color="text-foreground"
            isActive={activeFilter === 'all'}
            onClick={() => handleFilterClick('all')}
          />
          <StatusCard
            label="Submitted"
            count={counts.submitted}
            color="text-blue-600"
            isActive={activeFilter === 'submitted'}
            onClick={() => handleFilterClick('submitted')}
          />
          <StatusCard
            label="In Review"
            count={counts.underReview}
            color="text-yellow-600"
            isActive={activeFilter === 'underReview'}
            onClick={() => handleFilterClick('underReview')}
          />
          <StatusCard
            label="On Hold"
            count={counts.onHold}
            color="text-orange-600"
            isActive={activeFilter === 'onHold'}
            onClick={() => handleFilterClick('onHold')}
          />
          <StatusCard
            label="Approved"
            count={counts.approved}
            color="text-green-600"
            isActive={activeFilter === 'approved'}
            onClick={() => handleFilterClick('approved')}
          />
          <StatusCard
            label="Denied"
            count={counts.denied}
            color="text-red-600"
            isActive={activeFilter === 'denied'}
            onClick={() => handleFilterClick('denied')}
          />
        </div>
      )}

      <IdeaListPanel
        submissions={filteredSubmissions}
        isLoading={isLoading}
        isNarrowed={activeFilter !== 'all'}
        statusSortLabel="Stage"
        sortValue={(s) => stageOf(s) ?? -1}
        renderBadge={(submission) => {
          const stage = stageOf(submission);
          return (
            <>
              <Badge variant={submissionStageBadgeVariant(stage)}>
                {submissionStageLabel(stage)}
              </Badge>
              {submission.approvalStatus != null && (
                <Badge variant={approvalStatusBadgeVariant(submission.approvalStatus)}>
                  {approvalStatusLabel(submission.approvalStatus)}
                </Badge>
              )}
            </>
          );
        }}
      />
    </div>
  );
}

