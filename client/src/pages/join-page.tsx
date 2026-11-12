import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthShell, postJson } from "@/components/auth-shell";

// /join/:token - Someone opens the link from their invite email. New to Pulse: they give their
// name and choose a password. Already on Pulse: they confirm with their password. Either way
// they land in the farm they were invited to.

interface InviteInfo {
  farmName: string;
  inviterName?: string;
  email: string;
  role: string;
  hasAccount: boolean;
  signedInAsInvitee: boolean;
}

const ROLE_WORDS: Record<string, string> = { owner: "an owner", manager: "a manager", worker: "a worker", viewer: "a viewer", contractor: "a contractor" };

export default function JoinPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const { data: invite, error, isLoading } = useQuery<InviteInfo>({
    queryKey: ["/api/auth/invite", token],
    queryFn: async () => {
      const res = await fetch(`/api/auth/invite/${encodeURIComponent(token)}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "This invite link isn't valid.");
      return body;
    },
    retry: false,
  });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return <AuthShell title="Join a farm"><div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div></AuthShell>;
  }
  if (error || !invite) {
    return (
      <AuthShell title="Join a farm">
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{(error as Error)?.message}</AlertDescription></Alert>
        <Button variant="outline" className="w-full mt-4" asChild><a href="/login">Go to sign in</a></Button>
      </AuthShell>
    );
  }

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailure(null);
    setBusy(true);
    try {
      await postJson(`/api/auth/invite/${encodeURIComponent(token)}/accept`, invite.hasAccount ? { password } : { name, password });
      // A full load, so nothing cached from before signing in carries over
      window.location.assign("/");
    } catch (err: any) {
      setFailure(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={`Join ${invite.farmName}`}
      description={`${invite.inviterName ? `${invite.inviterName} invited you` : "You've been invited"} to join as ${ROLE_WORDS[invite.role] ?? invite.role}.`}
    >
      {failure && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{failure}</AlertDescription></Alert>}
      <form className="space-y-4" onSubmit={join}>
        <div className="space-y-1">
          <Label htmlFor="join-email">Email</Label>
          <Input id="join-email" value={invite.email} readOnly disabled />
        </div>
        {invite.signedInAsInvitee ? (
          <p className="text-sm text-slate-600">You're signed in as {invite.email}.</p>
        ) : invite.hasAccount ? (
          <div className="space-y-1">
            <Label htmlFor="join-password">Your Pulse password</Label>
            <Input id="join-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
            <p className="text-xs text-slate-500">This email already has a Pulse sign-in. <a className="underline" href="/forgot-password">Forgot your password?</a></p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor="join-name">Your name</Label>
              <Input id="join-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required minLength={2} autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="join-password">Choose a password</Label>
              <Input id="join-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
              <p className="text-xs text-slate-500">At least 8 characters.</p>
            </div>
          </>
        )}
        <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Join ${invite.farmName}`}
        </Button>
      </form>
    </AuthShell>
  );
}
