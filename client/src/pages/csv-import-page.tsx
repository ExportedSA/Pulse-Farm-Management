import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, AlertTriangle, ArrowRight, Download, X, Loader2 } from "lucide-react";

// Comprehensive Minda field mappings
const MINDA_MAPPINGS: Record<string, string> = {
  'Animal ID': 'cowId', 'AnimalID': 'cowId', 'Cow ID': 'cowId', 'Visual ID': 'visualId', 'VID': 'visualId',
  'Lifetime ID': 'lifetimeId', 'LID': 'lifetimeId', 'NAIT Number': 'naitTag', 'NAIT': 'naitTag', 'EID': 'eid',
  'Birth ID': 'birthId', 'Name': 'name', 'Sex': 'sex', 'Gender': 'sex', 'Breed': 'breed', 'Colour': 'color',
  'Date of Birth': 'dateOfBirth', 'DOB': 'dateOfBirth', 'Birth Date': 'dateOfBirth',
  'Date Entered Herd': 'purchaseDate', 'Status': 'status', 'Dam ID': 'damId', 'Dam': 'damId',
  'Sire ID': 'sireId', 'Sire': 'sireId', 'Sire Code': 'sireCode', 'Sire Name': 'sireName',
  'BW': 'breedingWorth', 'Breeding Worth': 'breedingWorth', 'PW': 'productionWorth', 'Production Worth': 'productionWorth',
  'LW': 'lactationWorth', 'Reliability': 'reliability', 'Milk BV': 'milkBV', 'Fat BV': 'fatBV', 'Protein BV': 'proteinBV',
  'Fertility BV': 'fertilityBV', 'SCC BV': 'sccBV', 'TOP': 'topIndex',
  'Mating Date': 'lastMatingDate', 'Last Mating': 'lastMatingDate', 'Mating Sire': 'matingSire',
  'Due Date': 'dueDate', 'Expected Calving': 'dueDate', 'In Calf': 'inCalf', 'Pregnancy Status': 'pregnancyStatus',
  'Lactation Number': 'lactationNumber', 'Parity': 'lactationNumber', 'Calving Ease': 'calvingEase',
  'Dry Off Date': 'dryOffDate', 'Milk kgMS': 'milkKgMS', 'Milk Solids': 'milkKgMS',
  'Fat kg': 'fatKg', 'Protein kg': 'proteinKg', 'Fat %': 'fatPercent', 'Protein %': 'proteinPercent',
  'Days in Milk': 'daysInMilk', 'DIM': 'daysInMilk', 'Peak Milk': 'peakMilk',
  'SCC': 'somaticCellCount', 'Somatic Cell Count': 'somaticCellCount', 'Cell Count': 'somaticCellCount',
  'BCS': 'bodyConditionScore', 'Body Condition': 'bodyConditionScore', 'Mastitis Count': 'mastitisCount',
  'Lameness Score': 'lamenessScore', 'Live Weight': 'liveWeight', 'Liveweight': 'liveWeight', 'Weight': 'liveWeight',
  'Birth Weight': 'birthWeight', 'Weaning Weight': 'weaningWeight', 'ADG': 'averageDailyGain',
  'Mob': 'currentMob', 'Current Mob': 'currentMob', 'Paddock': 'currentPaddock',
  'Purchase Price': 'purchasePrice', 'Notes': 'notes', 'Comments': 'notes',
  'Friesian %': 'friesianPercent', 'Jersey %': 'jerseyPercent', 'Dam Breed': 'damBreed', 'Sire Breed': 'sireBreed',
};

