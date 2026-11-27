// The farm's activity log (build guide F3): who created, changed, deleted or exported what, and when.
// Only the farm's owner can see it; field values are never kept, only which fields a change touched.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = {
  id: string; at: string; userId: string | null; person: string | null; action: string;
  recordType: string; recordId: string | null; method: string | null; path: string | null;
  details: { fields?: string[]; filename?: string };
};
type Person = { id: string; name: string; role: string; active: boolean };

const ACTIONS: Record<string, string> = { create: "Added", update: "Changed", delete: "Removed", export: "Exported", view: "Opened" };
const ALL = "all";

// "hardware/draft-rules" -> "Hardware draft rules"
const kindOf = (type: string) => {
  const words = type.replace(/[/_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function forbidden(error: unknown) {
  return /^403/.test(error instanceof Error ? error.message : "");
}

export default function ActivityLogPage() {
  const [person, setPerson] = useState(ALL);
  const [action, setAction] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const url = useMemo(() => {
    const q = new URLSearchParams({ limit: "200" });
    if (person !== ALL) q.set("userId", person);
    if (action !== ALL) q.set("action", action);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return `/api/audit?${q}`;
  }, [person, action, from, to]);

  const log = useQuery<Row[]>({ queryKey: [url], staleTime: 0 });
  const people = useQuery<Person[]>({ queryKey: ["/api/audit/people"] });

  if (forbidden(log.error)) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-4"><History className="inline-block h-8 w-8 mr-2 mb-1" strokeWidth={1.5} />Activity log</h1>
        <p className="text-muted-foreground">Only the farm's owner can see the activity log.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2"><History className="inline-block h-8 w-8 mr-2 mb-1" strokeWidth={1.5} />Activity log</h1>
        <p className="text-muted-foreground">
          Who added, changed, removed or exported what on this farm, and when. It keeps which fields a change touched, never their values.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="grid gap-2">
            <Label>Person</Label>
            <Select value={person} onValueChange={setPerson}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Everyone</SelectItem>
                {(people.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}{p.active ? "" : " (left)"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>What</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Everything</SelectItem>
                {Object.entries(ACTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="log-from">From</Label>
            <Input id="log-from" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="log-to">To</Label>
            <Input id="log-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => { setPerson(ALL); setAction(ALL); setFrom(""); setTo(""); }}>Clear filters</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardDescription>Newest first, up to 200. Narrow the dates to look further back.</CardDescription>
        </CardHeader>
        <CardContent>
          {log.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (log.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing recorded for these filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>What</TableHead><TableHead>Record</TableHead><TableHead>Fields</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(log.data ?? []).map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(r.at).toLocaleString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell>{r.person ?? "Someone no longer on Pulse"}</TableCell>
                    <TableCell><Badge variant={r.action === "delete" ? "destructive" : "outline"}>{ACTIONS[r.action] ?? r.action}</Badge></TableCell>
                    <TableCell>
                      {kindOf(r.recordType)}
                      {r.recordId && <span className="block text-xs text-muted-foreground font-mono">{r.recordId}</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.details?.fields?.join(", ") ?? r.details?.filename ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
