import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

// Minimal NAIT Records page to satisfy routing and provide a basic UI shell.
// We can wire this into the real NAIT API endpoints in a later pass.

export default function NaitRecordsPage() {
  const [naitNumber, setNaitNumber] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder: submit logic to NAIT API can be added later.
    // For now, we just clear the form.
    setNaitNumber("");
    setNotes("");
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>NAIT Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Record and review NAIT movements and events. This is a starter UI; backend
            integration can be extended as needed.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">NAIT Number</label>
              <Input
                value={naitNumber}
                onChange={(e) => setNaitNumber(e.target.value)}
                placeholder="Enter NAIT number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Movement details, dates, and any relevant info"
                rows={4}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!naitNumber.trim()}>
                Save Record
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