const PULSE_FIELDS = [
  { key: 'cowId', label: 'Cow ID', cat: 'ID' }, { key: 'visualId', label: 'Visual ID', cat: 'ID' },
  { key: 'lifetimeId', label: 'Lifetime ID', cat: 'ID' }, { key: 'naitTag', label: 'NAIT Tag', cat: 'ID' },
  { key: 'eid', label: 'EID', cat: 'ID' }, { key: 'birthId', label: 'Birth ID', cat: 'ID' },
  { key: 'name', label: 'Name', cat: 'Basic' }, { key: 'sex', label: 'Sex', cat: 'Basic', required: true },
  { key: 'breed', label: 'Breed', cat: 'Basic' }, { key: 'color', label: 'Color', cat: 'Basic' },
  { key: 'dateOfBirth', label: 'Date of Birth', cat: 'Basic' }, { key: 'purchaseDate', label: 'Purchase Date', cat: 'Basic' },
  { key: 'status', label: 'Status', cat: 'Basic' }, { key: 'damId', label: 'Dam ID', cat: 'Genetics' },
  { key: 'sireId', label: 'Sire ID', cat: 'Genetics' }, { key: 'sireCode', label: 'Sire Code', cat: 'Genetics' },
  { key: 'sireName', label: 'Sire Name', cat: 'Genetics' }, { key: 'damBreed', label: 'Dam Breed', cat: 'Genetics' },
  { key: 'sireBreed', label: 'Sire Breed', cat: 'Genetics' }, { key: 'friesianPercent', label: 'Friesian %', cat: 'Genetics' },
  { key: 'jerseyPercent', label: 'Jersey %', cat: 'Genetics' },
  { key: 'breedingWorth', label: 'BW', cat: 'BV' }, { key: 'productionWorth', label: 'PW', cat: 'BV' },
  { key: 'lactationWorth', label: 'LW', cat: 'BV' }, { key: 'reliability', label: 'Reliability', cat: 'BV' },
  { key: 'milkBV', label: 'Milk BV', cat: 'BV' }, { key: 'fatBV', label: 'Fat BV', cat: 'BV' },
  { key: 'proteinBV', label: 'Protein BV', cat: 'BV' }, { key: 'fertilityBV', label: 'Fertility BV', cat: 'BV' },
  { key: 'lastMatingDate', label: 'Mating Date', cat: 'Repro' }, { key: 'matingSire', label: 'Mating Sire', cat: 'Repro' },
  { key: 'dueDate', label: 'Due Date', cat: 'Repro' }, { key: 'inCalf', label: 'In Calf', cat: 'Repro' },
  { key: 'pregnancyStatus', label: 'Pregnancy Status', cat: 'Repro' }, { key: 'lactationNumber', label: 'Lactation #', cat: 'Repro' },
  { key: 'calvingEase', label: 'Calving Ease', cat: 'Repro' }, { key: 'dryOffDate', label: 'Dry Off Date', cat: 'Repro' },
  { key: 'milkKgMS', label: 'Milk kgMS', cat: 'Prod' }, { key: 'fatKg', label: 'Fat kg', cat: 'Prod' },
  { key: 'proteinKg', label: 'Protein kg', cat: 'Prod' }, { key: 'fatPercent', label: 'Fat %', cat: 'Prod' },
  { key: 'proteinPercent', label: 'Protein %', cat: 'Prod' }, { key: 'daysInMilk', label: 'Days in Milk', cat: 'Prod' },
  { key: 'somaticCellCount', label: 'SCC', cat: 'Health' }, { key: 'bodyConditionScore', label: 'BCS', cat: 'Health' },
  { key: 'mastitisCount', label: 'Mastitis Count', cat: 'Health' }, { key: 'lamenessScore', label: 'Lameness', cat: 'Health' },
  { key: 'liveWeight', label: 'Live Weight', cat: 'Weight' }, { key: 'birthWeight', label: 'Birth Weight', cat: 'Weight' },
  { key: 'weaningWeight', label: 'Weaning Weight', cat: 'Weight' }, { key: 'averageDailyGain', label: 'ADG', cat: 'Weight' },
  { key: 'currentMob', label: 'Current Mob', cat: 'Location' }, { key: 'currentPaddock', label: 'Paddock', cat: 'Location' },
  { key: 'purchasePrice', label: 'Purchase Price', cat: 'Financial' }, { key: 'notes', label: 'Notes', cat: 'Other' },
];

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [] as string[], rows: [] as string[][] };
  const parse = (line: string) => {
    const r: string[] = []; let c = '', q = false;
    for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { r.push(c.trim()); c = ''; } else c += ch; }
    r.push(c.trim()); return r;
  };
  return { headers: parse(lines[0]), rows: lines.slice(1).map(parse).filter(r => r.some(c => c)) };
}

