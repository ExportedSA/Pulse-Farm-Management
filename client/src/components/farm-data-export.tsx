import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Settings › Farm: the owner downloads everything the farm has in Pulse (a zip of CSV and JSON)
export function FarmDataExport() {
  const { data: farm } = useQuery<{ role: string }>({ queryKey: ["/api/farms/current"] });
  const [busy, setBusy] = useState(false);
  if (farm?.role !== "owner") return null;

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/farms/current/export", { credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't export the farm data");
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "pulse-farm-data.zip";
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Your farm's data</CardTitle>
        <CardDescription>
          Download everything this farm has in Pulse: a zip with a spreadsheet (CSV) and a JSON file for each kind of record,
          plus the farm's details and people. Uploaded photos and documents are listed, but the files themselves aren't included yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={download} disabled={busy} data-testid="button-export-farm-data">
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}Download all farm data
        </Button>
      </CardContent>
    </Card>
  );
}
