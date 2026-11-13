import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Invite people to a farm by email, and see, resend or withdraw invites not used yet. Used on
// the farms page and in the setup wizard. Owners and managers only (the server checks).

interface Invite { id: string; email: string; role: string; expiresAt: string; lastSentAt: string; expired: boolean }

export const ROLE_LABEL: Record<string, string> = { owner: "Owner", manager: "Manager", worker: "Worker", viewer: "Viewer", contractor: "Contractor" };

async function call(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error ?? "Request failed");
  return out;
}

function sentMessage(out: { emailSent?: boolean; emailError?: string }, email: string) {
  if (out.emailSent) toast.success(`Invite sent to ${email}`);
  else toast.error(`Invite saved, but the email didn't go: ${out.emailError ?? "unknown error"}`);
}

export function InviteStaff({ farmId, isOwner }: { farmId: string; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const key = ["/api/farms", farmId, "invites"];
  const { data: invites = [] } = useQuery<Invite[]>({
    queryKey: key,
    queryFn: async () => (await call("GET", `/api/farms/${farmId}/invites`)).data,
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("worker");
  const [busy, setBusy] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  return (
    <div className="space-y-3">
      <form className="flex flex-wrap items-end gap-2" onSubmit={async e => {
        e.preventDefault();
        if (!email.trim()) return;
        setBusy(true);
        try {
          const out = await call("POST", `/api/farms/${farmId}/invites`, { email: email.trim(), role });
          sentMessage(out, email.trim());
          setEmail("");
          refresh();
        } catch (err: any) { toast.error(err.message); }
        finally { setBusy(false); }
      }}>
        <div className="space-y-1 grow min-w-[12rem]">
          <Label htmlFor={`inv-email-${farmId}`}>Invite someone by email</Label>
          <Input id={`inv-email-${farmId}`} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="their email" />
        </div>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={role} onChange={e => setRole(e.target.value)} aria-label="Role">
          {["manager", "worker", "viewer", "contractor", ...(isOwner ? ["owner"] : [])].map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <Button type="submit" variant="outline" disabled={busy}><Mail className="h-4 w-4 mr-1" />Send invite</Button>
      </form>
      <p className="text-xs text-muted-foreground">They get a link that works for 7 days. New to Pulse, they set a password; already on Pulse, they sign in.</p>
      {invites.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-1">Waiting to join</p>
          <ul className="divide-y rounded-md border text-sm">
            {invites.map(inv => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>{inv.email}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{ROLE_LABEL[inv.role] ?? inv.role}</Badge>
                  {inv.expired
                    ? <Badge variant="destructive">Expired</Badge>
                    : <span className="text-xs text-muted-foreground">until {new Date(inv.expiresAt).toLocaleDateString("en-NZ")}</span>}
                  {(inv.role !== "owner" || isOwner) && (
                    <>
                      <Button size="sm" variant="ghost" title="Send again with a new link" onClick={() =>
                        call("POST", `/api/farms/${farmId}/invites/${inv.id}/resend`).then(out => { sentMessage(out, inv.email); refresh(); }, err => toast.error(err.message))
                      }><RotateCw className="h-4 w-4" /><span className="sr-only">Resend</span></Button>
                      <Button size="sm" variant="ghost" className="text-red-700" title="Withdraw the invite" onClick={() =>
                        window.confirm(`Withdraw the invite to ${inv.email}? Their link will stop working.`) &&
                        call("DELETE", `/api/farms/${farmId}/invites/${inv.id}`).then(() => { toast.success("Invite withdrawn"); refresh(); }, err => toast.error(err.message))
                      }><X className="h-4 w-4" /><span className="sr-only">Withdraw</span></Button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
