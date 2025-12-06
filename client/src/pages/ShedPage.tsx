import { useEffect, useState } from "react";
import { Warehouse, Activity, Radio, GitBranch, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SystemHealthBadge } from "../components/dashboard/SystemHealthBadge";
import { FeedHeadPanel } from "../components/dashboard/FeedHeadPanel";
import { DraftGatePanel } from "../components/dashboard/DraftGatePanel";
import { EidPanel } from "../components/dashboard/EidPanel";
import { DraftRuleInspectorPanel } from "../components/dashboard/DraftRuleInspectorPanel";
import { getDemoMode, setDemoMode } from "../api/hardwareClient";

type ShedTab = "feed" | "draft" | "eid" | "rules";

export const ShedPage: React.FC = () => {
  const [demo, setDemo] = useState<boolean | null>(null);
  const [canToggle, setCanToggle] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ShedTab>("feed");

  useEffect(() => {
    (async () => {
      try {
        const info = await getDemoMode();
        setDemo(info.demo);
        setCanToggle(info.canToggle);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load mode");
      }
    })();
  }, []);

  const toggleDemo = async () => {
    if (demo === null || !canToggle) return;
    try {
      setBusy(true);
      setError(null);
      const next = !demo;
      const result = await setDemoMode(next);
      setDemo(result.demo);
      setCanToggle(result.canToggle);
    } catch (e: any) {
      setError(e?.message ?? "Failed to update demo mode");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            <Warehouse className="inline-block h-8 w-8 mr-2 mb-1" strokeWidth={1.5} />
            Shed
          </h1>
          <p className="text-muted-foreground">
            Drafting gates, feed heads and EID bail readers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SystemHealthBadge />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Training Mode</span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleDemo}
              disabled={demo === null || busy || !canToggle}
              className="relative"
              title={
                canToggle
                  ? "Toggle training/demo mode"
                  : "You do not have permission to change demo mode"
              }
            >
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                demo ? "bg-primary" : "bg-muted"
              }`}>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background transition ${
                    demo ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
            </Button>
          </div>
        </div>
      </div>

      {demo && (
        <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
          <Activity className="h-4 w-4" />
          <AlertDescription>
            <strong>Training mode active:</strong> All gate, feed and EID behaviour is simulated. No physical hardware will operate.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="mb-6 border-destructive/50 bg-destructive/10">
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as ShedTab)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="feed" className="gap-2">
            <Warehouse className="h-4 w-4" />
            Feed Heads
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Draft Gates
          </TabsTrigger>
          <TabsTrigger value="eid" className="gap-2">
            <Radio className="h-4 w-4" />
            EID Activity
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Draft Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-6">
          <FeedHeadPanel />
        </TabsContent>

        <TabsContent value="draft" className="space-y-6">
          <DraftGatePanel />
        </TabsContent>

        <TabsContent value="eid" className="space-y-6">
          <EidPanel />
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <DraftRuleInspectorPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};
