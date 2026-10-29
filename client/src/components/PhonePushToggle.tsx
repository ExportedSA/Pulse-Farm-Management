import { useEffect, useState } from "react";
import { BellRing, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { disablePush, enablePush, getPushState, needsHomeScreen, type PushState } from "@/lib/push";

const HELP: Partial<Record<PushState, string>> = {
  unsupported: "This browser can't show phone notifications.",
  "not-set-up": "Phone notifications aren't set up on the server yet.",
  blocked: "Notifications are blocked for Pulse. Allow them in your browser or phone settings, then come back.",
};

function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);
  return [state, setState] as const;
}

/**
 * Switch for this device's phone notifications (notification settings)
 */
export function PhonePushToggle() {
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);
  const homeScreen = needsHomeScreen();

  const change = async (on: boolean) => {
    setBusy(true);
    try {
      const next = on ? await enablePush() : await disablePush();
      setState(next);
      if (on && next === "on") toast.success("Phone notifications are on for this device");
      else if (on && HELP[next]) toast.error(HELP[next]!);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className={cn("h-4 w-4", state === "on" ? "text-green-600" : "text-gray-400")} />
          <span className="text-sm">Phone notifications on this device</span>
        </div>
        <Switch checked={state === "on"} disabled={busy || state === null || (state !== "on" && state !== "off")}
          onCheckedChange={change} aria-label="Phone notifications on this device" />
      </div>
      <p className="text-xs text-muted-foreground">
        {homeScreen
          ? "On iPhone, first add Pulse to your home screen (Share, then Add to Home Screen) and open it from there."
          : state && HELP[state]
            ? HELP[state]
            : "New jobs and alerts pop up on this phone, even when Pulse is closed."}
      </p>
    </div>
  );
}

/**
 * One-line prompt for people who haven't turned phone notifications on yet
 */
export function PhonePushPrompt({ className }: { className?: string }) {
  const [state, setState] = usePushState();
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem("pulse-push-prompt-dismissed") === "1"; } catch { return false; }
  });
  if (hidden || state !== "off") return null;
  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem("pulse-push-prompt-dismissed", "1"); } catch { /* private mode */ }
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-md border bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm", className)}>
      <BellRing className="h-4 w-4 text-amber-700" />
      <span className="flex-1">
        {needsHomeScreen() ? "Add Pulse to your home screen to get new jobs on your phone." : "Get new jobs on your phone, even when Pulse is closed."}
      </span>
      {!needsHomeScreen() && (
        <Button size="sm" onClick={async () => {
          try {
            const next = await enablePush();
            setState(next);
            if (next === "on") toast.success("Phone notifications are on");
            else if (HELP[next]) toast.error(HELP[next]!);
          } catch (e: any) {
            toast.error(e.message);
          }
        }}>Turn on</Button>
      )}
      <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
    </div>
  );
}
