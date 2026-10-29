import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { RecordDialog } from "./RecordDialog";
import { drainOutbox, listOutbox, onOutboxChange, type RecordType } from "@/lib/records";

// Other screens can open the dialog with a type preselected, and optionally prefilled:
// window.dispatchEvent(new CustomEvent(NEW_RECORD_EVENT, { detail: { type: "monthly_check", details: { month: "July" } } }))
export const NEW_RECORD_EVENT = "pulse:new-record";
// ...or open an existing record to finish it: { detail: { id } }
export const EDIT_RECORD_EVENT = "pulse:edit-record";

export interface NewRecordDetail { type?: RecordType; details?: Record<string, any>; title?: string }

export const openNewRecord = (detail: NewRecordDetail) =>
  window.dispatchEvent(new CustomEvent(NEW_RECORD_EVENT, { detail }));
export const openEditRecord = (id: string) =>
  window.dispatchEvent(new CustomEvent(EDIT_RECORD_EVENT, { detail: { id } }));

/**
 * The "+ Record" button on every screen, plus uploading records saved while offline
 */
export function RecordFab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RecordType>("spray");
  const [preset, setPreset] = useState<NewRecordDetail | undefined>();
  const [editId, setEditId] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const onNew = (e: Event) => {
      const detail = (e as CustomEvent<NewRecordDetail>).detail;
      if (detail?.type) setType(detail.type);
      setPreset(detail?.details || detail?.title ? detail : undefined);
      setEditId(null);
      setOpen(true);
    };
    const onEdit = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      setPreset(undefined);
      setEditId(id);
      setOpen(true);
    };
    window.addEventListener(NEW_RECORD_EVENT, onNew);
    window.addEventListener(EDIT_RECORD_EVENT, onEdit);
    return () => {
      window.removeEventListener(NEW_RECORD_EVENT, onNew);
      window.removeEventListener(EDIT_RECORD_EVENT, onEdit);
    };
  }, []);

  useEffect(() => {
    const refreshCount = () => listOutbox().then(items => setPending(items.length));
    const upload = async () => {
      const sent = await drainOutbox();
      if (sent > 0) {
        toast.success(`Uploaded ${sent} record${sent === 1 ? "" : "s"} saved while offline`);
        queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      }
    };
    refreshCount();
    upload();
    const stop = onOutboxChange(refreshCount);
    window.addEventListener("online", upload);
    const timer = setInterval(upload, 60_000);
    return () => {
      stop();
      window.removeEventListener("online", upload);
      clearInterval(timer);
    };
  }, [queryClient]);

  return (
    <>
      <div
        className="fixed z-40 flex flex-col items-end gap-2"
        style={{
          right: "calc(1.25rem + env(safe-area-inset-right, 0px))",
          bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {pending > 0 && (
          <button
            type="button"
            onClick={() => drainOutbox()}
            className="flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 text-xs font-medium shadow"
            title="Records saved on this device without signal. Tap to try uploading now."
          >
            <CloudUpload className="h-3.5 w-3.5" />
            {pending} waiting to upload
          </button>
        )}
        <button
          type="button"
          onClick={() => { setType("spray"); setPreset(undefined); setEditId(null); setOpen(true); }}
          className="flex items-center gap-2 rounded-full bg-pulse-forest hover:bg-pulse-forest-dark text-white pl-4 pr-5 h-14 shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label="New record"
          data-testid="button-new-record"
        >
          <Plus className="h-6 w-6" />
          <span className="font-semibold">Record</span>
        </button>
      </div>
      <RecordDialog open={open} onOpenChange={setOpen} initialType={type} preset={preset} editRecordId={editId} />
    </>
  );
}
