import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Stethoscope } from "lucide-react";
import type { Condition } from "@shared/schema";

interface ConditionManagementProps {
  conditions: Condition[];
}

/**
 * The diagnosis list: MINDA's (LIC) codes, names and groups, the same for every farm, so a health event
 * is recorded under the one name it has in MINDA (migration 0037). It's read only here.
 */
export default function ConditionManagement({ conditions }: ConditionManagementProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const shown = conditions.filter(c => !q || c.name.toLowerCase().includes(q) || c.code?.toLowerCase() === q);
    const map = new Map<string, Condition[]>();
    for (const c of shown) {
      const key = c.category ?? "Other";
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return Array.from(map.entries());
  }, [conditions, search]);

  return (
    <Card data-testid="card-condition-management">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5" />
          Diagnosis list
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Health events use MINDA's diagnosis list, with its codes and groups, so each one has the same name as in MINDA.
        </p>
        <Button variant="outline" onClick={() => setOpen(true)} data-testid="button-open-condition-management">
          <Stethoscope className="w-4 h-4 mr-2" />
          View the list ({conditions.length})
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Diagnosis list (MINDA)</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Search by name or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-conditions"
            />
            <div className="space-y-4">
              {groups.map(([group, items]) => (
                <div key={group} className="space-y-1">
                  <h4 className="text-sm font-medium">{group}</h4>
                  <ul className="divide-y rounded-md border">
                    {items.map(c => (
                      <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm" data-testid={`text-condition-name-${c.id}`}>
                        <span className="w-8 font-mono text-xs text-muted-foreground">{c.code}</span>
                        <span className="flex-1">{c.name}</span>
                        {c.requiresBodyPart && (
                          <span className="text-xs text-muted-foreground">{c.bodyPartType === 'udder' ? 'Quarters' : 'Feet'}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {groups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nothing matches that.</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)} data-testid="button-done-condition">Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
