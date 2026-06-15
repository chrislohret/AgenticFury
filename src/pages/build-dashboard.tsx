import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useIdeaSubmissions } from '@/hooks/usePrototypeData';
import { IdeaListPanel, StatusCard } from '@/components/IdeaListPanel';
import { APPROVAL_STATUS } from '@/constants/approvalStatus';
import { BUILD_STAGE, buildStageLabel, buildStageBadgeVariant } from '@/constants/buildStage';
import type { IdeaSubmission } from '@/types/domain-models';

type BuildFilter = 'all' | 'notStarted' | 'inProgress' | 'completed' | 'cancelled';

/** An idea enters the build pipeline once it has been formally approved. */
function isInBuildPipeline(s: IdeaSubmission): boolean {
  return s.approvalStatus === APPROVAL_STATUS.APPROVED;
}

function buildStageOf(s: IdeaSubmission): number | null {
  return s.buildStage ?? null;
}

export default function BuildDashboardPage() {
  const { data: submissions, isLoading } = useIdeaSubmissions();
  const [activeFilter, setActiveFilter] = useState<BuildFilter>('all');

  const buildIdeas = useMemo(
    () => (submissions ?? []).filter(isInBuildPipeline),
    [submissions],
  );

  const counts = {
    total: buildIdeas.length,
    notStarted: buildIdeas.filter((s) => buildStageOf(s) === null).length,
    inProgress: buildIdeas.filter((s) => buildStageOf(s) === BUILD_STAGE.IN_PROGRESS).length,
    completed: buildIdeas.filter((s) => buildStageOf(s) === BUILD_STAGE.COMPLETED).length,
    cancelled: buildIdeas.filter((s) => buildStageOf(s) === BUILD_STAGE.CANCELLED).length,
  };

  const filteredSubmissions = useMemo(() => {
    switch (activeFilter) {
      case 'notStarted':
        return buildIdeas.filter((s) => buildStageOf(s) === null);
      case 'inProgress':
        return buildIdeas.filter((s) => buildStageOf(s) === BUILD_STAGE.IN_PROGRESS);
      case 'completed':
        return buildIdeas.filter((s) => buildStageOf(s) === BUILD_STAGE.COMPLETED);
      case 'cancelled':
        return buildIdeas.filter((s) => buildStageOf(s) === BUILD_STAGE.CANCELLED);
      case 'all':
      default:
        return buildIdeas;
    }
  }, [buildIdeas, activeFilter]);

  function handleFilterClick(nextFilter: BuildFilter) {
    setActiveFilter((current) => (current === nextFilter ? 'all' : nextFilter));
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Build Phases</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Delivery status of approved Agentic AI use cases
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-10 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatusCard
            label="In Build"
            count={counts.total}
            color="text-foreground"
            isActive={activeFilter === 'all'}
            onClick={() => handleFilterClick('all')}
          />
          <StatusCard
            label="Not Started"
            count={counts.notStarted}
            color="text-slate-600"
            isActive={activeFilter === 'notStarted'}
            onClick={() => handleFilterClick('notStarted')}
          />
          <StatusCard
            label="In Progress"
            count={counts.inProgress}
            color="text-blue-600"
            isActive={activeFilter === 'inProgress'}
            onClick={() => handleFilterClick('inProgress')}
          />
          <StatusCard
            label="Completed"
            count={counts.completed}
            color="text-green-600"
            isActive={activeFilter === 'completed'}
            onClick={() => handleFilterClick('completed')}
          />
          <StatusCard
            label="Cancelled"
            count={counts.cancelled}
            color="text-red-600"
            isActive={activeFilter === 'cancelled'}
            onClick={() => handleFilterClick('cancelled')}
          />
        </div>
      )}

      <IdeaListPanel
        submissions={filteredSubmissions}
        isLoading={isLoading}
        isNarrowed={activeFilter !== 'all'}
        statusSortLabel="Build phase"
        sortValue={(s) => buildStageOf(s) ?? -1}
        renderBadge={(submission) => {
          const stage = buildStageOf(submission);
          return (
            <Badge variant={buildStageBadgeVariant(stage)}>
              {buildStageLabel(stage)}
            </Badge>
          );
        }}
      />
    </div>
  );
}
