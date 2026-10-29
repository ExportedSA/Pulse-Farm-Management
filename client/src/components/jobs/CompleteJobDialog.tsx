import { useEffect, useState } from "react";
import { Camera, CheckCircle2, MapPin, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sendJobAction } from "@/lib/job-outbox";

export interface CompletableJob {
  id: string;
  title: string;
  checklistItems?: { id: string; text: string; required?: boolean; completed?: boolean }[];
}

interface Props {
  job: CompletableJob | null;
  onOpenChange: (open: boolean) => void;
  // The updated job, or "queued" when it was saved on the device to send later
  onDone: (result: any | "queued") => void;
}

type Where = { state: "finding" } | { state: "found"; lat: number; lng: number; accuracy: number } | { state: "none" };

/**
 * Finish a job with proof: a note, photos, and where it was finished. It becomes a
 * "Job done" record in Records. Works without signal (sent when back online).
 */
export function CompleteJobDialog({ job, onOpenChange, onDone }: Props) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [where, setWhere] = useState<Where>({ state: "none" });
  const [saving, setSaving] = useState(false);

  // Record where the job was finished as the dialog opens
  useEffect(() => {
    if (!job) return;
    setNote("");
    setFiles([]);
    if (!navigator.geolocation) {
      setWhere({ state: "none" });
      return;
    }
    setWhere({ state: "finding" });
    navigator.geolocation.getCurrentPosition(
      pos => setWhere({ state: "found", lat: Number(pos.coords.latitude.toFixed(7)), lng: Number(pos.coords.longitude.toFixed(7)), accuracy: Math.round(pos.coords.accuracy) }),
      () => setWhere({ state: "none" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const unticked = (job?.checklistItems ?? []).filter(i => i.required && !i.completed);
  const addFiles = (list: FileList | null) => setFiles(f => [...f, ...Array.from(list ?? [])].slice(0, 5));

  const submit = async () => {
    if (!job) return;
    setSaving(true);
    try {
      const result = await sendJobAction({
        kind: "complete",
        jobId: job.id,
        note: note.trim() || undefined,
        latitude: where.state === "found" ? where.lat : null,
        longitude: where.state === "found" ? where.lng : null,
      }, files);
      if (result.queued) {
        toast.success("No signal: saved on this phone. It will send when you're back online.");
        onDone("queued");
      } else {
        toast.success("Job done, and saved to Records");
        onDone(result.job);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Couldn't complete the job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!job} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete {job?.title}</DialogTitle>
          <DialogDescription>Add a photo of the finished work and a note. It's saved to Records as a Job done record.</DialogDescription>
        </DialogHeader>

        {unticked.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-1">
            <p className="font-medium">Tick these off in the job's checklist first:</p>
            <ul className="list-disc pl-5">{unticked.map(i => <li key={i.id}>{i.text}</li>)}</ul>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Photos</Label>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-1 px-3 py-2 rounded-md border text-sm cursor-pointer bg-pulse-forest text-white">
                  <Camera className="h-4 w-4" />Take photo
                  <input type="file" accept="image/*" capture="environment" className="sr-only"
                    onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
                </label>
                <label className="inline-flex items-center gap-1 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-muted">
                  <Paperclip className="h-4 w-4" />Choose photos
                  <input type="file" accept="image/*" multiple className="sr-only"
                    onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
                </label>
              </div>
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="relative">
                      <img src={URL.createObjectURL(f)} alt={f.name} className="h-16 w-16 rounded object-cover border" />
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(l => l.filter((_, j) => j !== i))}
                        className="absolute -top-2 -right-2 rounded-full bg-background border p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="complete-note">Note</Label>
              <Textarea id="complete-note" rows={3} value={note} onChange={e => setNote(e.target.value)}
                placeholder="What was done, anything to follow up" />
            </div>
            <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {where.state === "finding" && "Recording where you are…"}
              {where.state === "found" && `Finished here (within ${where.accuracy} m)`}
              {where.state === "none" && "Location not available; the job's pin will be used"}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-green-600 hover:bg-green-700" disabled={saving || unticked.length > 0} onClick={submit}>
            <CheckCircle2 className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Complete job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
