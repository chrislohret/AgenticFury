import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useIdeaSubmissions, useAllSubmissionPlatforms } from '@/hooks/usePrototypeData';
import {
  IDEA_STATUS,
  IDEA_STATUS_LABELS,
  IDEA_STATUS_BADGE_VARIANT,
} from '@/constants/ideaStatus';
import type { IdeaSubmission } from '@/types/domain-models';

const APPROVED_STATUSES = new Set<number>([
  IDEA_STATUS.APPROVED,
  IDEA_STATUS.IN_PROGRESS,
  IDEA_STATUS.COMPLETED,
]);

const PIPELINE_STATUSES = new Set<number>([
  IDEA_STATUS.SUBMITTED,
  IDEA_STATUS.UNDER_REVIEW,
  IDEA_STATUS.ON_HOLD,
]);

function ideaMonthlyCost(idea: IdeaSubmission): number {
  return (
    (idea.monthlyCopilotCreditsCost ?? 0) +
    (idea.userBasedLicensingCost ?? 0) +
    (idea.dataSourceCost ?? 0)
  );
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function monthKey(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function BarRow({
  label,
  count,
  max,
  trailing,
}: {
  label: string;
  count: number;
  max: number;
  trailing?: string;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {trailing ?? count}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: submissions = [], isLoading } = useIdeaSubmissions();
  const { data: allSubmissionPlatforms = [] } = useAllSubmissionPlatforms();

  const stats = useMemo(() => {
    const total = submissions.length;
    const totalMonthlyCost = submissions.reduce((sum, s) => sum + ideaMonthlyCost(s), 0);

    const approved = submissions.filter((s) => APPROVED_STATUSES.has(s.status));
    const pipeline = submissions.filter((s) => PIPELINE_STATUSES.has(s.status));

    const approvedMonthlyCost = approved.reduce((sum, s) => sum + ideaMonthlyCost(s), 0);
    const pipelineMonthlyCost = pipeline.reduce((sum, s) => sum + ideaMonthlyCost(s), 0);
    const avgCost = total > 0 ? totalMonthlyCost / total : 0;

    const decided = submissions.filter(
      (s) => s.status === IDEA_STATUS.REJECTED || APPROVED_STATUSES.has(s.status),
    );
    const approvalRate = decided.length > 0 ? (approved.length / decided.length) * 100 : 0;

    const phiCount = submissions.filter((s) => s.phiRequired).length;

    const byDepartment = new Map<string, { count: number; cost: number }>();
    const byPlatform = new Map<string, number>();
    const byStatus = new Map<number, number>();
    const byMonth = new Map<string, number>();

    // Group each submission's selected platforms (afp_ideaplatform join). A
    // submission can select multiple platforms, so it contributes to each
    // platform's count (platform counts may therefore exceed the total).
    const platformNamesBySubmission = new Map<string, string[]>();
    for (const row of allSubmissionPlatforms) {
      const name = row.platformName || 'Unspecified';
      const list = platformNamesBySubmission.get(row.submissionId) ?? [];
      list.push(name);
      platformNamesBySubmission.set(row.submissionId, list);
    }

    for (const s of submissions) {
      // Prefer the CoE-normalized departments; fall back to the raw intake
      // department, then to 'Unspecified'. An idea spanning multiple
      // departments contributes its full monthly cost to each of them, so the
      // bars reflect total spend touching a department rather than a split.
      const depts =
        s.normalizedDepartments && s.normalizedDepartments.length > 0
          ? s.normalizedDepartments
          : [s.department?.trim() || 'Unspecified'];
      const cost = ideaMonthlyCost(s);
      for (const dept of depts) {
        const deptEntry = byDepartment.get(dept) ?? { count: 0, cost: 0 };
        deptEntry.count += 1;
        deptEntry.cost += cost;
        byDepartment.set(dept, deptEntry);
      }

      const platformNames = platformNamesBySubmission.get(s.id);
      const platforms = platformNames && platformNames.length > 0 ? platformNames : ['Unspecified'];
      for (const platform of platforms) {
        byPlatform.set(platform, (byPlatform.get(platform) ?? 0) + 1);
      }

      byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);

      const mk = monthKey(s.createdOn);
      if (mk) byMonth.set(mk, (byMonth.get(mk) ?? 0) + 1);
    }

    const departments = [...byDepartment.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.cost - a.cost || b.count - a.count);

    const platforms = [...byPlatform.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const statuses = [...byStatus.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const months = [...byMonth.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => a.key.localeCompare(b.key));

    return {
      total,
      totalMonthlyCost,
      approvedMonthlyCost,
      pipelineMonthlyCost,
      avgCost,
      approvalRate,
      decidedCount: decided.length,
      approvedCount: approved.length,
      pipelineCount: pipeline.length,
      phiCount,
      departments,
      platforms,
      statuses,
      months,
    };
  }, [submissions, allSubmissionPlatforms]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const maxDeptCost = Math.max(1, ...stats.departments.map((d) => d.cost));
  const maxPlatform = Math.max(1, ...stats.platforms.map((p) => p.count));
  const maxStatus = Math.max(1, ...stats.statuses.map((s) => s.count));
  const maxMonth = Math.max(1, ...stats.months.map((m) => m.count));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cost roll-up and portfolio insights across all submitted ideas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Est. Monthly Cost (All)"
          value={currency.format(stats.totalMonthlyCost)}
          sub={`${stats.total} idea${stats.total === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Approved / Active"
          value={currency.format(stats.approvedMonthlyCost)}
          sub={`${stats.approvedCount} idea${stats.approvedCount === 1 ? '' : 's'} /mo`}
        />
        <StatCard
          label="Pipeline"
          value={currency.format(stats.pipelineMonthlyCost)}
          sub={`${stats.pipelineCount} under consideration`}
        />
        <StatCard
          label="Avg Cost / Idea"
          value={currency.format(stats.avgCost)}
          sub="per month"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Approval Rate"
          value={`${Math.round(stats.approvalRate)}%`}
          sub={`${stats.approvedCount} of ${stats.decidedCount} decided`}
        />
        <StatCard
          label="PHI / Sensitive"
          value={String(stats.phiCount)}
          sub="ideas flagged PHI required"
        />
        <StatCard
          label="In Pipeline"
          value={String(stats.pipelineCount)}
          sub="submitted, in review, or on hold"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Cost by Department</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              stats.departments.map((d) => (
                <BarRow
                  key={d.label}
                  label={`${d.label} (${d.count})`}
                  count={d.cost}
                  max={maxDeptCost}
                  trailing={currency.format(d.cost)}
                />
              ))
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              Based on CoE-normalized departments (falls back to the submitted department
              when an idea has not been normalized). Ideas spanning multiple departments
              contribute their full monthly cost to each.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ideas by Platform</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.platforms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              stats.platforms.map((p) => (
                <BarRow key={p.label} label={p.label} count={p.count} max={maxPlatform} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ideas by Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.statuses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              stats.statuses.map((s) => {
                const pct = maxStatus > 0 ? Math.round((s.count / maxStatus) * 100) : 0;
                return (
                  <div key={s.status} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={IDEA_STATUS_BADGE_VARIANT[s.status] ?? 'secondary'}>
                        {IDEA_STATUS_LABELS[s.status] ?? `Status ${s.status}`}
                      </Badge>
                      <span className="tabular-nums text-sm text-muted-foreground">{s.count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submissions Over Time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.months.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              stats.months.map((m) => (
                <BarRow key={m.key} label={monthLabel(m.key)} count={m.count} max={maxMonth} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
