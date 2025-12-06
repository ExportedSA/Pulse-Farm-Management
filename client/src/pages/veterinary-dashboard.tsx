import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format, differenceInDays } from "date-fns";
import { 
  Stethoscope, Calendar, Plus, FileText, Pill, DollarSign, 
  Clock, User, Phone, Mail, AlertTriangle, CheckCircle, FlaskConical
} from "lucide-react";
import type { Veterinarian, VetVisit, LabResult, Prescription, Animal } from "@shared/schema";

export default function VeterinaryDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showVetDialog, setShowVetDialog] = useState(false);
  const [showVisitDialog, setShowVisitDialog] = useState(false);
  const [showLabDialog, setShowLabDialog] = useState(false);
  const [showPrescriptionDialog, setShowPrescriptionDialog] = useState(false);

  // Form states
  const [newVet, setNewVet] = useState({
    name: "",
    clinicName: "",
    email: "",
    phone: "",
    mobile: "",
    emergencyAvailable: false,
    notes: "",
  });

  const [newVisit, setNewVisit] = useState({
    veterinarianId: "",
    scheduledDate: format(new Date(), "yyyy-MM-dd"),
    scheduledTime: "09:00",
    visitType: "routine" as "routine" | "emergency" | "pregnancy_check" | "herd_health" | "surgery" | "consultation" | "follow_up",
    reason: "",
    estimatedDuration: "60",
    isHerdWide: false,
  });

  const [newLabResult, setNewLabResult] = useState({
    animalId: "",
    testType: "blood" as "blood" | "milk" | "fecal" | "urine" | "tissue" | "swab" | "other",
    testName: "",
    labName: "",
    sampleCollectionDate: format(new Date(), "yyyy-MM-dd"),
    sampleId: "",
  });

  const [newPrescription, setNewPrescription] = useState({
    animalId: "",
    veterinarianId: "",
    medicationName: "",
    dosage: "",
    frequency: "",
    route: "injection",
    duration: "",
    prescriptionDate: format(new Date(), "yyyy-MM-dd"),
    startDate: format(new Date(), "yyyy-MM-dd"),
    meatWithholdingDays: "",
    milkWithholdingDays: "",
    instructions: "",
  });

  // Fetch data
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  const { data: veterinarians = [], isLoading: loadingVets } = useQuery<Veterinarian[]>({
    queryKey: ["/api/veterinary/vets"],
    queryFn: async () => {
      const res = await fetch("/api/veterinary/vets");
      if (!res.ok) throw new Error("Failed to fetch veterinarians");
      return res.json();
    },
  });

  const { data: visits = [], isLoading: loadingVisits } = useQuery<VetVisit[]>({
    queryKey: ["/api/veterinary/visits"],
    queryFn: async () => {
      const res = await fetch("/api/veterinary/visits");
      if (!res.ok) throw new Error("Failed to fetch visits");
      return res.json();
    },
  });

  const { data: upcomingVisits = [] } = useQuery<VetVisit[]>({
    queryKey: ["/api/veterinary/visits/upcoming"],
    queryFn: async () => {
      const res = await fetch("/api/veterinary/visits/upcoming?days=14");
      if (!res.ok) throw new Error("Failed to fetch upcoming visits");
      return res.json();
    },
  });

  const { data: labResults = [], isLoading: loadingLabs } = useQuery<LabResult[]>({
    queryKey: ["/api/veterinary/lab-results"],
    queryFn: async () => {
      const res = await fetch("/api/veterinary/lab-results");
      if (!res.ok) throw new Error("Failed to fetch lab results");
      return res.json();
    },
  });

  const { data: pendingLabs = [] } = useQuery<LabResult[]>({
    queryKey: ["/api/veterinary/lab-results/pending"],
    queryFn: async () => {
      const res = await fetch("/api/veterinary/lab-results/pending");
      if (!res.ok) throw new Error("Failed to fetch pending labs");
      return res.json();
    },
  });

  const { data: prescriptions = [], isLoading: loadingRx } = useQuery<Prescription[]>({
    queryKey: ["/api/veterinary/prescriptions"],
    queryFn: async () => {
      const res = await fetch("/api/veterinary/prescriptions");
      if (!res.ok) throw new Error("Failed to fetch prescriptions");
      return res.json();
    },
  });

  const { data: activePrescriptions = [] } = useQuery<Prescription[]>({
    queryKey: ["/api/veterinary/prescriptions/active"],
    queryFn: async () => {
      const res = await fetch("/api/veterinary/prescriptions/active");
      if (!res.ok) throw new Error("Failed to fetch active prescriptions");
      return res.json();
    },
  });

  const { data: costSummary } = useQuery<{
    totalCosts: number;
    consultationCosts: number;
    medicationCosts: number;
    procedureCosts: number;
    labTestCosts: number;
    travelCosts: number;
    visitCount: number;
  }>({
    queryKey: ["/api/veterinary/costs/summary"],
    queryFn: async () => {
      const res = await fetch("/api/veterinary/costs/summary?days=30");
      if (!res.ok) throw new Error("Failed to fetch cost summary");
      return res.json();
    },
  });

  // Mutations
  const createVetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/veterinary/vets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create veterinarian");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/veterinary"] });
      setShowVetDialog(false);
      resetVetForm();
      toast.success("Veterinarian added");
    },
    onError: () => toast.error("Failed to add veterinarian"),
  });

  const createVisitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/veterinary/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create visit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/veterinary"] });
      setShowVisitDialog(false);
      resetVisitForm();
      toast.success("Visit scheduled");
    },
    onError: () => toast.error("Failed to schedule visit"),
  });

  const createLabMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["/api/veterinary"] });
      setShowLabDialog(false);
      resetLabForm();
      toast.success("Lab test recorded");
    },
    onError: () => toast.error("Failed to record lab test"),
  });

  const createPrescriptionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/veterinary/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create prescription");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/veterinary"] });
      setShowPrescriptionDialog(false);
      resetPrescriptionForm();
      toast.success("Prescription created");
    },
    onError: () => toast.error("Failed to create prescription"),
  });

  const resetVetForm = () => {
    setNewVet({ name: "", clinicName: "", email: "", phone: "", mobile: "", emergencyAvailable: false, notes: "" });
  };

  const resetVisitForm = () => {
    setNewVisit({
      veterinarianId: "", scheduledDate: format(new Date(), "yyyy-MM-dd"), scheduledTime: "09:00",
      visitType: "routine", reason: "", estimatedDuration: "60", isHerdWide: false,
    });
  };

  const resetLabForm = () => {
    setNewLabResult({
      animalId: "", testType: "blood", testName: "", labName: "",
      sampleCollectionDate: format(new Date(), "yyyy-MM-dd"), sampleId: "",
    });
  };

  const resetPrescriptionForm = () => {
    setNewPrescription({
      animalId: "", veterinarianId: "", medicationName: "", dosage: "", frequency: "",
      route: "injection", duration: "", prescriptionDate: format(new Date(), "yyyy-MM-dd"),
      startDate: format(new Date(), "yyyy-MM-dd"), meatWithholdingDays: "", milkWithholdingDays: "", instructions: "",
    });
  };

  const handleCreateVet = () => {
    if (!newVet.name) { toast.error("Please enter vet name"); return; }
    createVetMutation.mutate(newVet);
  };

  const handleCreateVisit = () => {
    if (!newVisit.scheduledDate) { toast.error("Please select a date"); return; }
    createVisitMutation.mutate({
      ...newVisit,
      estimatedDuration: parseInt(newVisit.estimatedDuration) || 60,
      createdBy: user?.id,
    });
  };

  const handleCreateLab = () => {
    if (!newLabResult.testName) { toast.error("Please enter test name"); return; }
    createLabMutation.mutate({ ...newLabResult, orderedBy: user?.id });
  };

  const handleCreatePrescription = () => {
    if (!newPrescription.medicationName || !newPrescription.dosage) {
      toast.error("Please enter medication and dosage"); return;
    }
    createPrescriptionMutation.mutate({
      ...newPrescription,
      meatWithholdingDays: newPrescription.meatWithholdingDays ? parseInt(newPrescription.meatWithholdingDays) : null,
      milkWithholdingDays: newPrescription.milkWithholdingDays ? parseInt(newPrescription.milkWithholdingDays) : null,
      createdBy: user?.id,
    });
  };

  const getAnimalName = (animalId: string | null) => {
    if (!animalId) return "N/A";
    const animal = animals.find(a => a.id === animalId);
    return animal?.cowId || animal?.naitTag || animalId.slice(0, 8);
  };

  const getVetName = (vetId: string | null) => {
    if (!vetId) return "Unknown";
    const vet = veterinarians.find(v => v.id === vetId);
    return vet?.name || vetId.slice(0, 8);
  };

  const getVisitStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Stethoscope className="h-8 w-8 text-blue-600" />
            Veterinary Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Vet visits, lab results, prescriptions, and cost tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showVisitDialog} onOpenChange={setShowVisitDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Visit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Schedule Vet Visit</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Veterinarian</Label>
                  <Select value={newVisit.veterinarianId} onValueChange={(v) => setNewVisit({ ...newVisit, veterinarianId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select vet" /></SelectTrigger>
                    <SelectContent>
                      {veterinarians.map((vet) => (
                        <SelectItem key={vet.id} value={vet.id}>{vet.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date *</Label>
                    <Input type="date" value={newVisit.scheduledDate} onChange={(e) => setNewVisit({ ...newVisit, scheduledDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input type="time" value={newVisit.scheduledTime} onChange={(e) => setNewVisit({ ...newVisit, scheduledTime: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Visit Type</Label>
                    <Select value={newVisit.visitType} onValueChange={(v) => setNewVisit({ ...newVisit, visitType: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine">Routine</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="pregnancy_check">Pregnancy Check</SelectItem>
                        <SelectItem value="herd_health">Herd Health</SelectItem>
                        <SelectItem value="surgery">Surgery</SelectItem>
                        <SelectItem value="consultation">Consultation</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Duration (min)</Label>
                    <Input type="number" value={newVisit.estimatedDuration} onChange={(e) => setNewVisit({ ...newVisit, estimatedDuration: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Reason</Label>
                  <Textarea value={newVisit.reason} onChange={(e) => setNewVisit({ ...newVisit, reason: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowVisitDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreateVisit} disabled={createVisitMutation.isPending}>
                    {createVisitMutation.isPending ? "Scheduling..." : "Schedule Visit"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Visits</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{upcomingVisits.length}</div>
            <p className="text-xs text-muted-foreground">Next 14 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Labs</CardTitle>
            <FlaskConical className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingLabs.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting results</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Rx</CardTitle>
            <Pill className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activePrescriptions.length}</div>
            <p className="text-xs text-muted-foreground">Current prescriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">30-Day Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ${costSummary?.totalCosts?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">{costSummary?.visitCount || 0} visits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Veterinarians</CardTitle>
            <User className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{veterinarians.length}</div>
            <p className="text-xs text-muted-foreground">Registered vets</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="visits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visits">
            <Calendar className="h-4 w-4 mr-2" />
            Visits
          </TabsTrigger>
          <TabsTrigger value="labs">
            <FlaskConical className="h-4 w-4 mr-2" />
            Lab Results
          </TabsTrigger>
          <TabsTrigger value="prescriptions">
            <Pill className="h-4 w-4 mr-2" />
            Prescriptions
          </TabsTrigger>
          <TabsTrigger value="vets">
            <User className="h-4 w-4 mr-2" />
            Veterinarians
          </TabsTrigger>
          <TabsTrigger value="costs">
            <DollarSign className="h-4 w-4 mr-2" />
            Costs
          </TabsTrigger>
        </TabsList>

        {/* Visits Tab */}
        <TabsContent value="visits" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Visits</CardTitle>
                <CardDescription>Scheduled appointments</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingVisits.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No upcoming visits</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {upcomingVisits.map((visit) => {
                      const daysUntil = differenceInDays(new Date(visit.scheduledDate), new Date());
                      return (
                        <div key={visit.id} className={`p-3 border rounded-lg ${daysUntil <= 1 ? 'border-blue-300 bg-blue-50' : ''}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{getVetName(visit.veterinarianId)}</div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(visit.scheduledDate), 'MMM d, yyyy')} {visit.scheduledTime && `at ${visit.scheduledTime}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge className={`capitalize ${getVisitStatusColor(visit.status)}`}>
                                {visit.status.replace('_', ' ')}
                              </Badge>
                              <div className="text-xs text-muted-foreground mt-1 capitalize">
                                {visit.visitType.replace('_', ' ')}
                              </div>
                            </div>
                          </div>
                          {visit.reason && (
                            <p className="text-sm text-muted-foreground mt-2">{visit.reason}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Visits</CardTitle>
                <CardDescription>Completed appointments</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingVisits ? (
                  <Skeleton className="h-32 w-full" />
                ) : visits.filter(v => v.status === 'completed').length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No completed visits</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {visits.filter(v => v.status === 'completed').slice(0, 10).map((visit) => (
                      <div key={visit.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{getVetName(visit.veterinarianId)}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(visit.scheduledDate), 'MMM d, yyyy')}
                            </div>
                          </div>
                          <div className="text-right">
                            {visit.totalCost && (
                              <div className="font-medium">${parseFloat(visit.totalCost).toFixed(2)}</div>
                            )}
                            <div className="text-xs text-muted-foreground capitalize">
                              {visit.visitType.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                        {visit.diagnosis && (
                          <p className="text-sm mt-2"><strong>Diagnosis:</strong> {visit.diagnosis}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Lab Results Tab */}
        <TabsContent value="labs" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showLabDialog} onOpenChange={setShowLabDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Record Lab Test</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Lab Test</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Animal</Label>
                    <Select value={newLabResult.animalId} onValueChange={(v) => setNewLabResult({ ...newLabResult, animalId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select animal" /></SelectTrigger>
                      <SelectContent>
                        {animals.filter(a => a.status === 'active').map((animal) => (
                          <SelectItem key={animal.id} value={animal.id}>
                            {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Test Type *</Label>
                      <Select value={newLabResult.testType} onValueChange={(v) => setNewLabResult({ ...newLabResult, testType: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blood">Blood</SelectItem>
                          <SelectItem value="milk">Milk</SelectItem>
                          <SelectItem value="fecal">Fecal</SelectItem>
                          <SelectItem value="urine">Urine</SelectItem>
                          <SelectItem value="tissue">Tissue</SelectItem>
                          <SelectItem value="swab">Swab</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Collection Date</Label>
                      <Input type="date" value={newLabResult.sampleCollectionDate} onChange={(e) => setNewLabResult({ ...newLabResult, sampleCollectionDate: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Test Name *</Label>
                    <Input value={newLabResult.testName} onChange={(e) => setNewLabResult({ ...newLabResult, testName: e.target.value })} placeholder="e.g., Complete Blood Count" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Lab Name</Label>
                      <Input value={newLabResult.labName} onChange={(e) => setNewLabResult({ ...newLabResult, labName: e.target.value })} />
                    </div>
                    <div>
                      <Label>Sample ID</Label>
                      <Input value={newLabResult.sampleId} onChange={(e) => setNewLabResult({ ...newLabResult, sampleId: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowLabDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreateLab} disabled={createLabMutation.isPending}>
                      {createLabMutation.isPending ? "Recording..." : "Record Test"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Pending Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingLabs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No pending lab results</p>
                ) : (
                  <div className="space-y-3">
                    {pendingLabs.map((lab) => (
                      <div key={lab.id} className="p-3 border border-orange-200 bg-orange-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{lab.testName}</div>
                            <div className="text-sm text-muted-foreground">
                              {getAnimalName(lab.animalId)} • {format(new Date(lab.sampleCollectionDate), 'MMM d')}
                            </div>
                          </div>
                          <Badge variant="outline" className="capitalize">{lab.testType}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Results</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingLabs ? (
                  <Skeleton className="h-32 w-full" />
                ) : labResults.filter(l => l.status === 'completed').length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No completed lab results</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {labResults.filter(l => l.status === 'completed').slice(0, 8).map((lab) => (
                      <div key={lab.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{lab.testName}</div>
                            <div className="text-sm text-muted-foreground">
                              {getAnimalName(lab.animalId)}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={lab.overallResult === 'normal' ? 'default' : 'destructive'} className="capitalize">
                              {lab.overallResult || 'Completed'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Prescriptions Tab */}
        <TabsContent value="prescriptions" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showPrescriptionDialog} onOpenChange={setShowPrescriptionDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />New Prescription</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Create Prescription</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Animal</Label>
                      <Select value={newPrescription.animalId} onValueChange={(v) => setNewPrescription({ ...newPrescription, animalId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {animals.filter(a => a.status === 'active').map((animal) => (
                            <SelectItem key={animal.id} value={animal.id}>
                              {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Veterinarian</Label>
                      <Select value={newPrescription.veterinarianId} onValueChange={(v) => setNewPrescription({ ...newPrescription, veterinarianId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {veterinarians.map((vet) => (
                            <SelectItem key={vet.id} value={vet.id}>{vet.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Medication Name *</Label>
                    <Input value={newPrescription.medicationName} onChange={(e) => setNewPrescription({ ...newPrescription, medicationName: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Dosage *</Label>
                      <Input value={newPrescription.dosage} onChange={(e) => setNewPrescription({ ...newPrescription, dosage: e.target.value })} placeholder="e.g., 10ml" />
                    </div>
                    <div>
                      <Label>Frequency</Label>
                      <Input value={newPrescription.frequency} onChange={(e) => setNewPrescription({ ...newPrescription, frequency: e.target.value })} placeholder="e.g., twice daily" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Route</Label>
                      <Select value={newPrescription.route} onValueChange={(v) => setNewPrescription({ ...newPrescription, route: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="oral">Oral</SelectItem>
                          <SelectItem value="injection">Injection</SelectItem>
                          <SelectItem value="topical">Topical</SelectItem>
                          <SelectItem value="intramammary">Intramammary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Duration</Label>
                      <Input value={newPrescription.duration} onChange={(e) => setNewPrescription({ ...newPrescription, duration: e.target.value })} placeholder="e.g., 7 days" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Meat Withholding (days)</Label>
                      <Input type="number" value={newPrescription.meatWithholdingDays} onChange={(e) => setNewPrescription({ ...newPrescription, meatWithholdingDays: e.target.value })} />
                    </div>
                    <div>
                      <Label>Milk Withholding (days)</Label>
                      <Input type="number" value={newPrescription.milkWithholdingDays} onChange={(e) => setNewPrescription({ ...newPrescription, milkWithholdingDays: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Instructions</Label>
                    <Textarea value={newPrescription.instructions} onChange={(e) => setNewPrescription({ ...newPrescription, instructions: e.target.value })} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowPrescriptionDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreatePrescription} disabled={createPrescriptionMutation.isPending}>
                      {createPrescriptionMutation.isPending ? "Creating..." : "Create Prescription"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active Prescriptions</CardTitle>
              <CardDescription>Current medication regimens</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRx ? (
                <Skeleton className="h-32 w-full" />
              ) : activePrescriptions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active prescriptions</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activePrescriptions.map((rx) => (
                    <div key={rx.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{rx.medicationName}</div>
                        <Badge variant="default">Active</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Animal: {getAnimalName(rx.animalId)}</div>
                        <div>Dosage: {rx.dosage} {rx.frequency && `• ${rx.frequency}`}</div>
                        {rx.route && <div className="capitalize">Route: {rx.route}</div>}
                        {rx.endDate && <div>Until: {format(new Date(rx.endDate), 'MMM d')}</div>}
                        {(rx.meatWithholdingDays || rx.milkWithholdingDays) && (
                          <div className="text-orange-600 font-medium">
                            Withholding: {rx.meatWithholdingDays && `Meat ${rx.meatWithholdingDays}d`}
                            {rx.meatWithholdingDays && rx.milkWithholdingDays && ' / '}
                            {rx.milkWithholdingDays && `Milk ${rx.milkWithholdingDays}d`}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Veterinarians Tab */}
        <TabsContent value="vets" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showVetDialog} onOpenChange={setShowVetDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Veterinarian</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Veterinarian</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name *</Label>
                      <Input value={newVet.name} onChange={(e) => setNewVet({ ...newVet, name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Clinic Name</Label>
                      <Input value={newVet.clinicName} onChange={(e) => setNewVet({ ...newVet, clinicName: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Phone</Label>
                      <Input value={newVet.phone} onChange={(e) => setNewVet({ ...newVet, phone: e.target.value })} />
                    </div>
                    <div>
                      <Label>Mobile</Label>
                      <Input value={newVet.mobile} onChange={(e) => setNewVet({ ...newVet, mobile: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={newVet.email} onChange={(e) => setNewVet({ ...newVet, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={newVet.notes} onChange={(e) => setNewVet({ ...newVet, notes: e.target.value })} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowVetDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreateVet} disabled={createVetMutation.isPending}>
                      {createVetMutation.isPending ? "Adding..." : "Add Veterinarian"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Registered Veterinarians</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingVets ? (
                <Skeleton className="h-32 w-full" />
              ) : veterinarians.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No veterinarians registered</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {veterinarians.map((vet) => (
                    <div key={vet.id} className="p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{vet.name}</div>
                          {vet.clinicName && <div className="text-sm text-muted-foreground">{vet.clinicName}</div>}
                          <div className="mt-2 space-y-1 text-sm">
                            {vet.phone && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-3 w-3" /> {vet.phone}
                              </div>
                            )}
                            {vet.email && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-3 w-3" /> {vet.email}
                              </div>
                            )}
                          </div>
                          {vet.emergencyAvailable && (
                            <Badge variant="outline" className="mt-2 text-green-600">Emergency Available</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Consultation Fees</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${costSummary?.consultationCosts?.toFixed(2) || '0.00'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Medication Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${costSummary?.medicationCosts?.toFixed(2) || '0.00'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Procedure Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${costSummary?.procedureCosts?.toFixed(2) || '0.00'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Lab Test Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${costSummary?.labTestCosts?.toFixed(2) || '0.00'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Travel Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${costSummary?.travelCosts?.toFixed(2) || '0.00'}</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total (30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">${costSummary?.totalCosts?.toFixed(2) || '0.00'}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
