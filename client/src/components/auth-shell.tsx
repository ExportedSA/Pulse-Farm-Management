import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// The centred card used by the screens shown before signing in (sign in, sign up, join a farm,
// password reset), with links to the draft privacy policy and terms underneath.
export function AuthShell({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-gradient-to-br from-slate-50 to-slate-100 login-background">
      <Card className="w-full max-w-md bg-white shadow-xl border border-slate-200">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold text-emerald-900">{title}</CardTitle>
          {description && <CardDescription className="text-slate-600">{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <p className="text-xs text-slate-500">
        <a className="underline" href="/privacy">Privacy</a> · <a className="underline" href="/terms">Terms</a>
      </p>
    </div>
  );
}

/** POST JSON and return the body, throwing the server's error message when it fails */
export async function postJson<T = any>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (res.status === 429) throw new Error("Too many attempts. Wait a minute and try again.");
  if (!res.ok) throw new Error(out.error ?? out.message ?? "Something went wrong. Please try again.");
  return out;
}
