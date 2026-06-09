import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useAiCoeRoles,
  useSaveAiCoeRole,
  useDeleteAiCoeRole,
} from '@/hooks/usePrototypeData';
import type { AiCoeRole } from '@/types/domain-models';

interface RoleFormState {
  id?: string;
  name: string;
  description: string;
}

const EMPTY_FORM: RoleFormState = { name: '', description: '' };

export default function CoeRolesPage() {
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM);
  const { data: roles = [], isLoading } = useAiCoeRoles();
  const saveRole = useSaveAiCoeRole();
  const deleteRole = useDeleteAiCoeRole();

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function startEdit(record: AiCoeRole) {
    setForm({
      id: record.id,
      name: record.name,
      description: record.description ?? '',
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    try {
      await saveRole.mutateAsync({
        id: form.id,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      });
      toast.success(form.id ? 'Role updated.' : 'Role created.');
      resetForm();
    } catch {
      toast.error('Unable to save role.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRole.mutateAsync(id);
      toast.success('Role deleted.');
      if (form.id === id) resetForm();
    } catch {
      toast.error('Unable to delete role.');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI CoE Roles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the roles that can be assigned to AI Center of Excellence team members.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles defined yet.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role Name</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell>
                          <div className="font-medium">{role.name}</div>
                          {role.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(role)}>
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(role.id)}
                            disabled={deleteRole.isPending}
                          >
                            Delete
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{form.id ? 'Edit Role' : 'Add Role'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Technical Reviewer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Describe the responsibilities of this role."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!form.name.trim() || saveRole.isPending}>
                {form.id ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
