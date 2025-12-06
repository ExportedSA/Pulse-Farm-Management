import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, Clock } from "lucide-react";
import { daysUntil, addDays } from "@/lib/utils";
import type { RecordItem, Product, ReminderSettings } from "@shared/schema";

interface AlertsListProps {
  records: RecordItem[];
  products: Product[];
  settings: ReminderSettings;
}

export default function AlertsList({ records, products, settings }: AlertsListProps) {
  const alerts: { kind: "expiry" | "useby" | "withhold"; r: RecordItem; msg: string }[] = [];

  for (const r of records) {
    if (r.emptiedDate) continue;
    const expIn = daysUntil(r.expiryDate);
    const useIn = daysUntil(r.useByDate);
    const product = products.find((p) => p.name === r.productName);
    const wd = product?.withdrawalDays ?? 0;
    const withholdUntil = wd && r.dateOpened ? addDays(r.dateOpened.slice(0, 10), wd) : undefined;
    const withholdDays = withholdUntil ? daysUntil(withholdUntil) : undefined;

    if (expIn !== undefined && expIn <= settings.leadExpiryDays) {
      alerts.push({
        kind: "expiry",
        r,
        msg: `${r.productName} (batch ${r.batchNo}) expires in ${expIn} day(s)`,
      });
    }
    if (useIn !== undefined && useIn <= settings.leadUseByDays) {
      alerts.push({
        kind: "useby",
        r,
        msg: `${r.productName} (batch ${r.batchNo}) use-by in ${useIn} day(s)`,
      });
    }
    if (withholdDays !== undefined && withholdDays >= 0) {
      alerts.push({
        kind: "withhold",
        r,
        msg: `${r.productName} withholding in effect until ${withholdUntil}`,
      });
    }
  }

  const getIcon = (kind: string) => {
    switch (kind) {
      case "expiry":
      case "useby":
        return <AlertTriangle className="w-4 h-4" />;
      case "withhold":
        return <Clock className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getVariant = (kind: string) => {
    switch (kind) {
      case "expiry":
      case "useby":
        return "destructive" as const;
      case "withhold":
        return "default" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <Card data-testid="card-alerts">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Active Alerts ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No active alerts</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={`${alert.r.id}-${alert.kind}-${idx}`}
                className="flex items-start gap-3 p-3 border rounded-lg hover-elevate"
                data-testid={`alert-${idx}`}
              >
                <Badge variant={getVariant(alert.kind)} className="mt-0.5">
                  {getIcon(alert.kind)}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm" data-testid={`alert-msg-${idx}`}>{alert.msg}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
