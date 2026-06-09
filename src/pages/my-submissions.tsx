import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useIdeaSubmissionsBySubmitter } from '@/hooks/usePrototypeData';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { IDEA_STATUS_LABELS, IDEA_STATUS_BADGE_VARIANT } from '@/constants/ideaStatus';

export default function MySubmissionsPage() {
  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser();
  const { data: submissions, isLoading: submissionsLoading } = useIdeaSubmissionsBySubmitter(currentUser?.id ?? '');
  const isLoading = currentUserLoading || submissionsLoading;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Ideas</h1>
          <p className="text-sm text-muted-foreground mt-1">Ideas you created. Select one to edit in the submit form.</p>
        </div>
        <Button asChild>
          <Link to="/submit">New Idea</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !currentUser ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          Unable to resolve the current user for this environment.
        </div>
      ) : !submissions || submissions.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          You haven't submitted any ideas yet.{' '}
          <Link to="/submit" className="underline underline-offset-2 hover:text-foreground">
            Submit your first idea.
          </Link>
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {submissions.map((submission) => (
            <Link
              key={submission.id}
              to={`/submit/${submission.id}`}
              className="flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium truncate">{submission.title}</p>
                <p className="text-xs text-muted-foreground">
                  {submission.department && `${submission.department} · `}
                  {submission.createdOn}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {submission.phiRequired && (
                  <Badge variant="destructive" className="text-xs">PHI</Badge>
                )}
                <Badge variant={IDEA_STATUS_BADGE_VARIANT[submission.status]}>
                  {IDEA_STATUS_LABELS[submission.status] ?? 'Unknown'}
                </Badge>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link to={`/submit/${submission.id}`}>Edit</Link>
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
