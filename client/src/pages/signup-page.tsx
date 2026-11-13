import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthShell, postJson } from "@/components/auth-shell";

// /signup - A new farm signs up: its owner's sign-in and the farm's name. The free trial starts
// now (no card) and the setup wizard opens. Staff join later by invite.
export default function SignupPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", farmName: "" });
  const [agreed, setAgreed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthShell title="Start your farm on Pulse" description="30 days free. No card needed to start.">
      {failure && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{failure}</AlertDescription></Alert>}
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault();
        if (!agreed) return setFailure("Please agree to the terms and privacy policy to continue.");
        setFailure(null);
        setBusy(true);
        try {
          await postJson("/api/auth/register", {
            name: form.name.trim(), email: form.email.trim(), password: form.password, farmName: form.farmName.trim(), acceptTerms: true,
          });
          window.location.assign("/app/setup");
        } catch (err: any) {
          setFailure(err.message === "User already exists" ? "That email already has a Pulse sign-in. Sign in instead." : err.message);
          setBusy(false);
        }
      }}>
        <div className="space-y-1">
          <Label htmlFor="su-farm">Farm name</Label>
          <Input id="su-farm" value={form.farmName} onChange={set("farmName")} required autoFocus />
        </div>
        <div className="space-y-1">
          <Label htmlFor="su-name">Your name</Label>
          <Input id="su-name" autoComplete="name" value={form.name} onChange={set("name")} required minLength={2} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="su-email">Email</Label>
          <Input id="su-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="su-password">Password</Label>
          <Input id="su-password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required minLength={8} />
          <p className="text-xs text-slate-500">At least 8 characters.</p>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" className="mt-1" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
          <span>I agree to the <a className="underline" href="/terms" target="_blank" rel="noreferrer">terms</a> and the <a className="underline" href="/privacy" target="_blank" rel="noreferrer">privacy policy</a>.</span>
        </label>
        <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create farm"}
        </Button>
        <p className="text-center text-sm text-slate-600">Already on Pulse? <a className="underline" href="/login">Sign in</a></p>
      </form>
    </AuthShell>
  );
}
