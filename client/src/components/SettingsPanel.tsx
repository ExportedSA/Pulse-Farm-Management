import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Settings } from "lucide-react";
import type { ReminderSettings } from "@shared/schema";

interface SettingsPanelProps {
  settings: ReminderSettings;
  onUpdate: (settings: ReminderSettings) => void;
  onEnableReminders: () => void;
}

export default function SettingsPanel({ settings, onUpdate, onEnableReminders }: SettingsPanelProps) {
  return (
    <Card data-testid="card-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Reminder Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Enable Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get notifications for expiring treatments
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  onEnableReminders();
                } else {
                  onUpdate({ ...settings, enabled: false });
                }
              }}
              data-testid="switch-enable-reminders"
            />
          </div>

          {settings.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="lead-expiry">Alert Before Expiry (days)</Label>
                <Input
                  id="lead-expiry"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.leadExpiryDays}
                  onChange={(e) =>
                    onUpdate({ ...settings, leadExpiryDays: parseInt(e.target.value, 10) || 7 })
                  }
                  data-testid="input-lead-expiry"
                />
                <p className="text-xs text-muted-foreground">
                  You'll be notified {settings.leadExpiryDays} days before expiry
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-useby">Alert Before Use-By (days)</Label>
                <Input
                  id="lead-useby"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.leadUseByDays}
                  onChange={(e) =>
                    onUpdate({ ...settings, leadUseByDays: parseInt(e.target.value, 10) || 7 })
                  }
                  data-testid="input-lead-useby"
                />
                <p className="text-xs text-muted-foreground">
                  You'll be notified {settings.leadUseByDays} days before use-by date
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary-hour">Daily Summary Hour</Label>
                <Input
                  id="summary-hour"
                  type="number"
                  min="0"
                  max="23"
                  value={settings.dailySummaryHour}
                  onChange={(e) =>
                    onUpdate({ ...settings, dailySummaryHour: parseInt(e.target.value, 10) || 7 })
                  }
                  data-testid="input-summary-hour"
                />
                <p className="text-xs text-muted-foreground">
                  Daily summary at {settings.dailySummaryHour}:00 (24-hour format)
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="treatment-buffer-hours">Treatment Alert Buffer (hours)</Label>
            <Input
              id="treatment-buffer-hours"
              type="number"
              min="0"
              max="12"
              step="0.5"
              value={settings.treatmentAlertBufferHours ?? 0.5}
              onChange={(e) =>
                onUpdate({ ...settings, treatmentAlertBufferHours: parseFloat(e.target.value) || 0.5 })
              }
              data-testid="input-treatment-buffer-hours"
            />
            <p className="text-xs text-muted-foreground">
              Alerts appear {settings.treatmentAlertBufferHours ?? 0.5} hours after treatment is due
            </p>
          </div>

          {!settings.enabled && (
            <Button onClick={onEnableReminders} className="w-full" data-testid="button-enable-reminders">
              <Bell className="w-4 h-4 mr-2" />
              Enable Notifications
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
