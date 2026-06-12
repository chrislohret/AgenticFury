import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  useAiCoeTeam,
  useMyPendingApprovals,
  useSaveAiCoeTeamApproval,
  type MyApprovalItem,
} from '@/hooks/usePrototypeData';
import { getScoreBand } from '@/constants/scorecard';
import { cn } from '@/lib/utils';

/** Reviews older than this many days are flagged as past their service level. */
const REVIEW_SLA_DAYS = 5;

function daysSince(value: string | undefined): number | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  const date = dateOnly
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function AgeBadge({ createdOn }: { createdOn?: string }) {
  const age = daysSince(createdOn);
  if (age === null) return <span className="text-xs text-muted-foreground">—</span>;
  const overdue = age > REVIEW_SLA_DAYS;
  return (
    <Badge variant={overdue ? 'destructive' : 'secondary'}>
      waiting {age}d
    </Badge>
  );
}

function ApprovalQueueRow({
  item,
  isSaving,
  assignedToMe,
  onDecision,
}: {
  item: MyApprovalItem;
  isSaving: boolean;
  assignedToMe: boolean;
  onDecision: (item: MyApprovalItem, status: 'approved' | 'denied', comment: string) => void;
}) {
  const [comment, setComment] = useState(item.myApproval?.comment ?? '');
  const band = getScoreBand(item.scorecard?.weightedTotal);

  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="min-w-0">
          <Link
            to={`/submissions/${item.submission.id}`}
            className="font-medium hover:underline"
          >
            {item.submission.title}
          </Link>
          {assignedToMe && (
            <Badge variant="default" className="ml-2 align-middle">Assigned to you</Badge>
          )}
          {item.submission.department && (
            <p className="text-xs text-muted-foreground">{item.submission.department}</p>
          )}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <span className="text-sm">{item.submission.submittedBy ?? '—'}</span>
      </TableCell>
      <TableCell className="align-top">
        <AgeBadge createdOn={item.submission.createdOn} />
      </TableCell>
      <TableCell className="align-top">
        {typeof item.scorecard?.weightedTotal === 'number' ? (
          <div className="flex flex-col items-start gap-1">
            <span className="text-sm font-semibold tabular-nums">
              {item.scorecard.weightedTotal} / 100
            </span>
            {band && (
              <Badge variant={band.badgeVariant} title={band.description}>
                {band.label}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Not scored</span>
        )}
      </TableCell>
      <TableCell className="align-top w-[28%] min-w-64">
        <Textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment (required to deny)."
        />
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            onClick={() => onDecision(item, 'approved', comment)}
            disabled={isSaving}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDecision(item, 'denied', comment)}
            disabled={isSaving}
          >
            Deny
          </Button>
          <Button size="sm" variant="ghost" asChild className="h-7 px-2 text-xs">
            <Link to={`/submissions/${item.submission.id}`}>Open</Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function MyApprovalsPage() {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const { data: team = [], isLoading: teamLoading } = useAiCoeTeam();

  const myMember = useMemo(() => {
    const email = currentUser?.email?.trim().toLowerCase();
    const name = currentUser?.fullName?.trim().toLowerCase();
    return (
      team.find((m) => email && m.userEmail?.trim().toLowerCase() === email) ??
      team.find((m) => name && m.userName?.trim().toLowerCase() === name) ??
      null
    );
  }, [currentUser, team]);

  const { items, isLoading: queueLoading } = useMyPendingApprovals(myMember?.id);
  const saveApproval = useSaveAiCoeTeamApproval();

  // Surface ideas explicitly assigned to the current reviewer at the top.
  const sortedItems = useMemo(() => {
    const mine = myMember?.memberId;
    if (!mine) return items;
    return [...items].sort((a, b) => {
      const aMine = a.submission.assignedReviewer === mine ? 0 : 1;
      const bMine = b.submission.assignedReviewer === mine ? 0 : 1;
      return aMine - bMine;
    });
  }, [items, myMember?.memberId]);

  async function handleDecision(
    item: MyApprovalItem,
    approvalStatus: 'approved' | 'denied',
    comment: string,
  ) {
    if (!myMember) return;
    const trimmed = comment.trim();
    if (approvalStatus === 'denied' && !trimmed) {
      toast.error('Add a comment explaining the denial.');
      return;
    }
    try {
      await saveApproval.mutateAsync({
        submissionId: item.submission.id,
        teamMemberId: myMember.id,
        approvalStatus,
        comment: trimmed || undefined,
      });
      toast.success(`${item.submission.title} marked as ${approvalStatus}.`);
    } catch {
      toast.error('Unable to save approval decision.');
    }
  }

  const isLoading = userLoading || teamLoading || queueLoading;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ideas in CoE review that are waiting on your decision.
        </p>
      </div>

      {!isLoading && !myMember ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            You are not a member of the AI CoE Team, so you have no approvals queue.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pending Your Review
              {!isLoading && (
                <Badge variant="secondary" className={cn('ml-2')}>
                  {items.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
                You're all caught up — no ideas are waiting on your decision.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Idea</TableHead>
                      <TableHead>Submitted by</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead className="w-32">Decision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedItems.map((item) => (
                      <ApprovalQueueRow
                        key={item.submission.id}
                        item={item}
                        isSaving={saveApproval.isPending}
                        assignedToMe={Boolean(myMember?.memberId) && item.submission.assignedReviewer === myMember?.memberId}
                        onDecision={handleDecision}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
