import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Trash2, AlertTriangle, Bell, Clock } from "lucide-react";
import { getStatusBadge } from "@/lib/utils";
import type { RecordItem, Product } from "@shared/schema";

interface StockListProps {
  records: RecordItem[];
  products: Product[];
  onMarkEmptied: (id: string) => void;
  onRemove: (id: string) => void;
  leadExpiryDays?: number;
  leadUseByDays?: number;
}

export default function StockList({
  records,
  products,
  onMarkEmptied,
  onRemove,
  leadExpiryDays = 7,
  leadUseByDays = 7,
}: StockListProps) {
  const getIcon = (icon: string) => {
    switch (icon) {
      case "alert":
        return <AlertTriangle className="w-3 h-3" />;
      case "bell":
        return <Bell className="w-3 h-3" />;
      case "clock":
        return <Clock className="w-3 h-3" />;
      case "check":
        return <CheckCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  if (records.length === 0) {
    return (
      <Card data-testid="card-empty-state">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-muted-foreground mb-2">No records found</div>
          <p className="text-sm text-muted-foreground">Add a treatment record to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="list-stock-records">
      {records.map((record) => {
        const status = getStatusBadge(record, products, leadExpiryDays, leadUseByDays);
        const formatDate = (isoStr: string) => new Date(isoStr).toLocaleDateString();

        return (
          <Card key={record.id} className="hover-elevate" data-testid={`card-record-${record.id}`}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-base" data-testid={`text-product-${record.id}`}>
                        {record.productName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">Batch:</span>
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded" data-testid={`text-batch-${record.id}`}>
                          {record.batchNo}
                        </code>
                        <Badge variant={status.variant} className="gap-1" data-testid={`badge-status-${record.id}`}>
                          {getIcon(status.icon)}
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {record.expiryDate && (
                      <div>
                        <span className="text-muted-foreground">Expiry:</span>{" "}
                        <span className="font-medium" data-testid={`text-expiry-${record.id}`}>{record.expiryDate}</span>
                      </div>
                    )}
                    {record.useByDate && (
                      <div>
                        <span className="text-muted-foreground">Use-by:</span>{" "}
                        <span className="font-medium" data-testid={`text-useby-${record.id}`}>{record.useByDate}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Opened:</span>{" "}
                      <span className="font-medium" data-testid={`text-opened-${record.id}`}>{formatDate(record.dateOpened)}</span>
                    </div>
                    {record.openedBy && (
                      <div>
                        <span className="text-muted-foreground">By:</span>{" "}
                        <span className="font-medium" data-testid={`text-openedby-${record.id}`}>{record.openedBy}</span>
                      </div>
                    )}
                  </div>

                  {record.notes && (
                    <p className="text-xs text-muted-foreground italic" data-testid={`text-notes-${record.id}`}>
                      {record.notes}
                    </p>
                  )}
                </div>

                <div className="flex md:flex-col gap-2">
                  {!record.emptiedDate && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onMarkEmptied(record.id)}
                      data-testid={`button-mark-emptied-${record.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Mark Emptied
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRemove(record.id)}
                    data-testid={`button-delete-${record.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
