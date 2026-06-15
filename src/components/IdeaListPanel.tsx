import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IdeaSubmission } from '@/types/domain-models';

type SortKey = 'newest' | 'oldest' | 'title' | 'status';

const PAGE_SIZE = 10;

export interface IdeaListPanelProps {
  /** Submissions already filtered by the active card filter. */
  submissions: IdeaSubmission[];
  isLoading: boolean;
  /** True when a card filter is active, so the list is not capped to the first 6. */
  isNarrowed: boolean;
  /** Renders the trailing stage badge for a row (submission stage vs build stage). */
  renderBadge: (submission: IdeaSubmission) => ReactNode;
  /** Numeric accessor used by the "status" sort option. */
  sortValue: (submission: IdeaSubmission) => number;
  /** Heading label for the sort dropdown's status option (e.g. "Stage", "Build phase"). */
  statusSortLabel?: string;
}

export function IdeaListPanel({
  submissions,
  isLoading,
  isNarrowed,
  renderBadge,
  sortValue,
  statusSortLabel = 'Status',
}: IdeaListPanelProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [page, setPage] = useState(0);

  const visibleSubmissions = useMemo(() => {
    let list = [...submissions];
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
        list.sort((a, b) => sortValue(a) - sortValue(b));
        break;
      case 'newest':
      default:
        list.sort((a, b) => (b.createdOn ?? '').localeCompare(a.createdOn ?? ''));
    }
    return list;
  }, [submissions, search, sortKey, sortValue]);

  const searchNarrowed = isNarrowed || Boolean(search.trim());
  const pageCount = Math.max(1, Math.ceil(visibleSubmissions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const displayedSubmissions = visibleSubmissions.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE,
  );

  // Reset to the first page whenever the filtered/sorted result set changes.
  useEffect(() => {
    setPage(0);
  }, [search, sortKey, submissions]);

  const rangeStart = visibleSubmissions.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE + PAGE_SIZE, visibleSubmissions.length);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold">
          {searchNarrowed ? 'Matching Submissions' : 'Recent Submissions'}
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
              <SelectItem value="status">{statusSortLabel}</SelectItem>
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
          {searchNarrowed ? 'No submissions match your search or filter.' : 'No submissions yet.'}
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
                {renderBadge(submission)}
              </div>
            </Link>
          ))}
        </div>
      )}
      {!isLoading && visibleSubmissions.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 mt-3">
          <p className="text-xs text-muted-foreground">
            Showing {rangeStart}–{rangeEnd} of {visibleSubmissions.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {currentPage + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={currentPage >= pageCount - 1}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatusCardProps {
  label: string;
  count: number;
  color: string;
  isActive: boolean;
  onClick: () => void;
}

export function StatusCard({ label, count, color, isActive, onClick }: StatusCardProps) {
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
