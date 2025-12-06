import { Activity, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useHardwareHealth } from "../../hooks/useHardwareHealth";

export const SystemHealthBadge: React.FC = () => {
  const { data, loading, error } = useHardwareHealth();

  if (loading) {
    return (
      <Badge variant="secondary" className="gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Connecting...
      </Badge>
    );
  }

  if (error || !data?.ok) {
    return (
      <Badge variant="destructive" className="gap-2">
        <AlertCircle className="h-3 w-3" />
        Hardware Offline
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="gap-2">
      <CheckCircle2 className="h-3 w-3" />
      Hardware Online
    </Badge>
  );
};
