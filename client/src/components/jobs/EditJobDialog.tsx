import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface EditableJob {
  id: string;
  title: string;
  description: string;
  location: string;
  pastureId?: string | null;
  assignedTo: string[];
  priority: string;
  category: string;
  startDate: string;
  startTime: string;
  endDate?: string | null;
}

interface Props {
  job: EditableJob | null;
  people: { id: string; name: string }[];
  paddocks: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  onSaved: (job: any) => void;
}

const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const CATEGORIES = [["general", "General"], ["feeding", "Feeding"], ["health", "Health check"], ["maintenance", "Maintenance"], ["breeding", "Breeding"], ["milking", "Milking"]];

/**
 * Change a job after it's been set: who's on it, when, where and what (owners and managers)
 */
export function EditJobDialog({ job, people, paddocks, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<EditableJob | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(job ? { ...job, endDate: job.endDate ?? "" } : null); }, [job]);

  const set = <K extends keyof EditableJob>(key: K, value: EditableJob[K]) => setForm(f => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) return toast.error("Give the job a title");
    if (form.assignedTo.length === 0) return toast.error("Assign at least one person");
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${form.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description,
          location: form.location,
          pastureId: form.pastureId || null,
          assignedTo: form.assignedTo,
          priority: form.priority,
          category: form.category,
          startDate: form.startDate,
          startTime: form.startTime || undefined,
          endDate: form.endDate || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.details?.[0]?.message ?? body?.error ?? "Couldn't save the job");
      const added = form.assignedTo.filter(id => !job!.assignedTo.includes(id)).length;
      toast.success(added > 0 ? `Job saved. ${added === 1 ? "The new person has" : "The new people have"} been told.` : "Job saved");
      onSaved(body);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!job} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit job</DialogTitle>
          <DialogDescription>Anyone you add is notified. To move the pin, use Move pin on the job.</DialogDescription>
        </DialogHeader>
        {form && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="edit-title">Title</Label>
              <Input id="edit-title" value={form.title} onChange={e => set("title", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" rows={3} value={form.description} onChange={e => set("description", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Assigned to</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {people.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm px-1 py-0.5 rounded hover:bg-muted cursor-pointer">
                    <input type="checkbox" checked={form.assignedTo.includes(p.id)}
                      onChange={e => set("assignedTo", e.target.checked ? [...form.assignedTo, p.id] : form.assignedTo.filter(id => id !== p.id))} />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-priority">Priority</Label>
                <select id="edit-priority" className={selectClass} value={form.priority} onChange={e => set("priority", e.target.value)}>
                  {["low", "medium", "high", "urgent"].map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-category">Category</Label>
                <select id="edit-category" className={selectClass} value={form.category} onChange={e => set("category", e.target.value)}>
                  {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  {!CATEGORIES.some(([v]) => v === form.category) && <option value={form.category}>{form.category}</option>}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-start">Start</Label>
                <Input id="edit-start" type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-time">Time</Label>
                <Input id="edit-time" type="time" value={form.startTime ?? ""} onChange={e => set("startTime", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-end">Finish by</Label>
                <Input id="edit-end" type="date" value={form.endDate ?? ""} min={form.startDate} onChange={e => set("endDate", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-paddock">Paddock</Label>
                <select id="edit-paddock" className={selectClass} value={form.pastureId ?? ""} onChange={e => set("pastureId", e.target.value || null)}>
                  <option value="">Not in a paddock</option>
                  {paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-location">Where (description)</Label>
              <Input id="edit-location" value={form.location} onChange={e => set("location", e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
