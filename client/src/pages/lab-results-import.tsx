import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { 
  FlaskConical, Upload, FileSpreadsheet, Plus, Search, 
  CheckCircle2, XCircle, AlertTriangle, Download, Loader2,
  Eye, Trash2, FileText, Calendar
} from "lucide-react";
import type { Animal, LabResult } from "@shared/schema";

const LAB_TEST_TYPES = [
  { value: "blood", label: "Blood Test" },
  { value: "milk", label: "Milk Test" },
  { value: "fecal", label: "Fecal Test" },
  { value: "urine", label: "Urine Test" },
  { value: "tissue", label: "Tissue Biopsy" },
  { value: "culture", label: "Culture/Sensitivity" },
  { value: "genetic", label: "Genetic Test" },
  { value: "other", label: "Other" },
];

const RESULT_STATUS = [
  { value: "normal", label: "Normal", color: "bg-green-500" },
  { value: "abnormal", label: "Abnormal", color: "bg-yellow-500" },
  { value: "critical", label: "Critical", color: "bg-red-500" },
];

interface ParsedLabResult {
  animalId?: string;
  animalTag?: string;
  testType: string;
  testName: string;
  labName?: string;
  sampleCollectionDate: string;
  sampleId?: string;
  results: { parameter: string; value: string | number; unit?: string; status?: string }[];
  overallResult?: string;
  interpretation?: string;
  testCost?: number;
  isValid: boolean;
  errors: string[];
}

