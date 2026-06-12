import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIdeaSubmissions } from '@/hooks/usePrototypeData';
import { IDEA_STATUS, IDEA_STATUS_LABELS, IDEA_STATUS_BADGE_VARIANT } from '@/constants/ideaStatus';

type DashboardFilter =
  | 'all'
  | 'submitted'
  | 'underReview'
  | 'approved'
  | 'rejected'
  | 'phiFlagged';

type SortKey = 'newest' | 'oldest' | 'title' | 'status';

function StatusCard({
  label,
  count,
  color,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-pressed={isActive}
      aria-label={`Filter recent submissions by ${label}`}
    >
      <Card className={isActive ? 'ring-2 ring-ring border-ring' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${color}`}>{count}</p>
        </CardContent>
      </Card>
    </button>
  );
}

export default function DashboardPage() {
  const { data: submissions, isLoading } = useIdeaSubmissions();
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  const counts = {
    total: submissions?.length ?? 0,
    draft: submissions?.filter((s) => s.status === IDEA_STATUS.DRAFT).length ?? 0,
    submitted: submissions?.filter((s) => s.status === IDEA_STATUS.SUBMITTED).length ?? 0,
    underReview: submissions?.filter((s) => s.status === IDEA_STATUS.UNDER_REVIEW).length ?? 0,
    approved: submissions?.filter((s) => s.status === IDEA_STATUS.APPROVED).length ?? 0,
    rejected: submissions?.filter((s) => s.status === IDEA_STATUS.REJECTED).length ?? 0,
    phiFlagged: submissions?.filter((s) => s.phiRequired).length ?? 0,
  };

  const filteredSubmissions = useMemo(() => {
    const source = submissions ?? [];
    switch (activeFilter) {
      case 'submitted':
        return source.filter((s) => s.status === IDEA_STATUS.SUBMITTED);
      case 'underReview':
        return source.filter((s) => s.status === IDEA_STATUS.UNDER_REVIEW);
      case 'approved':
        return source.filter((s) => s.status === IDEA_STATUS.APPROVED);
      case 'rejected':
        return source.filter((s) => s.status === IDEA_STATUS.REJECTED);
      case 'phiFlagged':
        return source.filter((s) => s.phiRequired);
      case 'all':
      default:
        return source;
    }
  }, [submissions, activeFilter]);

  const visibleSubmissions = useMemo(() => {
    let list = [...filteredSubmissions];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.title?.toLowerCase().includes(q) ||
          s.department?.toLowerCase().includes(q),
      );
    }
    switch (sortKey) {
      case 'oldest':
        list.sort((a, b) => (a.createdOn ?? '').localeCompare(b.createdOn ?? ''));
        break;
      case 'title':
        list.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
        break;
      case 'status':
        list.sort((a, b) => a.status - b.status);
        break;
      case 'newest':
      default:
        list.sort((a, b) => (b.createdOn ?? '').localeCompare(a.createdOn ?? ''));
    }
    return list;
  }, [filteredSubmissions, search, sortKey]);

  const isNarrowed = Boolean(search.trim()) || activeFilter !== 'all';
  const displayedSubmissions = isNarrowed ? visibleSubmissions : visibleSubmissions.slice(0, 6);

  function handleFilterClick(nextFilter: DashboardFilter) {
    setActiveFilter((current) => (current === nextFilter ? 'all' : nextFilter));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Agentic AI use case pipeline overview</p>
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
            label="Under Review"
            count={counts.underReview}
            color="text-yellow-600"
            isActive={activeFilter === 'underReview'}
            onClick={() => handleFilterClick('underReview')}
          />
          <StatusCard
            label="Approved"
            count={counts.approved}
            color="text-green-600"
            isActive={activeFilter === 'approved'}
            onClick={() => handleFilterClick('approved')}
          />
          <StatusCard
            label="Rejected"
            count={counts.rejected}
            color="text-red-600"
            isActive={activeFilter === 'rejected'}
            onClick={() => handleFilterClick('rejected')}
          />
          <StatusCard
            label="PHI Flagged"
            count={counts.phiFlagged}
            color="text-orange-600"
            isActive={activeFilter === 'phiFlagged'}
            onClick={() => handleFilterClick('phiFlagged')}
          />
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold">
            {isNarrowed ? 'Matching Submissions' : 'Recent Submissions'}
          </h2>
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or department…"
              className="h-8 w-56"
              aria-label="Search submissions by title or department"
            />
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-8 w-36" aria-label="Sort submissions">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="title">Title (A–Z)</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : displayedSubmissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isNarrowed ? 'No submissions match your search or filter.' : 'No submissions yet.'}
          </p>
        ) : (
          <div className="rounded-md border divide-y">
            {displayedSubmissions.map((submission) => (
              <Link
                key={submission.id}
                to={`/submissions/${submission.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{submission.title}</p>
                  <p className="text-xs text-muted-foreground">{submission.department} · {submission.createdOn}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {submission.phiRequired && (
                    <Badge variant="destructive" className="text-xs">PHI</Badge>
                  )}
                  <Badge variant={IDEA_STATUS_BADGE_VARIANT[submission.status]}>
                    {IDEA_STATUS_LABELS[submission.status] ?? 'Unknown'}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
