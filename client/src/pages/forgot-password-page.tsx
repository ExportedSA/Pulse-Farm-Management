import { useState } from "react";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthShell, postJson } from "@/components/auth-shell";

// /forgot-password - Ask for a reset link by email. The answer is the same whether or not the
// email has an account.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (sent) {
    return (
      <AuthShell title="Check your email">
        <div className="flex flex-col items-center gap-3 text-center text-sm text-slate-600">
          <MailCheck className="h-8 w-8 text-emerald-700" />
          <p>If {email} has a Pulse sign-in, we've sent it a link to choose a new password. The link works for an hour.</p>
          <a className="underline" href="/login">Back to sign in</a>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" description="We'll email you a link to choose a new one.">
      {failure && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{failure}</AlertDescription></Alert>}
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault();
        setFailure(null);
        setBusy(true);
        try { await postJson("/api/auth/forgot-password", { email: email.trim() }); setSent(true); }
        catch (err: any) { setFailure(err.message); }
        finally { setBusy(false); }
      }}>
        <div className="space-y-1">
          <Label htmlFor="fp-email">Email</Label>
          <Input id="fp-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        </div>
        <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Email me a link"}
        </Button>
        <p className="text-center text-sm"><a className="underline text-slate-600" href="/login">Back to sign in</a></p>
      </form>
    </AuthShell>
  );
}
