import { useState } from "react";
import SettingsPanel from "../SettingsPanel";
import type { ReminderSettings } from "@shared/schema";

export default function SettingsPanelExample() {
  const [settings, setSettings] = useState<ReminderSettings>({
    enabled: false,
    leadExpiryDays: 7,
    leadUseByDays: 7,
    dailySummaryHour: 7,
  });

  return (
    <div className="p-8 max-w-2xl">
      <SettingsPanel
        settings={settings}
        onUpdate={(newSettings) => {
          console.log("Settings updated:", newSettings);
          setSettings(newSettings);
        }}
        onEnableReminders={() => {
          console.log("Enable reminders triggered");
          setSettings({ ...settings, enabled: true });
        }}
      />
    </div>
  );
}
