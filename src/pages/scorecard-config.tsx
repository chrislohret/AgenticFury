import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useScorecardWeights, useSaveScorecardWeights } from '@/hooks/usePrototypeData';
import { SCORECARD_DIMENSIONS, SCORECARD_MAX_TOTAL, type ScorecardDimensionKey } from '@/constants/scorecard';
import { cn } from '@/lib/utils';

type WeightValues = Record<ScorecardDimensionKey, string>;

function defaultValues(): WeightValues {
  return SCORECARD_DIMENSIONS.reduce((acc, dimension) => {
    acc[dimension.key] = String(dimension.weight);
    return acc;
  }, {} as WeightValues);
}

function parseWeight(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ScorecardConfigPage() {
  const { data: weights, isLoading } = useScorecardWeights();
  const saveWeights = useSaveScorecardWeights();
  const [values, setValues] = useState<WeightValues>(defaultValues);

  useEffect(() => {
    if (weights && weights.length) {
      setValues(
        weights.reduce((acc, weight) => {
          acc[weight.dimensionKey] = String(weight.weight);
          return acc;
        }, {} as WeightValues),
      );
    }
  }, [weights]);

  const total = useMemo(
    () => SCORECARD_DIMENSIONS.reduce((sum, dimension) => sum + parseWeight(values[dimension.key] ?? '0'), 0),
    [values],
  );

  const isValidTotal = total === SCORECARD_MAX_TOTAL;

  function handleChange(key: ScorecardDimensionKey, raw: string) {
    // Keep only digits so the running total stays a clean integer sum.
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    setValues((prev) => ({ ...prev, [key]: digitsOnly }));
  }

  function resetToDefaults() {
    setValues(defaultValues());
  }

  async function handleSave() {
    if (!isValidTotal) {
      toast.error(`Weights must sum to exactly ${SCORECARD_MAX_TOTAL}.`);
      return;
    }
    try {
      await saveWeights.mutateAsync(
        SCORECARD_DIMENSIONS.map((dimension) => ({
          dimensionKey: dimension.key,
          weight: parseWeight(values[dimension.key] ?? '0'),
        })),
      );
      toast.success('Scorecard weights saved.');
    } catch {
      toast.error('Unable to save scorecard weights.');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scorecard Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set the percentage weight applied to each scorecard dimension. The five weights must sum to{' '}
          {SCORECARD_MAX_TOTAL}. New and updated scorecards use these weights when computing the weighted total.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dimension Weights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              SCORECARD_DIMENSIONS.map((dimension) => (
                <div
                  key={dimension.key}
                  className="flex items-start justify-between gap-4 border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <Label htmlFor={`weight-${dimension.key}`} className="font-medium">
                      {dimension.label}
                    </Label>
                    <p className="text-xs text-muted-foreground max-w-md">{dimension.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      id={`weight-${dimension.key}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={SCORECARD_MAX_TOTAL}
                      value={values[dimension.key] ?? ''}
                      onChange={(e) => handleChange(dimension.key, e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span
                className={cn(
                  'text-2xl font-semibold tabular-nums',
                  isValidTotal ? 'text-emerald-600' : 'text-destructive',
                )}
              >
                {total}%
              </span>
            </div>
            {!isValidTotal && (
              <p className="text-xs text-destructive">
                Weights currently sum to {total}%. Adjust them to total {SCORECARD_MAX_TOTAL}% before saving.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button onClick={handleSave} disabled={!isValidTotal || saveWeights.isPending}>
                {saveWeights.isPending ? 'Saving…' : 'Save Weights'}
              </Button>
              <Button variant="outline" onClick={resetToDefaults} disabled={saveWeights.isPending}>
                Reset to Defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
