import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertTriangle, Clock, Eye, AlertCircle, Package, Pill, Droplet } from "lucide-react";
import type { AnimalTreatment, ReminderSettings } from "@shared/schema";
import { daysUntil } from "@/lib/utils";

export default function AlertsPage() {
  const { data: treatments = [] } = useQuery<AnimalTreatment[]>({
    queryKey: ["/api/treatments"],
  });

  const { data: settingsData } = useQuery<ReminderSettings>({
    queryKey: ["/api/settings/reminders"],
  });

  const { data: milkWithholdings = [] } = useQuery<any[]>({
    queryKey: ["/api/milk-withholdings/active"],
  });

  const { data: productBatches = [] } = useQuery<any[]>({
    queryKey: ["/api/product-batches"],
  });

  const { data: animals = [] } = useQuery<any[]>({
    queryKey: ["/api/animals"],
  });

  const settings: ReminderSettings = settingsData || {
    enabled: true,
    leadExpiryDays: 7,
    leadUseByDays: 3,
    dailySummaryHour: 8,
    treatmentAlertBufferHours: 2,
  };

  const getCowIdentifier = (cowId?: string | null, birthId?: any): string => {
    if (cowId) return `Cow ${cowId}`;
    if (birthId) {
      return `${birthId.participantCode}${birthId.year}-${birthId.number}`;
    }
    return "Unknown";
  };

  const getAlertType = (treatment: AnimalTreatment): string | null => {
    if (treatment.status !== 'active') return null;

    const now = new Date();
    const treatmentDate = new Date(treatment.dateTime);
    const hoursSince = (now.getTime() - treatmentDate.getTime()) / (1000 * 60 * 60);
    const daysSince = hoursSince / 24;

    if (treatment.awaitingTreatment && daysSince > 2) {
      return 'awaiting-too-long';
    }

    if (treatment.monitoring && treatment.monitoringEndDate) {
      const daysLeft = daysUntil(treatment.monitoringEndDate);
      if (daysLeft !== undefined && daysLeft < 0) {
        return 'exceeded-monitoring';
      }
    }

    const dosesGiven = treatment.dosesGiven || 0;
    const totalDoses = treatment.totalDoses || 1;
    const dosesComplete = dosesGiven >= totalDoses;
    
    if (dosesComplete && treatment.milkWithdrawalEndDate) {
      const withdrawalDays = daysUntil(treatment.milkWithdrawalEndDate);
      if (withdrawalDays !== undefined && withdrawalDays <= 0) {
        const lastDoseDate = treatment.lastDoseDate ? new Date(treatment.lastDoseDate) : treatmentDate;
        const hoursSinceLastDose = (now.getTime() - lastDoseDate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastDose > 48) {
          return 'stale-return';
        }
      }
    }

    if (!dosesComplete && treatment.lastDoseDate) {
      const lastDose = new Date(treatment.lastDoseDate);
      const hoursSinceLastDose = (now.getTime() - lastDose.getTime()) / (1000 * 60 * 60);
      
      const bufferHours = settings.treatmentAlertBufferHours ?? 0;
      const overdueThreshold = 24 + bufferHours;
      if (hoursSinceLastDose > overdueThreshold) {
        return 'overdue';
      }
    }

    return null;
  };

  const treatmentAlerts = {
    overdue: treatments.filter(t => getAlertType(t) === 'overdue'),
    'stale-return': treatments.filter(t => getAlertType(t) === 'stale-return'),
    'exceeded-monitoring': treatments.filter(t => getAlertType(t) === 'exceeded-monitoring'),
    'awaiting-too-long': treatments.filter(t => getAlertType(t) === 'awaiting-too-long'),
  };

  const activeMilkWithholdings = milkWithholdings.filter((w: any) => {
    const endDate = new Date(w.endDate);
    return endDate > new Date();
  });

  const expiringBatches = productBatches.filter((batch: any) => {
    if (batch.status !== 'open' || !batch.expiryDate) return false;
    const daysLeft = daysUntil(batch.expiryDate);
    return daysLeft !== undefined && daysLeft >= 0 && daysLeft <= 7;
  });

  const lowStockBatches = productBatches.filter((batch: any) => {
    return batch.status === 'open' && (batch.quantityRemaining || 0) < 10;
  });

  const totalAlerts = Object.values(treatmentAlerts).reduce((sum, arr) => sum + arr.length, 0)
    + activeMilkWithholdings.length
    + expiringBatches.length
    + lowStockBatches.length;

  return (
    <div className="space-y-6 p-6" data-testid="page-alerts">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="text-alerts-title">Alerts Dashboard</h1>
        <Badge variant="secondary" className="text-lg px-4 py-2" data-testid="badge-total-alerts">
          {totalAlerts} Total Alerts
        </Badge>
      </div>

      {totalAlerts === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground text-lg">
              No alerts at this time. Everything is running smoothly.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {activeMilkWithholdings.length > 0 && (
            <Card className="border-blue-600 border-2" data-testid="alert-category-milk-withholdings">
              <CardHeader className="bg-blue-100 dark:bg-blue-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Droplet className="w-6 h-6 text-blue-600" strokeWidth={1.5} />
                    <div>
                      <CardTitle>Active Milk Withholdings</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Animals currently in milk withdrawal period
                      </p>
                    </div>
                  </div>
                  <Badge className="text-blue-600 bg-white dark:bg-black text-lg px-3 py-1">
                    {activeMilkWithholdings.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {activeMilkWithholdings.map((withholding: any) => {
                    const animal = animals.find((a: any) => a.id === withholding.animalId);
                    const daysLeft = daysUntil(withholding.endDate);
                    return (
                      <div
                        key={withholding.id}
                        className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                        data-testid={`alert-item-${withholding.id}`}
                      >
                        <div>
                          <p className="font-semibold">{getCowIdentifier(animal?.cowId, animal?.birthId)}</p>
                          <p className="text-sm text-muted-foreground">
                            Ends: {new Date(withholding.endDate).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {daysLeft !== undefined && daysLeft >= 0 ? `${daysLeft} days remaining` : 'Ended'}
                          </p>
                        </div>
                        <Link href="/app/treatments/current">
                          <Button size="sm" variant="outline" data-testid={`button-view-${withholding.id}`}>
                            View
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {expiringBatches.length > 0 && (
            <Card className="border-orange-600 border-2" data-testid="alert-category-expiring-medicines">
              <CardHeader className="bg-orange-100 dark:bg-orange-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Pill className="w-6 h-6 text-orange-600" strokeWidth={1.5} />
                    <div>
                      <CardTitle>Expiring Medicines</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Medicines expiring within 7 days
                      </p>
                    </div>
                  </div>
                  <Badge className="text-orange-600 bg-white dark:bg-black text-lg px-3 py-1">
                    {expiringBatches.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {expiringBatches.map((batch: any) => {
                    const daysLeft = daysUntil(batch.expiryDate);
                    return (
                      <div
                        key={batch.id}
                        className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                        data-testid={`alert-item-${batch.id}`}
                      >
                        <div>
                          <p className="font-semibold">Batch {batch.batchNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            Expires: {new Date(batch.expiryDate).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {daysLeft !== undefined ? `${daysLeft} days remaining` : 'Expired'}
                          </p>
                        </div>
                        <Link href="/app/medicines">
                          <Button size="sm" variant="outline" data-testid={`button-view-${batch.id}`}>
                            View
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {lowStockBatches.length > 0 && (
            <Card className="border-purple-600 border-2" data-testid="alert-category-low-stock">
              <CardHeader className="bg-purple-100 dark:bg-purple-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="w-6 h-6 text-purple-600" strokeWidth={1.5} />
                    <div>
                      <CardTitle>Low Stock Warnings</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Medicine batches running low (&lt; 10 units)
                      </p>
                    </div>
                  </div>
                  <Badge className="text-purple-600 bg-white dark:bg-black text-lg px-3 py-1">
                    {lowStockBatches.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {lowStockBatches.map((batch: any) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                      data-testid={`alert-item-${batch.id}`}
                    >
                      <div>
                        <p className="font-semibold">Batch {batch.batchNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {batch.quantityRemaining || 0} units remaining
                        </p>
                      </div>
                      <Link href="/app/medicines">
                        <Button size="sm" variant="outline" data-testid={`button-view-${batch.id}`}>
                          View
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {Object.entries({
            overdue: {
              title: "Overdue Treatments",
              description: "Cows past their next treatment timeframe",
              icon: AlertTriangle,
              color: "red",
              bgClass: "bg-red-100 dark:bg-red-950",
              borderClass: "border-red-600",
              iconClass: "text-red-600",
            },
            'stale-return': {
              title: "Stale Return to Vat",
              description: "Cows ready for >48 hours with no action",
              icon: AlertCircle,
              color: "green",
              bgClass: "bg-green-100 dark:bg-green-950",
              borderClass: "border-green-600",
              iconClass: "text-green-600",
            },
            'exceeded-monitoring': {
              title: "Exceeded Monitoring",
              description: "Monitoring period ended, needs attention",
              icon: Eye,
              color: "yellow",
              bgClass: "bg-yellow-100 dark:bg-yellow-950",
              borderClass: "border-yellow-600",
              iconClass: "text-yellow-600",
            },
            'awaiting-too-long': {
              title: "Awaiting Treatment Too Long",
              description: "Waiting >2 days for treatment plan",
              icon: Clock,
              color: "gray",
              bgClass: "bg-gray-100 dark:bg-gray-950",
              borderClass: "border-gray-600",
              iconClass: "text-gray-600",
            },
          }).map(([key, category]) => {
            const alerts = treatmentAlerts[key as keyof typeof treatmentAlerts];
            if (alerts.length === 0) return null;

            const Icon = category.icon;

            return (
              <Card
                key={key}
                className={`${category.borderClass} border-2`}
                data-testid={`alert-category-${key}`}
              >
                <CardHeader className={category.bgClass}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-6 h-6 ${category.iconClass}`} strokeWidth={1.5} />
                      <div>
                        <CardTitle>{category.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={`${category.iconClass} bg-white dark:bg-black text-lg px-3 py-1`}
                      data-testid={`badge-count-${key}`}
                    >
                      {alerts.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {alerts.map((treatment: any) => (
                      <div
                        key={treatment.id}
                        className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                        data-testid={`alert-item-${treatment.id}`}
                      >
                        <div>
                          <p className="font-semibold">{getCowIdentifier(treatment.cowId, treatment.birthId)}</p>
                          <p className="text-sm text-muted-foreground">
                            {treatment.condition}
                            {treatment.bodyPart && ` • ${treatment.bodyPart}`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {treatment.treatmentType || treatment.treatmentPlan}
                          </p>
                        </div>
                        <Link href="/app/treatments/current">
                          <Button size="sm" variant="outline" data-testid={`button-view-${treatment.id}`}>
                            View
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