function normalizeValue(val: string, key: string): any {
  if (!val?.trim()) return null;
  const v = val.trim(), l = v.toLowerCase();
  if (key === 'sex') return ['f','female','cow','heifer'].includes(l) ? 'female' : ['m','male','bull','steer'].includes(l) ? 'male' : v;
  if (key === 'status') return ['active','alive','present'].includes(l) ? 'active' : ['sold','gone'].includes(l) ? 'sold' : ['dead','deceased'].includes(l) ? 'deceased' : 'active';
  if (key === 'inCalf') return ['yes','y','1','true'].includes(l);
  if (key.includes('Date') || key === 'dateOfBirth' || key === 'dueDate') {
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return v.match(/^\d{4}-\d{2}-\d{2}$/) ? v : null;
  }
  const nums = ['breedingWorth','productionWorth','lactationWorth','reliability','milkBV','fatBV','proteinBV','milkKgMS','fatKg','proteinKg','fatPercent','proteinPercent','somaticCellCount','bodyConditionScore','liveWeight','birthWeight','lactationNumber','friesianPercent','jerseyPercent','purchasePrice'];
  if (nums.includes(key)) { const n = parseFloat(v.replace(/[$,]/g,'')); return isNaN(n) ? null : n; }
  return v;
}

interface ParsedRow { idx: number; mapped: Record<string, any>; errors: string[]; warnings: string[]; }

