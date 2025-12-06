import { useState } from "react";
import { Search, GitBranch, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { previewDraftRules, DraftRulePreview } from "../../api/draftRuleClient";

export const DraftRuleInspectorPanel: React.FC = () => {
  const [eid, setEid] = useState("");
  const [preview, setPreview] = useState<DraftRulePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!eid.trim()) {
      setError("Enter an EID to inspect");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const result = await previewDraftRules(eid.trim());
      setPreview(result);
    } catch (e: any) {
      setError(e?.message ?? "Failed to preview rules");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Draft Rule Inspector
          </CardTitle>
          <CardDescription>
            Preview drafting decisions for specific animals based on current rules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="eid-input">Electronic ID (EID)</Label>
              <Input
                id="eid-input"
                value={eid}
                onChange={(e) => setEid(e.target.value)}
                placeholder="982123456789012"
                className="font-mono"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCheck}
                disabled={busy}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                {busy ? "Checking..." : "Preview"}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {preview && (
            <Card className="border-primary/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Draft Decision</CardTitle>
                  <Badge variant="default" className="text-sm">
                    {preview.direction.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">EID</p>
                    <p className="font-mono text-sm font-medium">{preview.eid}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Confidence Score</p>
                    <p className="text-sm font-medium">{preview.score}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Reasons
                  </p>
                  <ul className="space-y-2">
                    {preview.reasons.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