export default function LabResultsImportPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [activeTab, setActiveTab] = useState("manual");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Import state
  const [parsedResults, setParsedResults] = useState<ParsedLabResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  // Manual entry form
  const [formData, setFormData] = useState({
    animalId: "",
    testType: "blood" as string,
    testName: "",
    labName: "",
    sampleCollectionDate: format(new Date(), "yyyy-MM-dd"),
    sampleId: "",
    overallResult: "normal",
    interpretation: "",
    testCost: "",
    results: [{ parameter: "", value: "", unit: "", status: "normal" }],
  });

  // Fetch animals
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  // Fetch lab results
  const { data: labResults = [], isLoading: loadingResults } = useQuery<LabResult[]>({
    queryKey: ["/api/veterinary/lab-results"],
    queryFn: async () => {
      const res = await fetch("/api/veterinary/lab-results");
      if (!res.ok) throw new Error("Failed to fetch lab results");
      return res.json();
    },
  });

  // Create lab result mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/veterinary/lab-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create lab result");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/veterinary/lab-results"] });
      toast.success("Lab result added successfully");
      resetForm();
      setShowAddDialog(false);
    },
    onError: () => {
      toast.error("Failed to add lab result");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/veterinary/lab-results/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/veterinary/lab-results"] });
      toast.success("Lab result deleted");
      setShowViewDialog(false);
    },
    onError: () => {
      toast.error("Failed to delete lab result");
    },
  });

  // Reset form
  const resetForm = () => {
    setFormData({
      animalId: "",
      testType: "blood",
      testName: "",
      labName: "",
      sampleCollectionDate: format(new Date(), "yyyy-MM-dd"),
      sampleId: "",
      overallResult: "normal",
      interpretation: "",
      testCost: "",
      results: [{ parameter: "", value: "", unit: "", status: "normal" }],
    });
  };

  // Add result parameter row
  const addResultRow = () => {
    setFormData({
      ...formData,
      results: [...formData.results, { parameter: "", value: "", unit: "", status: "normal" }],
    });
  };

  // Remove result parameter row
  const removeResultRow = (index: number) => {
    setFormData({
      ...formData,
      results: formData.results.filter((_, i) => i !== index),
    });
  };

  // Update result parameter
  const updateResultRow = (index: number, field: string, value: string) => {
    const newResults = [...formData.results];
    (newResults[index] as any)[field] = value;
    setFormData({ ...formData, results: newResults });
  };

  // Handle manual form submit
  const handleSubmit = () => {
    if (!formData.animalId || !formData.testName) {
      toast.error("Please fill in required fields");
      return;
    }

    const payload = {
      animalId: formData.animalId,
      testType: formData.testType,
      testName: formData.testName,
      labName: formData.labName || undefined,
      sampleCollectionDate: formData.sampleCollectionDate,
      sampleId: formData.sampleId || undefined,
      overallResult: formData.overallResult,
      interpretation: formData.interpretation || undefined,
      testCost: formData.testCost ? parseFloat(formData.testCost) : undefined,
      results: formData.results.filter(r => r.parameter && r.value),
      status: "completed",
      resultsReceivedDate: format(new Date(), "yyyy-MM-dd"),
      orderedBy: user?.id,
    };

    createMutation.mutate(payload);
  };

  // Parse CSV file
  const parseCSV = (content: string): ParsedLabResult[] => {
    const lines = content.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const results: ParsedLabResult[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      const errors: string[] = [];

      // Map CSV columns to lab result fields
      const animalTag = values[headers.indexOf("animal_tag")] || values[headers.indexOf("tag")] || values[headers.indexOf("cow_id")];
      const testType = values[headers.indexOf("test_type")] || "other";
      const testName = values[headers.indexOf("test_name")] || values[headers.indexOf("test")];
      const labName = values[headers.indexOf("lab_name")] || values[headers.indexOf("lab")];
      const sampleDate = values[headers.indexOf("sample_date")] || values[headers.indexOf("date")];
      const sampleId = values[headers.indexOf("sample_id")] || values[headers.indexOf("reference")];
      const parameter = values[headers.indexOf("parameter")] || values[headers.indexOf("test_parameter")];
      const resultValue = values[headers.indexOf("value")] || values[headers.indexOf("result")];
      const unit = values[headers.indexOf("unit")];
      const status = values[headers.indexOf("status")] || "normal";
      const overallResult = values[headers.indexOf("overall_result")] || values[headers.indexOf("overall")];
      const interpretation = values[headers.indexOf("interpretation")] || values[headers.indexOf("notes")];
      const cost = values[headers.indexOf("cost")] || values[headers.indexOf("test_cost")];

      // Validate required fields
      if (!testName) errors.push("Missing test name");
      if (!sampleDate) errors.push("Missing sample date");

      // Find animal by tag
      const animal = animals.find(a => 
        a.cowId === animalTag || 
        a.naitTag === animalTag || 
        a.eid === animalTag
      );

      results.push({
        animalId: animal?.id,
        animalTag,
        testType: testType.toLowerCase(),
        testName,
        labName,
        sampleCollectionDate: sampleDate,
        sampleId,
        results: parameter && resultValue ? [{ parameter, value: resultValue, unit, status }] : [],
        overallResult,
        interpretation,
        testCost: cost ? parseFloat(cost) : undefined,
        isValid: errors.length === 0 && !!testName && !!sampleDate,
        errors,
      });
    }

    return results;
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      setParsedResults(parsed);
      toast.success(`Parsed ${parsed.length} records from file`);
    };
    reader.readAsText(file);
  };

  // Import parsed results
  const importResults = async () => {
    const validResults = parsedResults.filter(r => r.isValid);
    if (validResults.length === 0) {
      toast.error("No valid results to import");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validResults.length; i++) {
      const result = validResults[i];
      try {
        const payload = {
          animalId: result.animalId || undefined,
          testType: result.testType,
          testName: result.testName,
          labName: result.labName || undefined,
          sampleCollectionDate: result.sampleCollectionDate,
          sampleId: result.sampleId || undefined,
          results: result.results,
          overallResult: result.overallResult || "normal",
          interpretation: result.interpretation || undefined,
          testCost: result.testCost,
          status: "completed",
          resultsReceivedDate: format(new Date(), "yyyy-MM-dd"),
          orderedBy: user?.id,
        };

        await fetch("/api/veterinary/lab-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        successCount++;
      } catch {
        failCount++;
      }
      setImportProgress(((i + 1) / validResults.length) * 100);
    }

    setIsImporting(false);
    queryClient.invalidateQueries({ queryKey: ["/api/veterinary/lab-results"] });
    
    if (failCount === 0) {
      toast.success(`Successfully imported ${successCount} lab results`);
    } else {
      toast.warning(`Imported ${successCount} results, ${failCount} failed`);
    }
    
    setParsedResults([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Download template
  const downloadTemplate = () => {
    const template = `animal_tag,test_type,test_name,lab_name,sample_date,sample_id,parameter,value,unit,status,overall_result,interpretation,cost
COW001,blood,Complete Blood Count,VetLab NZ,2024-01-15,LAB-001,WBC,8.5,10^9/L,normal,normal,All values within normal range,45.00
COW002,milk,Somatic Cell Count,DairyTest,2024-01-15,LAB-002,SCC,150000,cells/mL,normal,normal,Low SCC indicates good udder health,25.00
COW003,fecal,Fecal Egg Count,ParasiteLab,2024-01-15,LAB-003,EPG,200,eggs/g,normal,normal,Low worm burden,35.00`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lab_results_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter results
  const filteredResults = labResults.filter(r => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.testName?.toLowerCase().includes(query) ||
      r.labName?.toLowerCase().includes(query) ||
      r.sampleId?.toLowerCase().includes(query)
    );
  });

  // Get animal name
  const getAnimalName = (animalId: string | null) => {
    if (!animalId) return "Unknown";
    const animal = animals.find(a => a.id === animalId);
    return animal?.cowId || animal?.naitTag || "Unknown";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FlaskConical className="h-8 w-8 text-purple-600" />
            Lab Results
          </h1>
          <p className="text-muted-foreground mt-1">
            Import and manage laboratory test results
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Result
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Results</p>
                <p className="text-2xl font-bold">{labResults.length}</p>
              </div>
              <FlaskConical className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Normal</p>
                <p className="text-2xl font-bold text-green-600">
                  {labResults.filter(r => r.overallResult === "normal").length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Abnormal</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {labResults.filter(r => r.overallResult === "abnormal").length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-600">
                  {labResults.filter(r => r.overallResult === "critical").length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="results">All Results</TabsTrigger>
          <TabsTrigger value="import">Import from File</TabsTrigger>
        </TabsList>

        {/* Results List Tab */}
        <TabsContent value="results" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by test name, lab, or sample ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingResults ? (
                <div className="p-8 text-center">Loading...</div>
              ) : filteredResults.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No lab results found</p>
                  <p className="text-sm mt-2">Add results manually or import from a file</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Animal</TableHead>
                      <TableHead>Test</TableHead>
                      <TableHead>Lab</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.slice(0, 50).map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          {result.sampleCollectionDate 
                            ? format(new Date(result.sampleCollectionDate), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>{getAnimalName(result.animalId)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{result.testName}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {result.testType}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{result.labName || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              result.overallResult === "critical" ? "destructive" :
                              result.overallResult === "abnormal" ? "secondary" : "default"
                            }
                            className={
                              result.overallResult === "normal" ? "bg-green-500" : ""
                            }
                          >
                            {result.overallResult || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedResult(result);
                              setShowViewDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Lab Results from CSV</CardTitle>
              <CardDescription>
                Upload a CSV file with lab results to bulk import
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select CSV File
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              {parsedResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{parsedResults.length}</span> records parsed
                      <span className="text-green-600 ml-2">
                        ({parsedResults.filter(r => r.isValid).length} valid)
                      </span>
                      {parsedResults.filter(r => !r.isValid).length > 0 && (
                        <span className="text-red-600 ml-2">
                          ({parsedResults.filter(r => !r.isValid).length} invalid)
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={importResults}
                      disabled={isImporting || parsedResults.filter(r => r.isValid).length === 0}
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Import {parsedResults.filter(r => r.isValid).length} Results
                        </>
                      )}
                    </Button>
                  </div>

                  {isImporting && (
                    <Progress value={importProgress} />
                  )}

                  <ScrollArea className="h-[400px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Animal</TableHead>
                          <TableHead>Test</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Lab</TableHead>
                          <TableHead>Errors</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedResults.map((result, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {result.isValid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </TableCell>
                            <TableCell>
                              {result.animalTag || "—"}
                              {result.animalId && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Matched
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{result.testName || "—"}</TableCell>
                            <TableCell>{result.sampleCollectionDate || "—"}</TableCell>
                            <TableCell>{result.labName || "—"}</TableCell>
                            <TableCell>
                              {result.errors.length > 0 && (
                                <span className="text-red-600 text-xs">
                                  {result.errors.join(", ")}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              {parsedResults.length === 0 && (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Upload a CSV file to preview and import lab results</p>
                  <p className="text-sm mt-2">
                    Download the template for the correct format
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Result Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Lab Result</DialogTitle>
            <DialogDescription>
              Enter lab test results manually
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Animal *</Label>
                <Select
                  value={formData.animalId}
                  onValueChange={(v) => setFormData({ ...formData, animalId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select animal" />
                  </SelectTrigger>
                  <SelectContent>
                    {animals.map((animal) => (
                      <SelectItem key={animal.id} value={animal.id}>
                        {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Test Type *</Label>
                <Select
                  value={formData.testType}
                  onValueChange={(v) => setFormData({ ...formData, testType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAB_TEST_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Test Name *</Label>
                <Input
                  value={formData.testName}
                  onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
                  placeholder="e.g., Complete Blood Count"
                />
              </div>
              <div>
                <Label>Lab Name</Label>
                <Input
                  value={formData.labName}
                  onChange={(e) => setFormData({ ...formData, labName: e.target.value })}
                  placeholder="e.g., VetLab NZ"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Sample Date *</Label>
                <Input
                  type="date"
                  value={formData.sampleCollectionDate}
                  onChange={(e) => setFormData({ ...formData, sampleCollectionDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Sample ID</Label>
                <Input
                  value={formData.sampleId}
                  onChange={(e) => setFormData({ ...formData, sampleId: e.target.value })}
                  placeholder="Lab reference"
                />
              </div>
              <div>
                <Label>Test Cost ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.testCost}
                  onChange={(e) => setFormData({ ...formData, testCost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Result Parameters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Test Results</Label>
                <Button type="button" variant="outline" size="sm" onClick={addResultRow}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Parameter
                </Button>
              </div>
              <div className="space-y-2">
                {formData.results.map((result, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Parameter"
                      value={result.parameter}
                      onChange={(e) => updateResultRow(index, "parameter", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={result.value}
                      onChange={(e) => updateResultRow(index, "value", e.target.value)}
                      className="w-24"
                    />
                    <Input
                      placeholder="Unit"
                      value={result.unit}
                      onChange={(e) => updateResultRow(index, "unit", e.target.value)}
                      className="w-20"
                    />
                    <Select
                      value={result.status}
                      onValueChange={(v) => updateResultRow(index, "status", v)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.results.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeResultRow(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Overall Result</Label>
              <Select
                value={formData.overallResult}
                onValueChange={(v) => setFormData({ ...formData, overallResult: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESULT_STATUS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Interpretation / Notes</Label>
              <Textarea
                value={formData.interpretation}
                onChange={(e) => setFormData({ ...formData, interpretation: e.target.value })}
                placeholder="Clinical interpretation of results..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Result Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Lab Result Details</DialogTitle>
          </DialogHeader>
          
          {selectedResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Animal</Label>
                  <p className="font-medium">{getAnimalName(selectedResult.animalId)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Test Type</Label>
                  <p className="font-medium capitalize">{selectedResult.testType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Test Name</Label>
                  <p className="font-medium">{selectedResult.testName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Lab</Label>
                  <p className="font-medium">{selectedResult.labName || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Sample Date</Label>
                  <p className="font-medium">
                    {selectedResult.sampleCollectionDate 
                      ? format(new Date(selectedResult.sampleCollectionDate), "MMM d, yyyy")
                      : "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Overall Result</Label>
                  <Badge
                    variant={
                      selectedResult.overallResult === "critical" ? "destructive" :
                      selectedResult.overallResult === "abnormal" ? "secondary" : "default"
                    }
                    className={selectedResult.overallResult === "normal" ? "bg-green-500" : ""}
                  >
                    {selectedResult.overallResult || "Pending"}
                  </Badge>
                </div>
              </div>

              {selectedResult.results && (selectedResult.results as any[]).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Test Parameters</Label>
                  <div className="mt-2 border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parameter</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedResult.results as any[]).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>{r.parameter}</TableCell>
                            <TableCell>{r.value} {r.unit}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {r.status || "—"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {selectedResult.interpretation && (
                <div>
                  <Label className="text-muted-foreground">Interpretation</Label>
                  <p className="mt-1 text-sm">{selectedResult.interpretation}</p>
                </div>
              )}

              {selectedResult.testCost && (
                <div>
                  <Label className="text-muted-foreground">Test Cost</Label>
                  <p className="font-medium">${parseFloat(selectedResult.testCost).toFixed(2)}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => selectedResult && deleteMutation.mutate(selectedResult.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
