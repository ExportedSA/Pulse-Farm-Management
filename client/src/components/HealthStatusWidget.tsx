import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Activity, Database } from "lucide-react";

type HealthResult = {
  ok: boolean;
  status: number;
  ms: number;
  data?: any;
  error?: string;
};

type WidgetState = {
  loading: boolean;
  api?: HealthResult;
  db?: HealthResult;
  lastUpdated?: string;
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHealth(url: string, attempts: number): Promise<HealthResult> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    const start = performance.now();
    try {
      const res = await fetch(url, { credentials: "include" });
      const ms = Math.round(performance.now() - start);

      let data: any = undefined;
      try {
        data = await res.json();
      } catch {
        data = undefined;
      }

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          ms,
          data,
          error: data?.error || data?.message || `HTTP ${res.status}`,
        };
      }

      return {
        ok: true,
        status: res.status,
        ms,
        data,
      };
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) {
        await sleep(250);
        continue;
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : "Network error";
  return { ok: false, status: 0, ms: 0, error: msg };
}

export function HealthStatusWidget() {
  const [state, setState] = useState<WidgetState>({ loading: false });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));

    const [api, db] = await Promise.all([
      fetchHealth("/api/health", 2),
      fetchHealth("/api/health/db", 2),
    ]);

    setState({
      loading: false,
      api,
      db,
      lastUpdated: new Date().toLocaleString(),
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const overallOk = useMemo(() => {
    if (!state.api && !state.db) return undefined;
    return Boolean(state.api?.ok && state.db?.ok);
  }, [state.api, state.db]);

  const statusBadge = (r?: HealthResult) => {
    if (!r) return <Badge variant="secondary">Unknown</Badge>;
    if (r.ok) return <Badge className="bg-emerald-600">OK</Badge>;
    return <Badge variant="destructive">Down</Badge>;
  };

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">System Health</span>
                {overallOk === undefined ? (
                  <Badge variant="outline">Not checked</Badge>
                ) : overallOk ? (
                  <Badge className="bg-emerald-600">Healthy</Badge>
                ) : (
                  <Badge variant="destructive">Issues</Badge>
                )}
              </div>
              {state.lastUpdated && (
                <div className="text-xs text-muted-foreground">Last updated: {state.lastUpdated}</div>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={state.loading}
            className="gap-2"
          >
            <RefreshCw className={state.loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">API</span>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge(state.api)}
              {state.api && <span className="text-xs text-muted-foreground">{state.api.ms}ms</span>}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">DB</span>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge(state.db)}
              {state.db && <span className="text-xs text-muted-foreground">{state.db.ms}ms</span>}
            </div>
          </div>
        </div>

        {(state.api?.error || state.db?.error) && (
          <div className="mt-3 text-xs text-destructive">
            {state.api?.error ? `API: ${state.api.error}` : null}
            {state.api?.error && state.db?.error ? " | " : null}
            {state.db?.error ? `DB: ${state.db.error}` : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
