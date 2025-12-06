import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Eye, AlertCircle } from "lucide-react";
import type { AnimalTreatment, ReminderSettings } from "@shared/schema";
import { daysUntil } from "@/lib/utils";

type AlertsProps = {
  treatments: AnimalTreatment[];
  settings: ReminderSettings;
};

type AlertType = 'overdue' | 'stale-return' | 'exceeded-monitoring' | 'awaiting-too-long';

export default function Alerts({ treatments, settings }: AlertsProps) {
  const getCowIdentifier = (treatment: AnimalTreatment): string => {
    if (treatment.cowId) return `Cow ${treatment.cowId}`;
    if (treatment.birthId) {
      return `${treatment.birthId.participantCode}${treatment.birthId.year}-${treatment.birthId.number}`;
    }
    return "Unknown Cow";
  };

  const getAlertType = (treatment: AnimalTreatment): AlertType | null => {
    if (treatment.status !== 'active') return null;

    const now = new Date();
    const treatmentDate = new Date(treatment.dateTime);
    const hoursSince = (now.getTime() - treatmentDate.getTime()) / (1000 * 60 * 60);
    const daysSince = hoursSince / 24;

    // BLACK: Awaiting treatment for >2 days
    if (treatment.awaitingTreatment && daysSince > 2) {
      return 'awaiting-too-long';
    }

    // YELLOW: Exceeded monitoring period but not acted on
    if (treatment.monitoring && treatment.monitoringEndDate) {
      const daysLeft = daysUntil(treatment.monitoringEndDate);
      if (daysLeft !== undefined && daysLeft < 0) {
        return 'exceeded-monitoring';
      }
    }

    // GREEN: Return to vat for >48 hours
    const dosesGiven = treatment.dosesGiven || 0;
    const totalDoses = treatment.totalDoses || 1;
    const dosesComplete = dosesGiven >= totalDoses;
    
    if (dosesComplete && treatment.milkWithdrawalEndDate) {
      const withdrawalDays = daysUntil(treatment.milkWithdrawalEndDate);
      if (withdrawalDays !== undefined && withdrawalDays <= 0) {
        // Cow is in return-to-vat state
        const lastDoseDate = treatment.lastDoseDate ? new Date(treatment.lastDoseDate) : treatmentDate;
        const hoursSinceLastDose = (now.getTime() - lastDoseDate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastDose > 48) {
          return 'stale-return';
        }
      }
    }

    // RED: Past next treatment timeframe (for multi-dose treatments)
    if (!dosesComplete && treatment.lastDoseDate) {
      const lastDose = new Date(treatment.lastDoseDate);
      const hoursSinceLastDose = (now.getTime() - lastDose.getTime()) / (1000 * 60 * 60);
      
      // Consider overdue if >24 hours + buffer since last dose and more doses needed
      const bufferHours = settings.treatmentAlertBufferHours ?? 0;
      const overdueThreshold = 24 + bufferHours;
      if (hoursSinceLastDose > overdueThreshold) {
        return 'overdue';
      }
    }

    return null;
  };

  const alertCategories = {
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
  };

  const categorizedAlerts = {
    overdue: treatments.filter(t => getAlertType(t) === 'overdue'),
    'stale-return': treatments.filter(t => getAlertType(t) === 'stale-return'),
    'exceeded-monitoring': treatments.filter(t => getAlertType(t) === 'exceeded-monitoring'),
    'awaiting-too-long': treatments.filter(t => getAlertType(t) === 'awaiting-too-long'),
  };

  const totalAlerts = Object.values(categorizedAlerts).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-6 p-6" data-testid="page-alerts">
      <div className="flex items-center justify-end">
        <Link href="/app/treatments/current">
          <Button variant="outline" data-testid="button-view-all-treatments">
            View All Treatments
          </Button>
        </Link>
      </div>

      {totalAlerts === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground text-lg">
              No alerts at this time. All treatments are on schedule.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {Object.entries(alertCategories).map(([key, category]) => {
            const alerts = categorizedAlerts[key as AlertType];
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
                      <Icon className={`w-6 h-6 ${category.iconClass}`} />
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
                    {alerts.map((treatment) => (
                      <div
                        key={treatment.id}
                        className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                        data-testid={`alert-item-${treatment.id}`}
                      >
                        <div>
                          <p className="font-semibold">{getCowIdentifier(treatment)}</p>
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
