import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { 
  Syringe, Users, Search, CheckCircle2, XCircle, 
  Plus, Minus, AlertTriangle, ArrowRight, Loader2
} from "lucide-react";
import type { Animal, Product, Condition, AnimalGroup, User, ProductBatch } from "@shared/schema";

export default function BatchTreatmentPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  
  // Selection state
  const [selectedAnimals, setSelectedAnimals] = useState<string[]>([]);
  const [selectionMethod, setSelectionMethod] = useState<"individual" | "group" | "search">("individual");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Treatment details state
  const [treatmentData, setTreatmentData] = useState({
    staffMember: user?.id || "",
    dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    condition: "",
    bodyPart: "",
    treatmentType: "",
    category: "treatment" as "treatment" | "vaccination" | "drench",
    productId: "",
    batchId: "",
    doseAmount: "",
    doseUnit: "ml",
    totalDoses: "1",
    milkWithdrawalDays: "",
    meatWithdrawalDays: "",
    clinicalNotes: "",
    // Cost tracking
    medicineCost: "",
    labourCost: "",
    vetCalloutCost: "",
    otherCosts: "",
  });
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [failedAnimals, setFailedAnimals] = useState<{id: string, name: string, error: string}[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

  // Fetch animals
  const { data: animals = [], isLoading: loadingAnimals } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  // Fetch groups
  const { data: groups = [] } = useQuery<AnimalGroup[]>({
    queryKey: ["/api/groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  // Fetch conditions
  const { data: conditions = [] } = useQuery<Condition[]>({
    queryKey: ["/api/conditions"],
    queryFn: async () => {
      const res = await fetch("/api/conditions");
      if (!res.ok) throw new Error("Failed to fetch conditions");
      return res.json();
    },
  });

  // Fetch users/staff
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  // Fetch product batches when product is selected
  const { data: productBatches = [] } = useQuery<ProductBatch[]>({
    queryKey: ["/api/product-batches", treatmentData.productId],
    queryFn: async () => {
      if (!treatmentData.productId) return [];
      const res = await fetch(`/api/product-batches?productId=${treatmentData.productId}`);
      if (!res.ok) throw new Error("Failed to fetch batches");
      return res.json();
    },
    enabled: !!treatmentData.productId,
  });

  // Filter animals based on search
  const filteredAnimals = useMemo(() => {
    if (!searchQuery) return animals;
    const query = searchQuery.toLowerCase();
    return animals.filter(a => 
      a.cowId?.toLowerCase().includes(query) ||
      a.eid?.toLowerCase().includes(query) ||
      a.naitTag?.toLowerCase().includes(query)
    );
  }, [animals, searchQuery]);

  // Get animals in selected group
  const groupAnimals = useMemo(() => {
    if (!selectedGroupId) return [];
    // For now, return all animals - in production this would filter by group membership
    return animals;
  }, [animals, selectedGroupId]);

  // Toggle animal selection
  const toggleAnimal = (animalId: string) => {
    setSelectedAnimals(prev => 
      prev.includes(animalId) 
        ? prev.filter(id => id !== animalId)
        : [...prev, animalId]
    );
  };

  // Select all visible animals
  const selectAll = () => {
    const visibleAnimals = selectionMethod === "group" ? groupAnimals : filteredAnimals;
    setSelectedAnimals(visibleAnimals.map(a => a.id));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedAnimals([]);
  };

  // Get selected product details
  const selectedProduct = products.find(p => p.id === treatmentData.productId);

  // Process batch treatment
  const processBatchTreatment = async () => {
    if (selectedAnimals.length === 0) {
      toast.error("No animals selected");
      return;
    }

    setIsProcessing(true);
    setProcessedCount(0);
    setFailedAnimals([]);

    const failed: {id: string, name: string, error: string}[] = [];
    let successCount = 0;

    for (const animalId of selectedAnimals) {
      try {
        const animal = animals.find(a => a.id === animalId);
        
        // Calculate total cost
        const medicineCost = treatmentData.medicineCost ? parseFloat(treatmentData.medicineCost) : 0;
        const labourCost = treatmentData.labourCost ? parseFloat(treatmentData.labourCost) : 0;
        const vetCalloutCost = treatmentData.vetCalloutCost ? parseFloat(treatmentData.vetCalloutCost) : 0;
        const otherCosts = treatmentData.otherCosts ? parseFloat(treatmentData.otherCosts) : 0;
        const totalCost = medicineCost + labourCost + vetCalloutCost + otherCosts;

        const treatmentPayload = {
          animalId,
          staffMember: treatmentData.staffMember,
          dateTime: treatmentData.dateTime,
          condition: treatmentData.condition || undefined,
          bodyPart: treatmentData.bodyPart || undefined,
          treatmentType: treatmentData.treatmentType || undefined,
          category: treatmentData.category,
          productId: treatmentData.productId || undefined,
          batchId: treatmentData.batchId || undefined,
          doseAmount: treatmentData.doseAmount ? parseFloat(treatmentData.doseAmount) : undefined,
          doseUnit: treatmentData.doseUnit || undefined,
          totalDoses: treatmentData.totalDoses ? parseInt(treatmentData.totalDoses) : 1,
          dosesGiven: 1,
          milkWithdrawalDays: treatmentData.milkWithdrawalDays ? parseInt(treatmentData.milkWithdrawalDays) : undefined,
          meatWithdrawalDays: treatmentData.meatWithdrawalDays ? parseInt(treatmentData.meatWithdrawalDays) : undefined,
          clinicalNotes: treatmentData.clinicalNotes || undefined,
          status: "active" as const,
          // Cost tracking
          medicineCost: medicineCost > 0 ? medicineCost : undefined,
          labourCost: labourCost > 0 ? labourCost : undefined,
          vetCalloutCost: vetCalloutCost > 0 ? vetCalloutCost : undefined,
          otherCosts: otherCosts > 0 ? otherCosts : undefined,
          totalCost: totalCost > 0 ? totalCost : undefined,
        };

        const res = await fetch("/api/treatments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(treatmentPayload),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to create treatment");
        }

        successCount++;
        setProcessedCount(successCount);
      } catch (error: any) {
        const animal = animals.find(a => a.id === animalId);
        failed.push({
          id: animalId,
          name: animal?.cowId || animal?.naitTag || animalId,
          error: error.message || "Unknown error",
        });
      }
    }

    setFailedAnimals(failed);
    setIsProcessing(false);
    setShowResultsDialog(true);

    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ["/api/treatments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/animals"] });

    if (failed.length === 0) {
      toast.success(`Successfully treated ${successCount} animals`);
    } else {
      toast.warning(`Treated ${successCount} animals, ${failed.length} failed`);
    }
  };

  // Reset form
  const resetForm = () => {
    setCurrentStep(1);
    setSelectedAnimals([]);
    setTreatmentData({
      staffMember: user?.id || "",
      dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      condition: "",
      bodyPart: "",
      treatmentType: "",
      category: "treatment",
      productId: "",
      batchId: "",
      doseAmount: "",
      doseUnit: "ml",
      totalDoses: "1",
      milkWithdrawalDays: "",
      meatWithdrawalDays: "",
      clinicalNotes: "",
      medicineCost: "",
      labourCost: "",
      vetCalloutCost: "",
      otherCosts: "",
    });
    setShowResultsDialog(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8 text-blue-600" />
          Batch Treatment Entry
        </h1>
        <p className="text-muted-foreground mt-1">
          Apply treatments to multiple animals at once
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 py-4">
        <div className={`flex items-center gap-2 ${currentStep >= 1 ? "text-blue-600" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? "bg-blue-600 text-white" : "bg-muted"}`}>
            1
          </div>
          <span className="font-medium">Select Animals</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 ${currentStep >= 2 ? "text-blue-600" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? "bg-blue-600 text-white" : "bg-muted"}`}>
            2
          </div>
          <span className="font-medium">Treatment Details</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 ${currentStep >= 3 ? "text-blue-600" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? "bg-blue-600 text-white" : "bg-muted"}`}>
            3
          </div>
          <span className="font-medium">Review & Apply</span>
        </div>
      </div>

      {/* Step 1: Select Animals */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Select Animals</CardTitle>
            <CardDescription>
              Choose animals to treat using individual selection, by group, or search
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selection Method Tabs */}
            <Tabs value={selectionMethod} onValueChange={(v) => setSelectionMethod(v as any)}>
              <TabsList>
                <TabsTrigger value="individual">Individual Selection</TabsTrigger>
                <TabsTrigger value="group">By Group</TabsTrigger>
                <TabsTrigger value="search">Search</TabsTrigger>
              </TabsList>

              <TabsContent value="individual" className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {selectedAnimals.length} of {animals.length} animals selected
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[400px] border rounded-md p-4">
                  {loadingAnimals ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {animals.map((animal) => (
                        <div
                          key={animal.id}
                          className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50 ${
                            selectedAnimals.includes(animal.id) ? "border-blue-500 bg-blue-50" : ""
                          }`}
                          onClick={() => toggleAnimal(animal.id)}
                        >
                          <Checkbox
                            checked={selectedAnimals.includes(animal.id)}
                            onCheckedChange={() => toggleAnimal(animal.id)}
                          />
                          <div className="flex-1">
                            <div className="font-medium">
                              {animal.cowId || animal.naitTag || "No ID"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {animal.breed} • {animal.sex}
                            </div>
                          </div>
                          {animal.eid && (
                            <Badge variant="outline" className="text-xs">
                              EID: {animal.eid}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="group" className="space-y-4">
                <div>
                  <Label>Select Animal Group</Label>
                  <Select value={selectedGroupId} onValueChange={(v) => {
                    setSelectedGroupId(v);
                    // Auto-select all animals in group
                    const group = groups.find(g => g.id === v);
                    if (group) {
                      // In production, this would fetch group members
                      // For now, we'll let user manually confirm
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedGroupId && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {selectedAnimals.length} animals selected from group
                    </span>
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Select All in Group
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="search" className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by tag, EID, or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <ScrollArea className="h-[350px] border rounded-md p-4">
                  <div className="space-y-2">
                    {filteredAnimals.map((animal) => (
                      <div
                        key={animal.id}
                        className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50 ${
                          selectedAnimals.includes(animal.id) ? "border-blue-500 bg-blue-50" : ""
                        }`}
                        onClick={() => toggleAnimal(animal.id)}
                      >
                        <Checkbox
                          checked={selectedAnimals.includes(animal.id)}
                          onCheckedChange={() => toggleAnimal(animal.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">
                            {animal.cowId || animal.naitTag || "No ID"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {animal.breed} • {animal.sex}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredAnimals.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No animals found matching "{searchQuery}"
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Selected Summary */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {selectedAnimals.length}
                </Badge>
                <span>animals selected</span>
              </div>
              <Button 
                onClick={() => setCurrentStep(2)} 
                disabled={selectedAnimals.length === 0}
              >
                Continue to Treatment Details
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Treatment Details */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Treatment Details</CardTitle>
            <CardDescription>
              Enter the treatment information to apply to {selectedAnimals.length} animals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Staff Member */}
              <div>
                <Label>Staff Member *</Label>
                <Select
                  value={treatmentData.staffMember}
                  onValueChange={(v) => setTreatmentData({ ...treatmentData, staffMember: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date/Time */}
              <div>
                <Label>Date & Time *</Label>
                <Input
                  type="datetime-local"
                  value={treatmentData.dateTime}
                  onChange={(e) => setTreatmentData({ ...treatmentData, dateTime: e.target.value })}
                />
              </div>

              {/* Category */}
              <div>
                <Label>Category *</Label>
                <Select
                  value={treatmentData.category}
                  onValueChange={(v) => setTreatmentData({ ...treatmentData, category: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treatment">Treatment</SelectItem>
                    <SelectItem value="vaccination">Vaccination</SelectItem>
                    <SelectItem value="drench">Drench</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Condition */}
              <div>
                <Label>Condition</Label>
                <Select
                  value={treatmentData.condition}
                  onValueChange={(v) => setTreatmentData({ ...treatmentData, condition: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditions.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product */}
              <div>
                <Label>Product/Medicine</Label>
                <Select
                  value={treatmentData.productId}
                  onValueChange={(v) => {
                    const product = products.find(p => p.id === v);
                    setTreatmentData({ 
                      ...treatmentData, 
                      productId: v,
                      milkWithdrawalDays: product?.milkWithdrawalDays?.toString() || "",
                      meatWithdrawalDays: product?.meatWithdrawalDays?.toString() || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Batch */}
              {treatmentData.productId && productBatches.length > 0 && (
                <div>
                  <Label>Product Batch</Label>
                  <Select
                    value={treatmentData.batchId}
                    onValueChange={(v) => setTreatmentData({ ...treatmentData, batchId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {productBatches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.batchNo} - Exp: {b.expiryDate ? format(new Date(b.expiryDate), "MMM yyyy") : "N/A"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dose Amount */}
              <div>
                <Label>Dose Amount</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 10"
                    value={treatmentData.doseAmount}
                    onChange={(e) => setTreatmentData({ ...treatmentData, doseAmount: e.target.value })}
                    className="flex-1"
                  />
                  <Select
                    value={treatmentData.doseUnit}
                    onValueChange={(v) => setTreatmentData({ ...treatmentData, doseUnit: v })}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="cc">cc</SelectItem>
                      <SelectItem value="mg">mg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Total Doses */}
              <div>
                <Label>Total Doses in Course</Label>
                <Input
                  type="number"
                  min="1"
                  value={treatmentData.totalDoses}
                  onChange={(e) => setTreatmentData({ ...treatmentData, totalDoses: e.target.value })}
                />
              </div>

              {/* Withdrawal Days */}
              <div>
                <Label>Milk Withdrawal (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={treatmentData.milkWithdrawalDays}
                  onChange={(e) => setTreatmentData({ ...treatmentData, milkWithdrawalDays: e.target.value })}
                />
              </div>

              <div>
                <Label>Meat Withdrawal (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={treatmentData.meatWithdrawalDays}
                  onChange={(e) => setTreatmentData({ ...treatmentData, meatWithdrawalDays: e.target.value })}
                />
              </div>
            </div>

            {/* Clinical Notes */}
            <div>
              <Label>Clinical Notes</Label>
              <Textarea
                placeholder="Additional notes about this batch treatment..."
                value={treatmentData.clinicalNotes}
                onChange={(e) => setTreatmentData({ ...treatmentData, clinicalNotes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Cost Tracking */}
            <div className="pt-4 border-t">
              <Label className="text-base font-semibold">Cost Tracking (per animal)</Label>
              <p className="text-sm text-muted-foreground mb-3">Optional: Track costs for financial reporting</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Medicine Cost ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={treatmentData.medicineCost}
                    onChange={(e) => setTreatmentData({ ...treatmentData, medicineCost: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Labour Cost ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={treatmentData.labourCost}
                    onChange={(e) => setTreatmentData({ ...treatmentData, labourCost: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Vet Callout ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={treatmentData.vetCalloutCost}
                    onChange={(e) => setTreatmentData({ ...treatmentData, vetCalloutCost: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Other Costs ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={treatmentData.otherCosts}
                    onChange={(e) => setTreatmentData({ ...treatmentData, otherCosts: e.target.value })}
                  />
                </div>
              </div>
              {(treatmentData.medicineCost || treatmentData.labourCost || treatmentData.vetCalloutCost || treatmentData.otherCosts) && (
                <div className="mt-2 text-sm font-medium text-right">
                  Total per animal: ${(
                    (parseFloat(treatmentData.medicineCost) || 0) +
                    (parseFloat(treatmentData.labourCost) || 0) +
                    (parseFloat(treatmentData.vetCalloutCost) || 0) +
                    (parseFloat(treatmentData.otherCosts) || 0)
                  ).toFixed(2)}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back to Selection
              </Button>
              <Button 
                onClick={() => setCurrentStep(3)}
                disabled={!treatmentData.staffMember}
              >
                Review & Apply
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Apply */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Review & Apply</CardTitle>
            <CardDescription>
              Review the batch treatment before applying to all selected animals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Animals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{selectedAnimals.length}</div>
                  <p className="text-sm text-muted-foreground">animals will be treated</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Treatment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="font-medium">
                      {treatmentData.category.charAt(0).toUpperCase() + treatmentData.category.slice(1)}
                    </div>
                    {selectedProduct && (
                      <div className="text-sm text-muted-foreground">{selectedProduct.name}</div>
                    )}
                    {treatmentData.doseAmount && (
                      <div className="text-sm text-muted-foreground">
                        {treatmentData.doseAmount} {treatmentData.doseUnit} per animal
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Treatment Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Staff:</span>{" "}
                    {users.find(u => u.id === treatmentData.staffMember)?.name || "Unknown"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>{" "}
                    {format(new Date(treatmentData.dateTime), "MMM d, yyyy h:mm a")}
                  </div>
                  {treatmentData.condition && (
                    <div>
                      <span className="text-muted-foreground">Condition:</span>{" "}
                      {treatmentData.condition}
                    </div>
                  )}
                  {treatmentData.milkWithdrawalDays && (
                    <div>
                      <span className="text-muted-foreground">Milk Withdrawal:</span>{" "}
                      {treatmentData.milkWithdrawalDays} days
                    </div>
                  )}
                  {treatmentData.meatWithdrawalDays && (
                    <div>
                      <span className="text-muted-foreground">Meat Withdrawal:</span>{" "}
                      {treatmentData.meatWithdrawalDays} days
                    </div>
                  )}
                </div>
                {treatmentData.clinicalNotes && (
                  <div className="mt-4 pt-4 border-t">
                    <span className="text-muted-foreground text-sm">Notes:</span>
                    <p className="text-sm mt-1">{treatmentData.clinicalNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Warning */}
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <div className="font-medium text-yellow-800">Confirm Batch Treatment</div>
                <p className="text-sm text-yellow-700">
                  This will create {selectedAnimals.length} individual treatment records. 
                  This action cannot be easily undone.
                </p>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Back to Details
              </Button>
              <Button 
                onClick={processBatchTreatment}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing... ({processedCount}/{selectedAnimals.length})
                  </>
                ) : (
                  <>
                    <Syringe className="h-4 w-4 mr-2" />
                    Apply Treatment to {selectedAnimals.length} Animals
                  </>
                )}
              </Button>
            </div>

            {/* Progress during processing */}
            {isProcessing && (
              <div className="space-y-2">
                <Progress value={(processedCount / selectedAnimals.length) * 100} />
                <p className="text-sm text-center text-muted-foreground">
                  Processing {processedCount} of {selectedAnimals.length} animals...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Treatment Complete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{processedCount - failedAnimals.length} Successful</span>
              </div>
              {failedAnimals.length > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">{failedAnimals.length} Failed</span>
                </div>
              )}
            </div>

            {failedAnimals.length > 0 && (
              <div className="border rounded-md p-3 bg-red-50">
                <p className="text-sm font-medium text-red-800 mb-2">Failed Animals:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {failedAnimals.map((f) => (
                    <div key={f.id} className="text-sm text-red-700">
                      {f.name}: {f.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResultsDialog(false)}>
              Close
            </Button>
            <Button onClick={resetForm}>
              Start New Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
