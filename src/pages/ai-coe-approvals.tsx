import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  useIdeaSubmissionsPendingForStage,
  useAiCoeTeam,
  useAiCoeTeamApprovals,
  useAiCoeRoles,
  useSaveAiCoeTeamApproval,
} from '@/hooks/usePrototypeData';
import type { AiCoeTeamApproval, AiCoeTeamMember } from '@/types/domain-models';

const APPROVAL_LABELS: Record<AiCoeTeamApproval['approvalStatus'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
};

const APPROVAL_VARIANTS: Record<AiCoeTeamApproval['approvalStatus'], 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  denied: 'destructive',
};

function ApprovalRow({
  member,
  roleName,
  approval,
  draftComment,
  onCommentChange,
  onDecision,
  isSaving,
}: {
  member: AiCoeTeamMember;
  roleName: string;
  approval: AiCoeTeamApproval | undefined;
  draftComment: string;
  onCommentChange: (value: string) => void;
  onDecision: (status: 'approved' | 'denied') => void;
  isSaving: boolean;
}) {
  const currentStatus = approval?.approvalStatus ?? 'pending';

  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="min-w-0">
          <p className="font-medium truncate">{member.userName}</p>
          <p className="text-xs text-muted-foreground truncate">{member.userEmail}</p>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <span className="text-sm">{roleName}</span>
      </TableCell>
      <TableCell className="align-top w-[38%] min-w-80">
        <Textarea
          rows={2}
          value={draftComment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Add a comment explaining why this approval was granted or denied."
        />
      </TableCell>
      <TableCell className="align-top">
        <Badge variant={APPROVAL_VARIANTS[currentStatus]}>{APPROVAL_LABELS[currentStatus]}</Badge>
        {approval?.reviewedOn && (
          <p className="mt-1 text-xs text-muted-foreground">{new Date(approval.reviewedOn).toLocaleString()}</p>
        )}
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-2">
          <Button size="sm" onClick={() => onDecision('approved')} disabled={isSaving}>
            Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDecision('denied')} disabled={isSaving}>
            Deny
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function AiCoeApprovalsPage() {
  const { data: reviewQueue = [], isLoading: reviewQueueLoading } = useIdeaSubmissionsPendingForStage('coe-review');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('');
  const { data: members = [], isLoading: membersLoading } = useAiCoeTeam();
  const { data: approvals = [], isLoading: approvalsLoading } = useAiCoeTeamApprovals(selectedSubmissionId || undefined);
  const { data: roles = [] } = useAiCoeRoles();
  const saveApproval = useSaveAiCoeTeamApproval();

  const [draftComments, setDraftComments] = useState<Record<string, string>>({});

  const roleMap = useMemo(
    () => new Map(roles.map((role) => [role.id, role.name])),
    [roles],
  );

  const approvalMap = useMemo(
    () => new Map(approvals.map((approval) => [approval.teamMemberId, approval])),
    [approvals],
  );

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.userName.localeCompare(b.userName)),
    [members],
  );

  useEffect(() => {
    if (!selectedSubmissionId && reviewQueue.length > 0) {
      setSelectedSubmissionId(reviewQueue[0].id);
    }
  }, [selectedSubmissionId, reviewQueue]);

  useEffect(() => {
    setDraftComments((current) => {
      const next: Record<string, string> = {};
      for (const member of members) {
        next[member.id] = current[member.id] ?? approvalMap.get(member.id)?.comment ?? '';
      }
      return next;
    });
  }, [members, approvalMap]);

  async function handleDecision(member: AiCoeTeamMember, approvalStatus: 'approved' | 'denied') {
    const comment = draftComments[member.id]?.trim() ?? '';
    if (approvalStatus === 'denied' && !comment) {
      toast.error('Add a comment explaining the denial.');
      return;
    }

    try {
      await saveApproval.mutateAsync({
        submissionId: selectedSubmissionId,
        teamMemberId: member.id,
        approvalStatus,
        comment: comment || undefined,
      });
      toast.success(`${member.userName} marked as ${approvalStatus}.`);
    } catch {
      toast.error('Unable to save approval decision.');
    }
  }

  const isLoading = membersLoading || approvalsLoading || reviewQueueLoading;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI CoE Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review each AI CoE team member per idea, capture a comment, and approve or deny the assignment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Idea Context</CardTitle>
        </CardHeader>
        <CardContent>
          {reviewQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ideas are currently pending review.</p>
          ) : (
            <label className="space-y-1 block">
              <span className="text-sm font-medium">Selected Idea</span>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedSubmissionId}
                onChange={(e) => setSelectedSubmissionId(e.target.value)}
              >
                {reviewQueue.map((idea) => (
                  <option key={idea.id} value={idea.id}>{idea.title}</option>
                ))}
              </select>
            </label>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Grid</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : !selectedSubmissionId ? (
            <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
              Select an idea to load approvals.
            </div>
          ) : sortedMembers.length === 0 ? (
            <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
              No AI CoE team members found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMembers.map((member) => (
                    <ApprovalRow
                      key={member.id}
                      member={member}
                      roleName={roleMap.get(member.roleId) ?? 'Unknown role'}
                      approval={approvalMap.get(member.id)}
                      draftComment={draftComments[member.id] ?? ''}
                      onCommentChange={(value) =>
                        setDraftComments((current) => ({ ...current, [member.id]: value }))
                      }
                      onDecision={(status) => void handleDecision(member, status)}
                      isSaving={saveApproval.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}