import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthShell, postJson } from "@/components/auth-shell";

// /reset-password/:token - Choose a new password from the emailed link
export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <AuthShell title="Password changed">
        <div className="flex flex-col items-center gap-3 text-center text-sm text-slate-600">
          <CheckCircle2 className="h-8 w-8 text-emerald-700" />
          <p>Your new password is set.</p>
          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" asChild><a href="/login">Sign in</a></Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      {failure && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{failure} {failure.includes("Ask for a new one") && <a className="underline" href="/forgot-password">Get a new link</a>}</AlertDescription>
        </Alert>
      )}
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault();
        if (password !== confirm) return setFailure("The two passwords don't match.");
        setFailure(null);
        setBusy(true);
        try { await postJson("/api/auth/reset-password", { token: params.token, password }); setDone(true); }
        catch (err: any) { setFailure(err.message); }
        finally { setBusy(false); }
      }}>
        <div className="space-y-1">
          <Label htmlFor="rp-password">New password</Label>
          <Input id="rp-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoFocus />
          <p className="text-xs text-slate-500">At least 8 characters.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="rp-confirm">Type it again</Label>
          <Input id="rp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} />
        </div>
        <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set new password"}
        </Button>
      </form>
    </AuthShell>
  );
}
