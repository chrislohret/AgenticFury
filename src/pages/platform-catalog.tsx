import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  usePlatforms,
  useSavePlatform,
  useDeletePlatform,
  usePlatformAttributes,
  useSavePlatformAttribute,
  useDeletePlatformAttribute,
  usePlatformAssignments,
  useSetPlatformAssignments,
} from '@/hooks/usePrototypeData';
import type { Platform, PlatformAttribute, PlatformAttributeCategory } from '@/types/domain-models';

const ATTRIBUTE_CATEGORIES: Array<{ key: PlatformAttributeCategory; label: string }> = [
  { key: 'capability', label: 'Capabilities' },
  { key: 'decision-criteria', label: 'Decision Criteria' },
  { key: 'cost-mechanism', label: 'Cost Mechanisms' },
];

// ── Platform form ────────────────────────────────────────────────────────────

interface PlatformFormState {
  id?: string;
  name: string;
  description: string;
  displayOrder: string;
  isActive: boolean;
}

const EMPTY_PLATFORM_FORM: PlatformFormState = {
  name: '',
  description: '',
  displayOrder: '0',
  isActive: true,
};

function PlatformsTab() {
  const [form, setForm] = useState<PlatformFormState>(EMPTY_PLATFORM_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Platform | null>(null);

  const { data: platforms = [], isLoading } = usePlatforms();
  const savePlatform = useSavePlatform();
  const deletePlatform = useDeletePlatform();

  function resetForm() {
    setForm(EMPTY_PLATFORM_FORM);
  }

  function startEdit(record: Platform) {
    setForm({
      id: record.id,
      name: record.name,
      description: record.description ?? '',
      displayOrder: String(record.displayOrder ?? 0),
      isActive: record.isActive,
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    const parsedOrder = Number(form.displayOrder);
    try {
      await savePlatform.mutateAsync({
        id: form.id,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        displayOrder: Number.isFinite(parsedOrder) ? parsedOrder : 0,
        isActive: form.isActive,
      });
      toast.success(form.id ? 'Platform updated.' : 'Platform created.');
      resetForm();
    } catch {
      toast.error('Unable to save platform.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePlatform.mutateAsync(id);
      toast.success('Platform deleted.');
      if (form.id === id) resetForm();
      setDeleteTarget(null);
    } catch {
      toast.error('Unable to delete platform.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Platforms</CardTitle>
            <Button size="sm" onClick={resetForm}>
              + New Platform
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : platforms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No platforms configured yet.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {platforms.map((platform) => (
                      <TableRow key={platform.id}>
                        <TableCell>
                          <div className="font-medium">{platform.name}</div>
                          {platform.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{platform.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {platform.displayOrder}
                        </TableCell>
                        <TableCell>{platform.isActive ? 'Active' : 'Inactive'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(platform)}>
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(platform)}
                            disabled={deletePlatform.isPending}
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
            <CardTitle className="text-base">{form.id ? 'Edit Platform' : 'Add Platform'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="platform-name">Name</Label>
              <Input
                id="platform-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Microsoft Copilot Studio"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="platform-description">Description</Label>
              <Textarea
                id="platform-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                placeholder="Short summary shown to submitters"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="platform-order">Display Order</Label>
              <Input
                id="platform-order"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.displayOrder}
                onChange={(event) => setForm((prev) => ({ ...prev, displayOrder: event.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="platform-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))}
              />
              <Label htmlFor="platform-active">Active</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!form.name.trim() || savePlatform.isPending}>
                {form.id ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {form.id && (
        <PlatformAssignmentPanel platformId={form.id} platformName={form.name} />
      )}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              Deleting a platform is permanent and removes it from the submission picker. Ideas
              that already selected it will keep the stored reference until re-saved. Deactivate it
              instead to hide it from new submissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              disabled={deletePlatform.isPending}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Assignment panel ─────────────────────────────────────────────────────────

function PlatformAssignmentPanel({ platformId, platformName }: { platformId: string; platformName: string }) {
  const capabilities = usePlatformAttributes('capability');
  const decisionCriteria = usePlatformAttributes('decision-criteria');
  const costMechanisms = usePlatformAttributes('cost-mechanism');
  const { data: assignments = [], isLoading: assignmentsLoading } = usePlatformAssignments(platformId);
  const setAssignments = useSetPlatformAssignments();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Re-hydrate the selection whenever the platform or its persisted
  // assignments change.
  useEffect(() => {
    setSelected(new Set(assignments.map((a) => a.attributeId)));
  }, [assignments]);

  const groups = useMemo(
    () => [
      { key: 'capability' as const, label: 'Capabilities', data: capabilities.data ?? [] },
      { key: 'decision-criteria' as const, label: 'Decision Criteria', data: decisionCriteria.data ?? [] },
      { key: 'cost-mechanism' as const, label: 'Cost Mechanisms', data: costMechanisms.data ?? [] },
    ],
    [capabilities.data, decisionCriteria.data, costMechanisms.data],
  );

  const loading =
    assignmentsLoading || capabilities.isLoading || decisionCriteria.isLoading || costMechanisms.isLoading;

  function toggle(attributeId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(attributeId)) next.delete(attributeId);
      else next.add(attributeId);
      return next;
    });
  }

  async function handleSave() {
    try {
      await setAssignments.mutateAsync({ platformId, attributeIds: [...selected] });
      toast.success('Assignments saved.');
    } catch {
      toast.error('Unable to save assignments.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Assigned attributes{platformName ? ` — ${platformName}` : ''}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Choose the capabilities, decision criteria, and cost mechanisms shown for this platform on
          the submission form.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {groups.map((group) => (
              <div key={group.key} className="space-y-2">
                <h3 className="text-sm font-medium">{group.label}</h3>
                {group.data.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None defined.</p>
                ) : (
                  group.data.map((attr: PlatformAttribute) => (
                    <label key={attr.id} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={selected.has(attr.id)}
                        onCheckedChange={() => toggle(attr.id)}
                        className="mt-0.5"
                      />
                      <span className={attr.isActive ? '' : 'text-muted-foreground'}>
                        {attr.name}
                        {!attr.isActive && ' (inactive)'}
                      </span>
                    </label>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
        <div>
          <Button onClick={handleSave} disabled={loading || setAssignments.isPending}>
            Save assignments
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Attribute library ────────────────────────────────────────────────────────

interface AttributeFormState {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
}

const EMPTY_ATTRIBUTE_FORM: AttributeFormState = {
  name: '',
  description: '',
  isActive: true,
};

function AttributeLibraryTab() {
  const [category, setCategory] = useState<PlatformAttributeCategory>('capability');
  const [form, setForm] = useState<AttributeFormState>(EMPTY_ATTRIBUTE_FORM);
  const [deleteTarget, setDeleteTarget] = useState<PlatformAttribute | null>(null);

  const { data: attributes = [], isLoading } = usePlatformAttributes(category);
  const saveAttribute = useSavePlatformAttribute();
  const deleteAttribute = useDeletePlatformAttribute(category);

  const categoryLabel = useMemo(
    () => ATTRIBUTE_CATEGORIES.find((item) => item.key === category)?.label ?? category,
    [category],
  );

  function resetForm() {
    setForm(EMPTY_ATTRIBUTE_FORM);
  }

  function startEdit(record: PlatformAttribute) {
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
      await saveAttribute.mutateAsync({
        id: form.id,
        category,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        isActive: form.isActive,
      });
      toast.success(form.id ? 'Attribute updated.' : 'Attribute created.');
      resetForm();
    } catch {
      toast.error('Unable to save attribute.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAttribute.mutateAsync(id);
      toast.success('Attribute deleted.');
      if (form.id === id) resetForm();
      setDeleteTarget(null);
    } catch {
      toast.error('Unable to delete attribute.');
    }
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={category}
        onValueChange={(value) => { setCategory(value as PlatformAttributeCategory); resetForm(); }}
      >
        <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0">
          {ATTRIBUTE_CATEGORIES.map((item) => (
            <TabsTrigger key={item.key} value={item.key} className="border">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{categoryLabel}</CardTitle>
            <Button size="sm" onClick={resetForm}>
              + New Value
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : attributes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No values exist yet for this category.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attributes.map((attr) => (
                      <TableRow key={attr.id}>
                        <TableCell>
                          <div className="font-medium">{attr.name}</div>
                          {attr.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{attr.description}</div>
                          )}
                        </TableCell>
                        <TableCell>{attr.isActive ? 'Active' : 'Inactive'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(attr)}>
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(attr)}
                            disabled={deleteAttribute.isPending}
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
              <Label htmlFor="attribute-name">Name</Label>
              <Input
                id="attribute-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={`Enter ${categoryLabel.toLowerCase()} value`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attribute-description">Description</Label>
              <Textarea
                id="attribute-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                placeholder="Optional guidance shown to submitters"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="attribute-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))}
              />
              <Label htmlFor="attribute-active">Active</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!form.name.trim() || saveAttribute.isPending}>
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
              Deleting an attribute is permanent and removes it from every platform it is assigned
              to. Deactivate it instead to retire it from future use while keeping existing
              assignments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              disabled={deleteAttribute.isPending}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PlatformCatalogPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform Catalog</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the AI platforms submitters can choose, the reusable attributes they can be
          described by, and which attributes are assigned to each platform.
        </p>
      </div>

      <Tabs defaultValue="platforms">
        <TabsList>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="attributes">Attribute Library</TabsTrigger>
        </TabsList>
        <TabsContent value="platforms" className="mt-6">
          <PlatformsTab />
        </TabsContent>
        <TabsContent value="attributes" className="mt-6">
          <AttributeLibraryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
