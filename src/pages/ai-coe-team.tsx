import { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useAiCoeTeam,
  useAiCoeRoles,
  useSaveAiCoeTeamMember,
  useDeleteAiCoeTeamMember,
  useDirectoryUsers,
} from '@/hooks/usePrototypeData';
import type { AiCoeTeamMember, DirectoryUser } from '@/types/domain-models';

interface TeamMemberFormState {
  selectedUser: DirectoryUser | null;
  selectedRoleId: string;
}

const EMPTY_FORM: TeamMemberFormState = {
  selectedUser: null,
  selectedRoleId: '',
};



function RolePicker({
  roles,
  selectedRoleId,
  onSelect,
}: {
  roles: Array<{ id: string; name: string; description?: string }>;
  selectedRoleId: string;
  onSelect: (roleId: string) => void;
}) {
  return (
    <Select value={selectedRoleId} onValueChange={onSelect}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a role…" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            <div className="flex flex-col">
              <span>{role.name}</span>
              {role.description && (
                <span className="text-xs text-muted-foreground">{role.description}</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function AiCoeTeamPage() {
  const { data: members = [], isLoading: membersLoading } = useAiCoeTeam();
  const { data: allRoles = [] } = useAiCoeRoles();
  const { data: directoryUsers = [] } = useDirectoryUsers();
  const saveMember = useSaveAiCoeTeamMember();
  const deleteMember = useDeleteAiCoeTeamMember();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<AiCoeTeamMember | null>(null);
  const [form, setForm] = useState<TeamMemberFormState>(EMPTY_FORM);

  const activeRoles = useMemo(() => allRoles, [allRoles]);

  const roleMap = useMemo(
    () => new Map(allRoles.map((r) => [r.id, r.name])),
    [allRoles],
  );

  const existingUserIds = useMemo(
    () => members.map((m) => m.memberId),
    [members],
  );

  function openAddDialog() {
    setEditingMember(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(member: AiCoeTeamMember) {
    setEditingMember(member);
    setForm({ selectedUser: null, selectedRoleId: member.roleId });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingMember(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!editingMember && !form.selectedUser) {
      toast.error('Please select a user.');
      return;
    }
    if (!form.selectedRoleId) {
      toast.error('Please select a role.');
      return;
    }

    try {
      if (editingMember) {
        await saveMember.mutateAsync({
          id: editingMember.id,
          memberId: editingMember.memberId,
          userName: editingMember.userName,
          userEmail: editingMember.userEmail,
          roleId: form.selectedRoleId,
        });
        toast.success('Role updated.');
      } else {
        const user = form.selectedUser!;
        await saveMember.mutateAsync({
          memberId: user.id,
          userName: user.displayName,
          userEmail: user.email,
          roleId: form.selectedRoleId,
        });
        toast.success(`${user.displayName} added to the AI CoE team.`);
      }
      closeDialog();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to save team member.';
      toast.error(message);
    }
  }

  async function handleDelete(member: AiCoeTeamMember) {
    try {
      await deleteMember.mutateAsync(member.id);
      toast.success(`${member.userName} removed from the team.`);
    } catch {
      toast.error('Unable to remove team member.');
    }
  }

  const isAddMode = editingMember === null;
  const canSave =
    form.selectedRoleId &&
    (isAddMode ? form.selectedUser !== null : true);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI CoE Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage team members of the AI Center of Excellence and their assigned roles.
          </p>
        </div>
        <Button onClick={openAddDialog} className="shrink-0">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No team members yet. Use "Add Member" to build the AI CoE team.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.userName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{member.userEmail}</TableCell>
                      <TableCell>
                        {roleMap.has(member.roleId) ? (
                          <Badge variant="secondary">{roleMap.get(member.roleId)}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unknown role</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{member.addedOn}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(member)}>
                          Edit Role
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(member)}
                          disabled={deleteMember.isPending}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isAddMode ? 'Add Team Member' : 'Edit Role'}</DialogTitle>
            <DialogDescription>
              {isAddMode
                ? 'Select a user from the directory and assign them a CoE role.'
                : `Update the CoE role for ${editingMember?.userName}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Team Member</Label>
              {isAddMode ? (
                <Select
                  value={form.selectedUser?.id ?? ''}
                  onValueChange={(userId) => {
                    const user = directoryUsers.find((u) => u.id === userId) ?? null;
                    setForm((prev) => ({ ...prev, selectedUser: user }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a team member…" />
                  </SelectTrigger>
                  <SelectContent>
                    {directoryUsers
                      .filter((u) => !existingUserIds.includes(u.id))
                      .sort((a, b) => a.displayName.localeCompare(b.displayName))
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <span className="font-medium">{user.displayName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{user.email}</span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <div className="font-medium">{editingMember?.userName}</div>
                  <div className="text-xs text-muted-foreground">{editingMember?.userEmail}</div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>AI CoE Role</Label>
              <RolePicker
                roles={activeRoles}
                selectedRoleId={form.selectedRoleId}
                onSelect={(roleId) => setForm((prev) => ({ ...prev, selectedRoleId: roleId }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saveMember.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave || saveMember.isPending}>
              {isAddMode ? 'Add Member' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
