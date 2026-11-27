// What's waiting on this phone to send (build guide F4), in the app's header. Mounting it also sends
// the queue whenever the connection comes back, for every form in the app (lib/outbox.ts).
import { CloudUpload, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOutbox, flushOutbox } from "@/lib/outbox";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function OutboxStatus() {
  const queryClient = useQueryClient();
  const { items, pending, problems, discard, retry } = useOutbox(synced => {
    // Lists on screen get the server's copies of what was just sent
    queryClient.invalidateQueries();
    toast.success(synced.length === 1 ? `${synced[0].label} sent` : `${synced.length} saved records sent`);
  });
  if (!items.length) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={problems.length ? "text-red-600 gap-1" : "text-amber-700 gap-1"}
          aria-label={`${items.length} waiting to send`}
          data-testid="button-outbox"
        >
          {problems.length ? <AlertTriangle className="h-4 w-4" /> : <CloudUpload className="h-4 w-4" />}
          <span className="text-xs font-medium">{items.length}</span>
          <span className="hidden md:inline text-xs">waiting to send</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b">
          <p className="font-medium text-sm">Saved on this device</p>
          <p className="text-xs text-muted-foreground">
            {pending.length
              ? `${pending.length} will send by themselves when there's signal, oldest first.`
              : "Nothing left to send."}
          </p>
        </div>
        <ul className="max-h-80 overflow-auto divide-y" data-testid="list-outbox">
          {items.map(i => (
            <li key={i.id} className="p-3 text-sm space-y-1">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{i.label}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{when(i.createdAt)}</span>
              </div>
              {i.state === "pending" ? (
                i.note && <p className="text-xs text-muted-foreground">{i.note}</p>
              ) : (
                <>
                  <p className="text-xs text-red-600">
                    {i.state === "conflict" ? "Someone changed this meanwhile: " : "Not saved: "}{i.error}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => retry(i.id)}>Try again</Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (window.confirm(`Throw away "${i.label}"? It hasn't reached Pulse and can't be got back.`)) discard(i.id);
                    }}>Throw away</Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        {pending.length > 0 && (
          <div className="p-3 border-t">
            <Button size="sm" className="w-full" onClick={() => void flushOutbox()} disabled={!navigator.onLine}>
              {navigator.onLine ? "Send now" : "No signal"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
