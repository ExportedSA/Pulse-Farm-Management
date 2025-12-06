import { Radio, Clock, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useEidRecent } from "../../hooks/useEidRecent";
import { formatDistanceToNow } from "date-fns";

export const EidPanel: React.FC = () => {
  const { data, loading, error } = useEidRecent(1000);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                EID Reader Activity
              </CardTitle>
              <CardDescription>
                Real-time electronic identification tag scans
              </CardDescription>
            </div>
            {!loading && data && data.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <Activity className="h-3 w-3" />
                {data.length} events
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          {!loading && (data ?? []).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Radio className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent tag scans</p>
              <p className="text-xs mt-1">Waiting for EID reader activity...</p>
            </div>
          )}

          {!loading && (data ?? []).length > 0 && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {(data ?? []).map((evt, idx) => (
                  <div
                    key={evt.timestamp + evt.eid}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Radio className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-mono text-sm font-medium">{evt.eid}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(evt.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {idx === 0 && (
                      <Badge variant="default" className="text-xs">Latest</Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
