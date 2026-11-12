import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { daysLeft, type BillingInfo } from "@/components/billing-banner";

// /app/billing - Where the farm's trial or subscription stands, what it pays, and (for the
// owner) subscribing through Stripe Checkout or managing billing in Stripe's portal.

const money = (cents: number) => (cents / 100).toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
const date = (iso: string) => new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
const BAND_LABEL = { small: "under 300 ha", medium: "300 to 500 ha", large: "over 500 ha" };

async function post(url: string): Promise<string> {
  const res = await fetch(url, { method: "POST", credentials: "include" });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error ?? "Something went wrong");
  return out.url;
}

export default function BillingPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<BillingInfo>({ queryKey: ["/api/billing"] });
  const [busy, setBusy] = useState(false);

  // Back from Stripe Checkout
  useEffect(() => {
    const done = new URLSearchParams(window.location.search).get("checkout");
    if (done === "done") toast.success("Thanks. Your subscription is being set up; this page updates once Stripe confirms it.");
    if (done) {
      window.history.replaceState(null, "", "/app/billing");
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
    }
  }, [queryClient]);

  if (isLoading || !data) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const go = async (url: string) => {
    setBusy(true);
    try { window.location.assign(await post(url)); }
    catch (err: any) { toast.error(err.message); setBusy(false); }
  };
  const gst = (cents: number) => Math.round(cents * data.gstRate);
  const subscribed = data.state === "active";

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg"><CreditCard className="h-6 w-6 text-emerald-700" /></div>
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-sm text-muted-foreground">Your farm's subscription to Pulse</p>
        </div>
      </div>

      {!data.enabled && (
        <Card className="p-4 text-sm border-dashed">
          Billing isn't switched on for this server yet (no Stripe key), so nothing is charged and no farm becomes read-only.
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {data.state === "trial" && <><Badge className="bg-amber-500">Free trial</Badge> {daysLeft(data.trialEndsAt)} days left</>}
            {data.state === "active" && <><Badge className="bg-emerald-700">Subscribed</Badge>{data.subscriptionStatus === "past_due" && <Badge variant="destructive">Payment overdue</Badge>}</>}
            {data.state === "read_only" && <Badge variant="destructive">Read-only</Badge>}
          </CardTitle>
          <CardDescription>
            {data.state === "trial" && `Your free trial runs until ${date(data.trialEndsAt)}. Subscribe any time: the monthly fee starts when the trial ends (in the trial's last two days, it starts straight away).`}
            {data.state === "active" && (data.currentPeriodEnd ? `Next billing date: ${date(data.currentPeriodEnd)}.` : "Your subscription is active.")}
            {data.state === "read_only" && "Your free trial or subscription has ended. Everything is still here and can be seen and downloaded, but nothing new can be recorded until the farm subscribes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <tr>
                <td className="py-2 pr-2">
                  <div className="font-medium">Onboarding fee (one-off)</div>
                  <div className="text-muted-foreground">
                    {data.feeBand ? `For a farm of ${BAND_LABEL[data.feeBand]} (you gave ${data.areaHa} ha)` : <>Set by the farm's area. <a className="underline" href="/app/setup">Enter the farm's area</a> to see it.</>}
                    {data.onboardingFeePaidAt && " · Paid"}
                  </div>
                </td>
                <td className="py-2 text-right whitespace-nowrap align-top">
                  {data.onboardingFeeCents != null ? <>{money(data.onboardingFeeCents)} + GST<div className="text-xs text-muted-foreground">{money(data.onboardingFeeCents + gst(data.onboardingFeeCents))} incl. GST</div></> : "—"}
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-2">
                  <div className="font-medium">Monthly</div>
                  <div className="text-muted-foreground">
                    {money(data.perCowYearCents)} per cow per year, billed monthly ({money(data.perCowMonthCents)} per cow). {data.cows} cow{data.cows === 1 ? "" : "s"} in your animal register now (active females).
                  </div>
                </td>
                <td className="py-2 text-right whitespace-nowrap align-top">
                  {money(data.monthlyCents)} + GST<div className="text-xs text-muted-foreground">{money(data.monthlyCents + gst(data.monthlyCents))} incl. GST</div>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">
            The monthly fee follows your herd: each month is charged on the cows in your register at the billing date. GST is 15%. Invoices are under Manage billing once you've subscribed.
          </p>

          {data.canManage ? (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {!subscribed && <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={busy || !data.enabled} onClick={() => go("/api/billing/checkout")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}</Button>}
              {data.hasCustomer && <Button variant="outline" disabled={busy || !data.enabled} onClick={() => go("/api/billing/portal")}>Manage billing (card, invoices, cancel)</Button>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground border-t pt-4">Only the farm's owner can subscribe or change billing.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
