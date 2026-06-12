import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useLookupOptions,
  useLookupOptionUsage,
  useSaveLookupOption,
  useDeleteLookupOption,
} from '@/hooks/usePrototypeData';
import type { LookupCategory, LookupOption } from '@/types/domain-models';

const LOOKUP_CATEGORIES: Array<{ key: LookupCategory; label: string }> = [
  { key: 'business-objectives', label: 'Business Objectives' },
  { key: 'intended-user-roles', label: 'Intended User Roles' },
  { key: 'data-sources', label: 'Data Sources' },
  { key: 'expected-outcomes', label: 'Expected Outcomes' },
  { key: 'risk-factors', label: 'Risk Factors' },
  { key: 'departments', label: 'Departments' },
];

interface LookupFormState {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
}

const EMPTY_FORM: LookupFormState = {
  name: '',
  description: '',
  isActive: true,
};

export default function LookupTablesPage() {
  const [category, setCategory] = useState<LookupCategory>('data-sources');
  const [form, setForm] = useState<LookupFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<LookupOption | null>(null);

  const { data: options = [], isLoading } = useLookupOptions(category);
  const { data: usageCounts = {} } = useLookupOptionUsage();
  const saveLookup = useSaveLookupOption();
  const deleteLookup = useDeleteLookupOption(category);

  const categoryLabel = useMemo(
    () => LOOKUP_CATEGORIES.find((item) => item.key === category)?.label ?? category,
    [category],
  );

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function startEdit(record: LookupOption) {
    setForm({
      id: record.id,
      name: record.name,
      description: record.description ?? '',
      isActive: record.isActive,
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    try {
      await saveLookup.mutateAsync({
        id: form.id,
        category,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        isActive: form.isActive,
      });
      toast.success(form.id ? 'Lookup option updated.' : 'Lookup option created.');
      resetForm();
    } catch {
      toast.error('Unable to save lookup option.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLookup.mutateAsync(id);
      toast.success('Lookup option deleted.');
      if (form.id === id) {
        resetForm();
      }
      setDeleteTarget(null);
    } catch {
      toast.error('Unable to delete lookup option.');
    }
  }

  async function handleDeactivate(record: LookupOption) {
    try {
      await saveLookup.mutateAsync({
        id: record.id,
        category,
        name: record.name,
        description: record.description,
        isActive: false,
      });
      toast.success('Lookup option deactivated.');
      setDeleteTarget(null);
    } catch {
      toast.error('Unable to deactivate lookup option.');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Normalized Idea Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Maintain structured values used by AI CoE reviewers for multiselect intake fields.
        </p>
      </div>

      <Tabs value={category} onValueChange={(value) => { setCategory(value as LookupCategory); resetForm(); }}>
        <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0">
          {LOOKUP_CATEGORIES.map((item) => (
            <TabsTrigger key={item.key} value={item.key} className="border">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{categoryLabel} Values</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : options.length === 0 ? (
              <p className="text-sm text-muted-foreground">No values exist yet for this lookup table.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Used by</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {options.map((option) => (
                      <TableRow key={option.id}>
                        <TableCell>
                          <div className="font-medium">{option.name}</div>
                          {option.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
                          )}
                        </TableCell>
                        <TableCell>{option.isActive ? 'Active' : 'Inactive'}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {usageCounts[option.id] ?? 0}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(option)}>
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(option)}
                            disabled={deleteLookup.isPending}
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
            <CardTitle className="text-base">{form.id ? 'Edit Value' : 'Add Value'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lookup-name">Name</Label>
              <Input
                id="lookup-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={`Enter ${categoryLabel.toLowerCase()} value`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lookup-description">Description</Label>
              <Textarea
                id="lookup-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                placeholder="Optional guidance shown to reviewers"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="lookup-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))}
              />
              <Label htmlFor="lookup-active">Active</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!form.name.trim() || saveLookup.isPending}>
                {form.id ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              {deleteTarget && (usageCounts[deleteTarget.id] ?? 0) > 0 ? (
                <>
                  This value is referenced by{' '}
                  <strong>
                    {usageCounts[deleteTarget.id]} normalized{' '}
                    {usageCounts[deleteTarget.id] === 1 ? 'record' : 'records'}
                  </strong>
                  . Deleting it is permanent &mdash; it will be removed from the picker and will
                  no longer resolve to a name on those ideas. Deactivate it instead to hide it from
                  new reviews while preserving existing records.
                </>
              ) : (
                <>
                  This value is not referenced by any normalized records yet. Deleting it is
                  permanent. If you only want to retire it from future reviews, deactivate it
                  instead.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            {deleteTarget?.isActive && (
              <Button
                variant="secondary"
                onClick={() => deleteTarget && handleDeactivate(deleteTarget)}
                disabled={saveLookup.isPending}
              >
                Deactivate instead
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              disabled={deleteLookup.isPending}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
