import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AreaDrawer } from "@/components/records/AreaDrawer";
import { areaHectares, type AreaGeometry } from "@shared/geo";
import { fetchPaddockMap, PADDOCK_MAP_KEY, savePaddockOutline } from "@/lib/paddock-map";

interface Props {
  paddock: { id: string; name: string; area?: number | null } | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Trace a paddock's fence line on the satellite map. Other paddocks already drawn show faintly.
 */
export function PaddockOutlineDialog({ paddock, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { data: map } = useQuery({ queryKey: PADDOCK_MAP_KEY, queryFn: fetchPaddockMap, enabled: !!paddock });
  const [area, setArea] = useState<AreaGeometry | null>(null);
  const [useDrawnArea, setUseDrawnArea] = useState(false);
  const [saving, setSaving] = useState(false);

  const existing = map?.features.find(f => f.id === paddock?.id)?.geometry ?? null;
  const others = useMemo(
    () => (map?.features ?? []).filter(f => f.id !== paddock?.id).map(f => ({ geometry: f.geometry, label: f.properties.name })),
    [map, paddock?.id],
  );

  useEffect(() => {
    setArea(null);
    setUseDrawnArea(!paddock?.area);
  }, [paddock?.id, paddock?.area]);

  const save = async (value: AreaGeometry | null) => {
    if (!paddock) return;
    setSaving(true);
    try {
      const saved = await savePaddockOutline(paddock.id, value, value != null && useDrawnArea);
      toast.success(value ? `${paddock.name} mapped (${saved.drawnHa} ha)` : `${paddock.name} outline removed`);
      queryClient.invalidateQueries({ queryKey: PADDOCK_MAP_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/pastures"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const drawnHa = area ? areaHectares(area) : null;
  return (
    <Dialog open={!!paddock} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Map {paddock?.name}</DialogTitle>
          <DialogDescription>
            Tap each corner of the paddock along the fence line. Paddocks you've already drawn show as dashed outlines.
          </DialogDescription>
        </DialogHeader>
        {paddock && map && (
          <AreaDrawer key={paddock.id} value={existing} onChange={setArea} background={others} color="#f59f00" />
        )}
        {drawnHa != null && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={useDrawnArea} onCheckedChange={v => setUseDrawnArea(v === true)} />
            Use the drawn {drawnHa} ha as the paddock's area{paddock?.area ? ` (now ${paddock.area} ha)` : ""}
          </label>
        )}
        <DialogFooter className="gap-2">
          {existing && (
            <Button variant="ghost" className="mr-auto text-red-700" disabled={saving} onClick={() => save(null)}>Remove outline</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" disabled={saving || !area} onClick={() => save(area)}>
            {saving ? "Saving…" : "Save outline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
