import { useState } from "react";
import { GitBranch, ArrowLeft, ArrowUp, ArrowRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sendDraft, DraftDirection } from "../../api/hardwareClient";

export const DraftGatePanel: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [lastDirection, setLastDirection] = useState<DraftDirection | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const handleDraft = async (direction: DraftDirection) => {
    try {
      setBusy(true);
      setError(null);
      await sendDraft(direction);
      setLastDirection(direction);
    } catch (e: any) {
      setError(e?.message ?? "Draft command failed");
    } finally {
      setBusy(false);
    }
  };

  const getDirectionIcon = (direction: DraftDirection) => {
    switch (direction) {
      case "left":
        return <ArrowLeft className="h-5 w-5" />;
      case "straight":
        return <ArrowUp className="h-5 w-5" />;
      case "right":
        return <ArrowRight className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Manual Draft Control
          </CardTitle>
          <CardDescription>
            Override automatic drafting rules and manually direct animals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              disabled={busy}
              onClick={() => handleDraft("left")}
              variant="outline"
              className="h-24 flex-col gap-2"
            >
              <ArrowLeft className="h-8 w-8" />
              <span>Draft Left</span>
            </Button>
            <Button
              disabled={busy}
              onClick={() => handleDraft("straight")}
              variant="outline"
              className="h-24 flex-col gap-2"
            >
              <ArrowUp className="h-8 w-8" />
              <span>Draft Straight</span>
            </Button>
            <Button
              disabled={busy}
              onClick={() => handleDraft("right")}
              variant="outline"
              className="h-24 flex-col gap-2"
            >
              <ArrowRight className="h-8 w-8" />
              <span>Draft Right</span>
            </Button>
          </div>

          {lastDirection && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Last command:</span>
              <Badge variant="outline" className="gap-1">
                {getDirectionIcon(lastDirection)}
                {lastDirection.toUpperCase()}
              </Badge>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
