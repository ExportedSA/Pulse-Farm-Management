import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { offlineStorage, networkStatus } from "@/utils/offlineStorage";
import { format } from "date-fns";
import { 
  Smartphone, Wifi, WifiOff, Scan, Mic, MicOff, Camera, 
  FileText, Users, Plus, Check, X, Zap, Clock, Upload
} from "lucide-react";
import type { Animal, TreatmentTemplate, Product } from "@shared/schema";

export default function FieldModeDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState(0);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [eidInput, setEidInput] = useState("");
  const [scannedAnimals, setScannedAnimals] = useState<Animal[]>([]);
  const [selectedAnimals, setSelectedAnimals] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Form states
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    treatmentType: "",
    category: "treatment" as "treatment" | "vaccination" | "drench",
    productId: "",
    defaultDosage: "",
    route: "injection",
    meatWithholdingDays: "",
    milkWithholdingDays: "",
    isGlobal: false,
  });

  const [batchTreatment, setBatchTreatment] = useState({
    templateId: "",
    treatmentType: "",
    category: "treatment" as "treatment" | "vaccination" | "drench",
    productId: "",
    dosage: "",
    route: "injection",
    treatmentDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check pending actions
    const checkPending = async () => {
      const actions = await offlineStorage.getPendingActions();
      setPendingActions(actions.length);
    };
    checkPending();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch data
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<TreatmentTemplate[]>({
    queryKey: ["/api/mobile/templates", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/mobile/templates?userId=${user?.id}`);
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  // Mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/mobile/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/templates"] });
      setShowTemplateDialog(false);
      resetTemplateForm();
      toast.success("Template created");
    },
    onError: () => toast.error("Failed to create template"),
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/mobile/batch-treatments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create batch treatment");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments"] });
      setShowBatchDialog(false);
      setSelectedAnimals([]);
      setScannedAnimals([]);
      resetBatchForm();
      toast.success(`Batch treatment created for ${data.treatmentsCreated} animals`);
    },
    onError: () => toast.error("Failed to create batch treatment"),
  });

  const lookupEidMutation = useMutation({
    mutationFn: async (eid: string) => {
      const res = await fetch(`/api/mobile/eid/lookup/${eid}`);
      if (!res.ok) throw new Error("Failed to lookup EID");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.matched && data.animal) {
        if (!scannedAnimals.find(a => a.id === data.animal.id)) {
          setScannedAnimals(prev => [...prev, data.animal]);
          setSelectedAnimals(prev => [...prev, data.animal.id]);
          toast.success(`Found: ${data.animal.cowId || data.animal.naitTag || data.eid}`);
        } else {
          toast.info("Animal already scanned");
        }
      } else {
        toast.error(`No animal found for EID: ${data.eid}`);
      }
      setEidInput("");
    },
    onError: () => toast.error("Failed to lookup EID"),
  });

  const resetTemplateForm = () => {
    setNewTemplate({
      name: "", treatmentType: "", category: "treatment", productId: "",
      defaultDosage: "", route: "injection", meatWithholdingDays: "",
      milkWithholdingDays: "", isGlobal: false,
    });
  };

  const resetBatchForm = () => {
    setBatchTreatment({
      templateId: "", treatmentType: "", category: "treatment", productId: "",
      dosage: "", route: "injection", treatmentDate: format(new Date(), "yyyy-MM-dd"), notes: "",
    });
  };

  const handleEidScan = () => {
    if (eidInput.trim()) {
      lookupEidMutation.mutate(eidInput.trim());
    }
  };

  const handleApplyTemplate = (template: TreatmentTemplate) => {
    setBatchTreatment({
      templateId: template.id,
      treatmentType: template.treatmentType,
      category: template.category || "treatment",
      productId: template.productId || "",
      dosage: template.defaultDosage || "",
      route: template.route || "injection",
      treatmentDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    });
    setShowBatchDialog(true);
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.name || !newTemplate.treatmentType) {
      toast.error("Please fill in required fields");
      return;
    }
    createTemplateMutation.mutate({
      ...newTemplate,
      meatWithholdingDays: newTemplate.meatWithholdingDays ? parseInt(newTemplate.meatWithholdingDays) : null,
      milkWithholdingDays: newTemplate.milkWithholdingDays ? parseInt(newTemplate.milkWithholdingDays) : null,
      createdBy: user?.id,
    });
  };

  const handleCreateBatch = () => {
    if (selectedAnimals.length === 0) {
      toast.error("Please select at least one animal");
      return;
    }
    if (!batchTreatment.treatmentType) {
      toast.error("Please select a treatment type");
      return;
    }
    createBatchMutation.mutate({
      ...batchTreatment,
      animalIds: selectedAnimals,
      createdBy: user?.id,
    });
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // In production, upload to storage and save URL
        toast.success(`Voice note recorded (${(audioBlob.size / 1024).toFixed(1)} KB)`);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording started...");
    } catch (error) {
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Sync offline data
  const syncOfflineData = async () => {
    const actions = await offlineStorage.getPendingActions();
    if (actions.length === 0) {
      toast.info("No pending actions to sync");
      return;
    }

    try {
      const res = await fetch("/api/mobile/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions }),
      });
      
      if (res.ok) {
        const result = await res.json();
        // Remove synced actions
        for (const action of actions) {
          await offlineStorage.removePendingAction(action.id);
        }
        setPendingActions(0);
        toast.success(`Synced ${result.successful} actions`);
      }
    } catch (error) {
      toast.error("Sync failed - will retry when online");
    }
  };

  const toggleAnimalSelection = (animalId: string) => {
    setSelectedAnimals(prev => 
      prev.includes(animalId) 
        ? prev.filter(id => id !== animalId)
        : [...prev, animalId]
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with connection status */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Smartphone className="h-8 w-8 text-blue-600" />
            Field Mode
          </h1>
          <p className="text-muted-foreground mt-1">
            Mobile-optimized tools for field work
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span className="text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          
          {/* Pending Actions */}
          {pendingActions > 0 && (
            <Button variant="outline" size="sm" onClick={syncOfflineData} disabled={!isOnline}>
              <Upload className="h-4 w-4 mr-2" />
              Sync ({pendingActions})
            </Button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowBatchDialog(true)}>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Users className="h-8 w-8 text-blue-600 mb-2" />
            <span className="font-medium">Batch Treatment</span>
            <span className="text-xs text-muted-foreground">Treat multiple animals</span>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => document.getElementById('eid-input')?.focus()}>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Scan className="h-8 w-8 text-green-600 mb-2" />
            <span className="font-medium">EID Scanner</span>
            <span className="text-xs text-muted-foreground">Scan ear tags</span>
          </CardContent>
        </Card>

        <Card className={`cursor-pointer hover:bg-muted/50 transition-colors ${isRecording ? 'ring-2 ring-red-500' : ''}`} 
              onClick={isRecording ? stopRecording : startRecording}>
          <CardContent className="p-4 flex flex-col items-center text-center">
            {isRecording ? <MicOff className="h-8 w-8 text-red-600 mb-2" /> : <Mic className="h-8 w-8 text-purple-600 mb-2" />}
            <span className="font-medium">{isRecording ? 'Stop Recording' : 'Voice Note'}</span>
            <span className="text-xs text-muted-foreground">{isRecording ? 'Recording...' : 'Hands-free notes'}</span>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowTemplateDialog(true)}>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Zap className="h-8 w-8 text-orange-600 mb-2" />
            <span className="font-medium">New Template</span>
            <span className="text-xs text-muted-foreground">Quick presets</span>
          </CardContent>
        </Card>
      </div>

      {/* EID Scanner Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-green-600" />
            EID Scanner
          </CardTitle>
          <CardDescription>Scan or enter EID tags to identify animals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              id="eid-input"
              placeholder="Enter or scan EID..."
              value={eidInput}
              onChange={(e) => setEidInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEidScan()}
              className="flex-1"
            />
            <Button onClick={handleEidScan} disabled={!eidInput.trim() || lookupEidMutation.isPending}>
              {lookupEidMutation.isPending ? "Looking up..." : "Lookup"}
            </Button>
          </div>

          {scannedAnimals.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Scanned Animals ({scannedAnimals.length})</span>
                <Button variant="ghost" size="sm" onClick={() => { setScannedAnimals([]); setSelectedAnimals([]); }}>
                  Clear All
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {scannedAnimals.map((animal) => (
                  <div 
                    key={animal.id} 
                    className={`p-2 border rounded-lg cursor-pointer transition-colors ${selectedAnimals.includes(animal.id) ? 'bg-blue-50 border-blue-300' : ''}`}
                    onClick={() => toggleAnimalSelection(animal.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selectedAnimals.includes(animal.id)} />
                      <div>
                        <div className="font-medium text-sm">{animal.cowId || animal.naitTag}</div>
                        <div className="text-xs text-muted-foreground">{animal.breed}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Treatment Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-600" />
            Quick Treatment Templates
          </CardTitle>
          <CardDescription>One-tap treatment presets for common procedures</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTemplates ? (
            <Skeleton className="h-32 w-full" />
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No templates yet. Create your first quick treatment template.</p>
              <Button onClick={() => setShowTemplateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleApplyTemplate(template)}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs text-muted-foreground">{template.treatmentType}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs capitalize">{template.category}</Badge>
                    {template.usageCount && template.usageCount > 0 && (
                      <span className="text-xs text-muted-foreground">Used {template.usageCount}x</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Treatment Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Template Name *</Label>
              <Input 
                value={newTemplate.name} 
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="e.g., Mastitis Treatment"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Treatment Type *</Label>
                <Input 
                  value={newTemplate.treatmentType} 
                  onChange={(e) => setNewTemplate({ ...newTemplate, treatmentType: e.target.value })}
                  placeholder="e.g., Mastitis"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treatment">Treatment</SelectItem>
                    <SelectItem value="vaccination">Vaccination</SelectItem>
                    <SelectItem value="drench">Drench</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Product</Label>
              <Select value={newTemplate.productId} onValueChange={(v) => setNewTemplate({ ...newTemplate, productId: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Default Dosage</Label>
                <Input 
                  value={newTemplate.defaultDosage} 
                  onChange={(e) => setNewTemplate({ ...newTemplate, defaultDosage: e.target.value })}
                  placeholder="e.g., 10ml"
                />
              </div>
              <div>
                <Label>Route</Label>
                <Select value={newTemplate.route} onValueChange={(v) => setNewTemplate({ ...newTemplate, route: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="injection">Injection</SelectItem>
                    <SelectItem value="oral">Oral</SelectItem>
                    <SelectItem value="topical">Topical</SelectItem>
                    <SelectItem value="pour-on">Pour-on</SelectItem>
                    <SelectItem value="intramammary">Intramammary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Meat Withholding (days)</Label>
                <Input 
                  type="number"
                  value={newTemplate.meatWithholdingDays} 
                  onChange={(e) => setNewTemplate({ ...newTemplate, meatWithholdingDays: e.target.value })}
                />
              </div>
              <div>
                <Label>Milk Withholding (days)</Label>
                <Input 
                  type="number"
                  value={newTemplate.milkWithholdingDays} 
                  onChange={(e) => setNewTemplate({ ...newTemplate, milkWithholdingDays: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateTemplate} disabled={createTemplateMutation.isPending}>
                {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Treatment Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Batch Treatment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="font-medium text-blue-800">
                {selectedAnimals.length} animals selected
              </div>
              <div className="text-sm text-blue-600">
                {selectedAnimals.length === 0 ? "Scan EIDs or select animals first" : "Ready for batch treatment"}
              </div>
            </div>

            <div>
              <Label>Use Template</Label>
              <Select value={batchTreatment.templateId} onValueChange={(v) => {
                const template = templates.find(t => t.id === v);
                if (template) handleApplyTemplate(template);
              }}>
                <SelectTrigger><SelectValue placeholder="Select template (optional)" /></SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Treatment Type *</Label>
                <Input 
                  value={batchTreatment.treatmentType} 
                  onChange={(e) => setBatchTreatment({ ...batchTreatment, treatmentType: e.target.value })}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input 
                  type="date"
                  value={batchTreatment.treatmentDate} 
                  onChange={(e) => setBatchTreatment({ ...batchTreatment, treatmentDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Product</Label>
              <Select value={batchTreatment.productId} onValueChange={(v) => setBatchTreatment({ ...batchTreatment, productId: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dosage</Label>
                <Input 
                  value={batchTreatment.dosage} 
                  onChange={(e) => setBatchTreatment({ ...batchTreatment, dosage: e.target.value })}
                />
              </div>
              <div>
                <Label>Route</Label>
                <Select value={batchTreatment.route} onValueChange={(v) => setBatchTreatment({ ...batchTreatment, route: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="injection">Injection</SelectItem>
                    <SelectItem value="oral">Oral</SelectItem>
                    <SelectItem value="topical">Topical</SelectItem>
                    <SelectItem value="pour-on">Pour-on</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea 
                value={batchTreatment.notes} 
                onChange={(e) => setBatchTreatment({ ...batchTreatment, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBatchDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateBatch} disabled={createBatchMutation.isPending || selectedAnimals.length === 0}>
                {createBatchMutation.isPending ? "Creating..." : `Treat ${selectedAnimals.length} Animals`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