export default function CSVImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'importing' | 'done'>('upload');
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ animals: 0, health: 0, repro: 0, weight: 0, prod: 0 });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const qc = useQueryClient();

  const onDrop = useCallback((files: File[]) => {
    const f = files[0]; if (!f) return;
    setFile(f);
    const r = new FileReader();
    r.onload = e => {
      const d = parseCSV(e.target?.result as string);
      setCsv(d);
      const auto: Record<string, string> = {};
      d.headers.forEach(h => { if (MINDA_MAPPINGS[h]) auto[h] = MINDA_MAPPINGS[h]; });
      setMappings(auto);
      setStep('map');
      toast.success(`Loaded ${d.rows.length} rows`);
    };
    r.readAsText(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] }, maxFiles: 1 });

  const processMap = () => {
    if (!csv) return;
    const rows = csv.rows.map((row, i) => {
      const mapped: Record<string, any> = {};
      csv.headers.forEach((h, j) => { const k = mappings[h]; if (k) { const v = normalizeValue(row[j], k); if (v !== null) mapped[k] = v; } });
      const errors: string[] = [], warnings: string[] = [];
      if (!mapped.sex) errors.push('Sex required');
      if (!mapped.cowId && !mapped.naitTag && !mapped.visualId && !mapped.eid) warnings.push('No ID');
      return { idx: i, mapped, errors, warnings };
    });
    setParsed(rows);
    setSelected(new Set(rows.filter(r => !r.errors.length).map(r => r.idx)));
    setStep('preview');
  };

  const importMut = useMutation({
    mutationFn: async (animals: Record<string, any>[]) => {
      const s = { animals: 0, health: 0, repro: 0, weight: 0, prod: 0 };
      for (let i = 0; i < animals.length; i++) {
        const a = animals[i];
        try {
          const res = await fetch('/api/animals', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farmId: '1', cowId: a.cowId, visualId: a.visualId, lifetimeId: a.lifetimeId, naitTag: a.naitTag, eid: a.eid, birthId: a.birthId, name: a.name, sex: a.sex || 'female', breed: a.breed, color: a.color, dateOfBirth: a.dateOfBirth, purchaseDate: a.purchaseDate, status: a.status || 'active', damId: a.damId, sireId: a.sireId, breedingWorth: a.breedingWorth, productionWorth: a.productionWorth, notes: a.notes }) });
          if (res.ok) {
            s.animals++;
            const animal = await res.json();
            if (a.liveWeight) { await fetch('/api/weight-records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ animalId: animal.id, weight: a.liveWeight, recordedAt: new Date().toISOString() }) }).catch(() => {}); s.weight++; }
            if (a.bodyConditionScore || a.somaticCellCount) { await fetch('/api/health-records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ animalId: animal.id, bodyConditionScore: a.bodyConditionScore, somaticCellCount: a.somaticCellCount, recordedAt: new Date().toISOString() }) }).catch(() => {}); s.health++; }
            if (a.lastMatingDate || a.dueDate) { await fetch('/api/reproduction-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ animalId: animal.id, eventType: 'mating', eventDate: a.lastMatingDate || new Date().toISOString(), sireId: a.matingSire, dueDate: a.dueDate }) }).catch(() => {}); s.repro++; }
            if (a.milkKgMS) { await fetch('/api/milk-production', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ animalId: animal.id, milkKgMS: a.milkKgMS, fatKg: a.fatKg, proteinKg: a.proteinKg, recordedAt: new Date().toISOString() }) }).catch(() => {}); s.prod++; }
          }
        } catch (e) { console.error(e); }
        setProgress(Math.round(((i + 1) / animals.length) * 100));
      }
      return s;
    },
    onSuccess: s => { setStats(s); setStep('done'); qc.invalidateQueries({ queryKey: ['/api/animals'] }); toast.success(`Imported ${s.animals} animals!`); },
  });

  const startImport = () => { setStep('importing'); setProgress(0); importMut.mutate(parsed.filter(r => selected.has(r.idx)).map(r => r.mapped)); };
  const reset = () => { setFile(null); setCsv(null); setMappings({}); setParsed([]); setStep('upload'); setProgress(0); setSelected(new Set()); };

  const downloadTemplate = () => {
    const h = ['Animal ID','Visual ID','NAIT Number','Name','Sex','Breed','Date of Birth','Status','Dam ID','Sire ID','BW','PW','Mating Date','Due Date','In Calf','Lactation Number','Milk kgMS','Fat %','Protein %','SCC','BCS','Live Weight','Current Mob','Notes'];
    const s = ['001','V001','982000123456789','Daisy','Female','Friesian','15/08/2020','Active','D045','S123','150','180','15/10/2024','25/07/2025','Yes','3','425','4.8','3.9','120','5.0','485','Milking','Good producer'];
    const blob = new Blob([[h.join(','), s.join(',')].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'pulse_import_template.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3"><FileSpreadsheet className="h-8 w-8 text-emerald-600" />Import from Minda / CSV</h1>
        <p className="text-muted-foreground mt-2">Import complete herd data: animals, health, reproduction, genetics, production & weights.</p>
      </div>

      <div className="mb-8 flex items-center gap-4">
        {['Upload', 'Map', 'Preview', 'Import'].map((l, i) => {
          const steps = ['upload', 'map', 'preview', 'importing'];
          const cur = steps.indexOf(step === 'done' ? 'importing' : step);
          return (<div key={l} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i <= cur ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}>
              {step === 'done' && i === 3 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`ml-2 ${i <= cur ? 'text-emerald-700 font-medium' : 'text-gray-400'}`}>{l}</span>
            {i < 3 && <ArrowRight className="mx-3 h-4 w-4 text-gray-300" />}
          </div>);
        })}
      </div>

      {step === 'upload' && (
        <Card>
          <CardHeader><CardTitle>Upload CSV File</CardTitle><CardDescription>Export from Minda and upload here. Fields auto-map.</CardDescription></CardHeader>
          <CardContent>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer ${isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400'}`}>
              <input {...getInputProps()} /><Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">{isDragActive ? 'Drop here...' : 'Drag & drop CSV or click to browse'}</p>
            </div>
            <Button variant="outline" className="mt-4" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" />Download Template</Button>
          </CardContent>
        </Card>
      )}

      {step === 'map' && csv && (
        <Card>
          <CardHeader><CardTitle>Map Fields</CardTitle><CardDescription>Auto-detected {Object.keys(mappings).length}/{csv.headers.length} fields from {csv.rows.length} rows</CardDescription></CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] border rounded">
              <Table>
                <TableHeader><TableRow><TableHead>CSV Column</TableHead><TableHead>Sample</TableHead><TableHead>Pulse Field</TableHead></TableRow></TableHeader>
                <TableBody>
                  {csv.headers.map((h, i) => (
                    <TableRow key={h}>
                      <TableCell className="font-medium">{h}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">{csv.rows[0]?.[i] || '—'}</TableCell>
                      <TableCell>
                        <Select value={mappings[h] || 'skip'} onValueChange={v => setMappings(p => ({ ...p, [h]: v === 'skip' ? '' : v }))}>
                          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">— Skip —</SelectItem>
                            {PULSE_FIELDS.map(f => <SelectItem key={f.key} value={f.key}>{f.label} ({f.cat})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="mt-4 flex justify-between">
              <Button variant="outline" onClick={reset}><X className="h-4 w-4 mr-2" />Start Over</Button>
              <Button onClick={processMap} className="bg-emerald-600 hover:bg-emerald-700">Continue<ArrowRight className="h-4 w-4 ml-2" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Import</CardTitle>
            <div className="flex gap-4 mt-2">
              <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-3 w-3 mr-1" />{parsed.filter(r => !r.errors.length).length} Ready</Badge>
              <Badge className="bg-amber-100 text-amber-800"><AlertTriangle className="h-3 w-3 mr-1" />{parsed.filter(r => r.warnings.length && !r.errors.length).length} Warnings</Badge>
              <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />{parsed.filter(r => r.errors.length).length} Errors</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px] border rounded">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10"><Checkbox checked={selected.size === parsed.filter(r => !r.errors.length).length} onCheckedChange={c => setSelected(c ? new Set(parsed.filter(r => !r.errors.length).map(r => r.idx)) : new Set())} /></TableHead>
                  <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Sex</TableHead><TableHead>Breed</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {parsed.map(r => (
                    <TableRow key={r.idx} className={r.errors.length ? 'bg-red-50' : r.warnings.length ? 'bg-amber-50' : ''}>
                      <TableCell><Checkbox checked={selected.has(r.idx)} disabled={!!r.errors.length} onCheckedChange={c => { const s = new Set(selected); c ? s.add(r.idx) : s.delete(r.idx); setSelected(s); }} /></TableCell>
                      <TableCell className="font-mono text-sm">{r.mapped.cowId || r.mapped.visualId || r.mapped.naitTag || '—'}</TableCell>
                      <TableCell>{r.mapped.name || '—'}</TableCell>
                      <TableCell><Badge variant={r.mapped.sex === 'female' ? 'default' : 'secondary'}>{r.mapped.sex || '—'}</Badge></TableCell>
                      <TableCell>{r.mapped.breed || '—'}</TableCell>
                      <TableCell>{r.errors.length ? <Badge variant="destructive">{r.errors[0]}</Badge> : r.warnings.length ? <Badge className="bg-amber-100 text-amber-800">{r.warnings[0]}</Badge> : <Badge className="bg-emerald-100 text-emerald-800">Ready</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="mt-4 flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
              <span className="text-sm text-muted-foreground">{selected.size} selected</span>
              <Button onClick={startImport} disabled={!selected.size} className="bg-emerald-600 hover:bg-emerald-700">Import {selected.size} Animals</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'importing' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-emerald-600" />
            <h3 className="text-xl font-semibold mb-2">Importing...</h3>
            <Progress value={progress} className="w-64 mx-auto mb-2" />
            <p className="text-muted-foreground">{progress}% complete</p>
          </CardContent>
        </Card>
      )}

      {step === 'done' && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-600" />
            <h3 className="text-2xl font-bold text-emerald-800 mb-4">Import Complete!</h3>
            <div className="grid grid-cols-5 gap-4 max-w-xl mx-auto mb-6">
              <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{stats.animals}</p><p className="text-sm text-emerald-600">Animals</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{stats.health}</p><p className="text-sm text-emerald-600">Health</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{stats.repro}</p><p className="text-sm text-emerald-600">Repro</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{stats.weight}</p><p className="text-sm text-emerald-600">Weights</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{stats.prod}</p><p className="text-sm text-emerald-600">Production</p></div>
            </div>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={reset}>Import More</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => window.location.href = '/app/animals'}>View Animals</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
