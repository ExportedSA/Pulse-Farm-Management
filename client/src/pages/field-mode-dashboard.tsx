import { useState, useRef, useEffect, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { offlineStorage, networkStatus } from "@/utils/offlineStorage";
import { format } from "date-fns";
import { Link } from "wouter";
import { 
  Smartphone, Wifi, WifiOff, Scan, Mic, MicOff, Camera, 
  FileText, Users, Plus, Check, X, Zap, Clock, Upload,
  Search, Database, Image, Trash2, Eye, Download, RefreshCw
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Additional states for enhanced features
  const [showQuickLookup, setShowQuickLookup] = useState(false);
  const [quickLookupQuery, setQuickLookupQuery] = useState("");
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<Array<{ id: string; dataUrl: string; timestamp: Date; animalId?: string }>>([]);
  const [selectedPhotoAnimal, setSelectedPhotoAnimal] = useState<string>("");
  const [offlineAnimalsCount, setOfflineAnimalsCount] = useState(0);
  const [showOfflineData, setShowOfflineData] = useState(false);

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

  // Load offline animals count on mount
  useEffect(() => {
    const loadOfflineCount = async () => {
      const cached = await offlineStorage.getCachedData('animals');
      if (cached) {
        setOfflineAnimalsCount(cached.length);
      }
    };
    loadOfflineCount();
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

  // Cache animals for offline use
  useEffect(() => {
    const cacheAnimalsForOffline = async () => {
      if (animals.length > 0) {
        await offlineStorage.cacheData('animals', animals, 24 * 60 * 60 * 1000); // 24 hours
        setOfflineAnimalsCount(animals.length);
      }
    };
    cacheAnimalsForOffline();
  }, [animals]);

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

  // Quick lookup - search animals by any identifier
  const quickLookupResults = quickLookupQuery.trim() 
    ? animals.filter(a => {
        const query = quickLookupQuery.toLowerCase();
        return (
          a.cowId?.toLowerCase().includes(query) ||
          a.naitTag?.toLowerCase().includes(query) ||
          a.eid?.toLowerCase().includes(query) ||
          a.breed?.toLowerCase().includes(query)
        );
      }).slice(0, 10)
    : [];

  // Photo capture handlers
  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newPhoto = {
          id: `photo_${Date.now()}`,
          dataUrl,
          timestamp: new Date(),
          animalId: selectedPhotoAnimal || undefined,
        };
        setCapturedPhotos(prev => [...prev, newPhoto]);
        toast.success("Photo captured");
        
        // Store in offline storage for later sync
        offlineStorage.cacheData(`photo_${newPhoto.id}`, newPhoto, 7 * 24 * 60 * 60 * 1000);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (event.target) event.target.value = '';
  };

  const deletePhoto = (photoId: string) => {
    setCapturedPhotos(prev => prev.filter(p => p.id !== photoId));
    offlineStorage.removeCachedData(`photo_${photoId}`);
    toast.success("Photo deleted");
  };

  // Get offline animals for lookup when offline
  const getOfflineAnimals = async (): Promise<Animal[]> => {
    const cached = await offlineStorage.getCachedData('animals');
    return cached || [];
  };

  // Offline EID lookup
  const offlineEidLookup = async (eid: string) => {
    const cachedAnimals = await getOfflineAnimals();
    const found = cachedAnimals.find(a => a.eid === eid);
    if (found) {
      if (!scannedAnimals.find(a => a.id === found.id)) {
        setScannedAnimals(prev => [...prev, found]);
        setSelectedAnimals(prev => [...prev, found.id]);
        toast.success(`Found (offline): ${found.cowId || found.naitTag || eid}`);
      } else {
        toast.info("Animal already scanned");
      }
    } else {
      toast.error(`No animal found for EID: ${eid}`);
    }
    setEidInput("");
  };

  // Enhanced EID scan that works offline
  const handleEnhancedEidScan = () => {
    if (!eidInput.trim()) return;
    
    if (isOnline) {
      lookupEidMutation.mutate(eidInput.trim());
    } else {
      offlineEidLookup(eidInput.trim());
    }
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowQuickLookup(true)}>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Search className="h-8 w-8 text-indigo-600 mb-2" />
            <span className="font-medium">Quick Lookup</span>
            <span className="text-xs text-muted-foreground">Find any animal</span>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowPhotoDialog(true)}>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Camera className="h-8 w-8 text-pink-600 mb-2" />
            <span className="font-medium">Photo Capture</span>
            <span className="text-xs text-muted-foreground">Document conditions</span>
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

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowOfflineData(true)}>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Database className="h-8 w-8 text-gray-600 mb-2" />
            <span className="font-medium">Offline Data</span>
            <span className="text-xs text-muted-foreground">{offlineAnimalsCount} animals cached</span>
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
              onKeyDown={(e) => e.key === 'Enter' && handleEnhancedEidScan()}
              className="flex-1"
            />
            <Button onClick={handleEnhancedEidScan} disabled={!eidInput.trim() || lookupEidMutation.isPending}>
              {lookupEidMutation.isPending ? "Looking up..." : isOnline ? "Lookup" : "Lookup (Offline)"}
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

      {/* Quick Lookup Dialog */}
      <Dialog open={showQuickLookup} onOpenChange={setShowQuickLookup}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Quick Animal Lookup
            </DialogTitle>
            <DialogDescription>
              Search by ID, NAIT tag, EID, or breed
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search animals..."
              value={quickLookupQuery}
              onChange={(e) => setQuickLookupQuery(e.target.value)}
              autoFocus
            />
            
            {quickLookupQuery && (
              <ScrollArea className="h-64">
                {quickLookupResults.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No animals found</p>
                ) : (
                  <div className="space-y-2">
                    {quickLookupResults.map((animal) => (
                      <div 
                        key={animal.id}
                        className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          if (!scannedAnimals.find(a => a.id === animal.id)) {
                            setScannedAnimals(prev => [...prev, animal]);
                            setSelectedAnimals(prev => [...prev, animal.id]);
                          }
                          setShowQuickLookup(false);
                          setQuickLookupQuery("");
                          toast.success(`Added: ${animal.cowId || animal.naitTag}`);
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{animal.cowId || animal.naitTag || animal.id.slice(0, 8)}</div>
                            <div className="text-sm text-muted-foreground">
                              {animal.breed} • {animal.sex}
                            </div>
                            {animal.eid && (
                              <div className="text-xs text-muted-foreground">EID: {animal.eid}</div>
                            )}
                          </div>
                          <Badge variant={animal.status === 'active' ? 'default' : 'secondary'}>
                            {animal.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowQuickLookup(false); setQuickLookupQuery(""); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Capture Dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Photo Capture
            </DialogTitle>
            <DialogDescription>
              Take photos to document conditions, injuries, or observations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Animal selection for photo */}
            <div>
              <Label>Associate with Animal (optional)</Label>
              <Select value={selectedPhotoAnimal} onValueChange={setSelectedPhotoAnimal}>
                <SelectTrigger>
                  <SelectValue placeholder="Select animal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No animal</SelectItem>
                  {scannedAnimals.map((animal) => (
                    <SelectItem key={animal.id} value={animal.id}>
                      {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Capture buttons */}
            <div className="flex gap-2">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoCapture}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoCapture}
              />
              <Button onClick={() => cameraInputRef.current?.click()} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                <Image className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>

            {/* Captured photos */}
            {capturedPhotos.length > 0 && (
              <div className="space-y-2">
                <Label>Captured Photos ({capturedPhotos.length})</Label>
                <div className="grid grid-cols-3 gap-2">
                  {capturedPhotos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img 
                        src={photo.dataUrl} 
                        alt="Captured" 
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-white" onClick={() => window.open(photo.dataUrl)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-white" onClick={() => deletePhoto(photo.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {photo.animalId && (
                        <Badge className="absolute bottom-1 left-1 text-xs" variant="secondary">
                          {animals.find(a => a.id === photo.animalId)?.cowId || 'Animal'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPhotoDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offline Data Dialog */}
      <Dialog open={showOfflineData} onOpenChange={setShowOfflineData}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Offline Data
            </DialogTitle>
            <DialogDescription>
              Cached data for offline access
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span>Cached Animals</span>
                <Badge variant="secondary">{offlineAnimalsCount}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Pending Actions</span>
                <Badge variant={pendingActions > 0 ? "default" : "secondary"}>{pendingActions}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Captured Photos</span>
                <Badge variant="secondary">{capturedPhotos.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Connection Status</span>
                <Badge variant={isOnline ? "default" : "destructive"}>
                  {isOnline ? "Online" : "Offline"}
                </Badge>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={async () => {
                  await offlineStorage.cacheData('animals', animals, 24 * 60 * 60 * 1000);
                  setOfflineAnimalsCount(animals.length);
                  toast.success("Animals cached for offline use");
                }}
                disabled={!isOnline}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Cache
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={syncOfflineData}
                disabled={!isOnline || pendingActions === 0}
              >
                <Upload className="h-4 w-4 mr-2" />
                Sync Now
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Offline data is automatically synced when you reconnect to the internet.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfflineData(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
