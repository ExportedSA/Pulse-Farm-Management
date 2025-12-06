import { useState } from "react";
import { Warehouse, Play, Square, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { startFeed, stopFeed } from "../../api/hardwareClient";
import { useHardwareStatus } from "../../hooks/useHardwareStatus";

export const FeedHeadPanel: React.FC = () => {
  const { data: status } = useHardwareStatus(1000);
  const [bail, setBail] = useState<number>(1);
  const [grams, setGrams] = useState<number>(250);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    try {
      setBusy(true);
      setError(null);
      await startFeed(bail, grams);
    } catch (e: any) {
      setError(e?.message ?? "Failed to start feed");
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    try {
      setBusy(true);
      setError(null);
      await stopFeed(bail);
    } catch (e: any) {
      setError(e?.message ?? "Failed to stop feed");
    } finally {
      setBusy(false);
    }
  };

  const getStateInfo = (state: number) => {
    const stateMap: Record<number, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      0: { label: "IDLE", variant: "secondary" },
      1: { label: "FEEDING", variant: "default" },
      2: { label: "DONE", variant: "outline" },
      3: { label: "JAM", variant: "destructive" },
    };
    return stateMap[state] ?? { label: `UNKNOWN (${state})`, variant: "outline" as const };
  };

  const renderBail = (
    bailNum: number,
    b?: { actual: number; target: number; state: number }
  ) => {
    if (!b) return null;
    const stateInfo = getStateInfo(b.state);
    const progress = b.target > 0 ? (b.actual / b.target) * 100 : 0;

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bail {bailNum}</CardTitle>
          <Warehouse className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-2xl font-bold">{b.actual}g</p>
              <p className="text-xs text-muted-foreground">of {b.target}g target</p>
            </div>
            <Badge variant={stateInfo.variant}>{stateInfo.label}</Badge>
          </div>
          {b.state === 1 && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{Math.round(progress)}%</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderBail(1, status?.b1)}
        {renderBail(2, status?.b2)}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feed Control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bail">Bail Number</Label>
              <Input
                id="bail"
                type="number"
                value={bail}
                onChange={(e) => setBail(Number(e.target.value))}
                min={1}
                max={2}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grams">Target Grams</Label>
              <Input
                id="grams"
                type="number"
                value={grams}
                onChange={(e) => setGrams(Number(e.target.value))}
                min={0}
                step={50}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleStart}
              disabled={busy}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Feed
            </Button>
            <Button
              onClick={handleStop}
              disabled={busy}
              variant="destructive"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Feed
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
