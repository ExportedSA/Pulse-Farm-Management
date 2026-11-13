import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

// A strip under the header when the farm is read-only, or its free trial ends within a week
export interface BillingInfo {
  state: "trial" | "active" | "read_only";
  enabled: boolean;
  trialEndsAt: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
  onboardingFeePaidAt: string | null;
  areaHa: number | null;
  feeBand: "small" | "medium" | "large" | null;
  onboardingFeeCents: number | null;
  cows: number;
  perCowYearCents: number;
  perCowMonthCents: number;
  monthlyCents: number;
  gstRate: number;
  canManage: boolean;
}

export const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

export function BillingBanner() {
  const [location] = useLocation();
  const { data } = useQuery<BillingInfo>({ queryKey: ["/api/billing"], staleTime: 5 * 60 * 1000, retry: false });
  if (!data?.enabled || location === "/app/billing") return null;
  const left = daysLeft(data.trialEndsAt);
  if (data.state === "read_only") {
    return (
      <div role="alert" className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-900">
        This farm's free trial or subscription has ended, so it's read-only. Nothing has been deleted.{" "}
        <a className="underline font-medium" href="/app/billing">{data.canManage ? "Subscribe to keep recording" : "See billing"}</a>
      </div>
    );
  }
  if (data.state === "trial" && left <= 7) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900">
        {left === 0 ? "Your free trial ends today." : `Your free trial ends in ${left} day${left === 1 ? "" : "s"}.`}{" "}
        <a className="underline font-medium" href="/app/billing">{data.canManage ? "Subscribe" : "See billing"}</a>
      </div>
    );
  }
  return null;
}
