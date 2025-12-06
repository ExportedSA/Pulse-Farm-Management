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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format, addDays, differenceInDays } from "date-fns";
import { 
  Syringe, Calendar, AlertTriangle, CheckCircle2, Clock, 
  Plus, Users, TrendingUp, Shield, Droplets
} from "lucide-react";
import type { VaccinationSchedule, AnimalGroup, Product, AnimalTreatment } from "@shared/schema";

export default function VaccinationDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Form state for new schedule
  const [newSchedule, setNewSchedule] = useState({
    programName: "",
    programType: "vaccination" as "vaccination" | "drench",
    groupId: "",
    vaccineProductId: "",
    scheduledDate: format(new Date(), "yyyy-MM-dd"),
    frequencyMonths: "",
    targetAgeMonths: "",
    doseAmount: "",
    doseUnit: "ml",
    description: "",
  });

  // Fetch all vaccination schedules
  const { data: schedules = [], isLoading: loadingSchedules } = useQuery<VaccinationSchedule[]>({
    queryKey: ["/api/vaccination/schedules"],
    queryFn: async () => {
      const res = await fetch("/api/vaccination/schedules");
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return res.json();
    },
  });

  // Fetch upcoming vaccinations
  const { data: upcomingVaccinations = [], isLoading: loadingUpcoming } = useQuery<VaccinationSchedule[]>({
    queryKey: ["/api/vaccination/upcoming"],
    queryFn: async () => {
      const res = await fetch("/api/vaccination/upcoming?days=30");
      if (!res.ok) throw new Error("Failed to fetch upcoming vaccinations");
      return res.json();
    },
  });

  // Fetch animal groups
  const { data: groups = [] } = useQuery<AnimalGroup[]>({
    queryKey: ["/api/groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
  });

  // Fetch products (vaccines)
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  // Fetch vaccination records for coverage calculation
  const { data: vaccinationRecords = [] } = useQuery<AnimalTreatment[]>({
    queryKey: ["/api/vaccination/records/group", selectedGroupId],
    queryFn: async () => {
      if (!selectedGroupId) return [];
      const res = await fetch(`/api/vaccination/records/group/${selectedGroupId}`);
      if (!res.ok) throw new Error("Failed to fetch vaccination records");
      return res.json();
    },
    enabled: !!selectedGroupId,
  });

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      const res = await fetch("/api/vaccination/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleData),
      });
      if (!res.ok) throw new Error("Failed to create schedule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vaccination/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vaccination/upcoming"] });
      setShowScheduleDialog(false);
      resetForm();
      toast.success("Vaccination schedule created successfully");
    },
    onError: () => {
      toast.error("Failed to create vaccination schedule");
    },
  });

  const resetForm = () => {
    setNewSchedule({
      programName: "",
      programType: "vaccination",
      groupId: "",
      vaccineProductId: "",
      scheduledDate: format(new Date(), "yyyy-MM-dd"),
      frequencyMonths: "",
      targetAgeMonths: "",
      doseAmount: "",
      doseUnit: "ml",
      description: "",
    });
  };

  const handleCreateSchedule = () => {
    if (!newSchedule.programName || !newSchedule.groupId || !newSchedule.vaccineProductId) {
      toast.error("Please fill in all required fields");
      return;
    }

    createScheduleMutation.mutate({
      ...newSchedule,
      frequencyMonths: newSchedule.frequencyMonths ? parseInt(newSchedule.frequencyMonths) : null,
      targetAgeMonths: newSchedule.targetAgeMonths ? parseInt(newSchedule.targetAgeMonths) : null,
      doseAmount: newSchedule.doseAmount ? parseFloat(newSchedule.doseAmount) : null,
      nextDueDate: newSchedule.scheduledDate,
      isActive: true,
      createdBy: user?.id,
    });
  };

  // Calculate summary statistics
  const activeSchedules = schedules.filter(s => s.isActive);
  const vaccinationSchedules = schedules.filter(s => s.programType === "vaccination");
  const drenchSchedules = schedules.filter(s => s.programType === "drench");
  
  const overdueSchedules = upcomingVaccinations.filter(s => {
    if (!s.nextDueDate) return false;
    return new Date(s.nextDueDate) < new Date();
  });

  const dueSoon = upcomingVaccinations.filter(s => {
    if (!s.nextDueDate) return false;
    const dueDate = new Date(s.nextDueDate);
    const today = new Date();
    return dueDate >= today && differenceInDays(dueDate, today) <= 7;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Vaccination & Preventive Health
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage vaccination schedules, drench programs, and track herd immunity
          </p>
        </div>
        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Vaccination Schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Program Name *</Label>
                  <Input
                    placeholder="e.g., Annual Clostridial Vaccination"
                    value={newSchedule.programName}
                    onChange={(e) => setNewSchedule({ ...newSchedule, programName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Program Type *</Label>
                  <Select
                    value={newSchedule.programType}
                    onValueChange={(v) => setNewSchedule({ ...newSchedule, programType: v as "vaccination" | "drench" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vaccination">Vaccination</SelectItem>
                      <SelectItem value="drench">Drench/Parasite Control</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Animal Group *</Label>
                  <Select
                    value={newSchedule.groupId}
                    onValueChange={(v) => setNewSchedule({ ...newSchedule, groupId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
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
                <div className="col-span-2">
                  <Label>Vaccine/Product *</Label>
                  <Select
                    value={newSchedule.vaccineProductId}
                    onValueChange={(v) => setNewSchedule({ ...newSchedule, vaccineProductId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Scheduled Date *</Label>
                  <Input
                    type="date"
                    value={newSchedule.scheduledDate}
                    onChange={(e) => setNewSchedule({ ...newSchedule, scheduledDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Repeat Every (months)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 12"
                    value={newSchedule.frequencyMonths}
                    onChange={(e) => setNewSchedule({ ...newSchedule, frequencyMonths: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Dose Amount</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 2.0"
                    value={newSchedule.doseAmount}
                    onChange={(e) => setNewSchedule({ ...newSchedule, doseAmount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Dose Unit</Label>
                  <Select
                    value={newSchedule.doseUnit}
                    onValueChange={(v) => setNewSchedule({ ...newSchedule, doseUnit: v })}
                  >
                    <SelectTrigger>
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
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Additional notes about this program..."
                    value={newSchedule.description}
                    onChange={(e) => setNewSchedule({ ...newSchedule, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSchedule} disabled={createScheduleMutation.isPending}>
                  {createScheduleMutation.isPending ? "Creating..." : "Create Schedule"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Programs</CardTitle>
            <Syringe className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSchedules.length}</div>
            <p className="text-xs text-muted-foreground">
              {vaccinationSchedules.length} vaccinations, {drenchSchedules.length} drenches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due This Week</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{dueSoon.length}</div>
            <p className="text-xs text-muted-foreground">
              Vaccinations due in next 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueSchedules.length}</div>
            <p className="text-xs text-muted-foreground">
              Programs past due date
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Groups Covered</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Set(schedules.map(s => s.groupId)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              of {groups.length} total groups
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">
            <Calendar className="h-4 w-4 mr-2" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="schedules">
            <Syringe className="h-4 w-4 mr-2" />
            All Schedules
          </TabsTrigger>
          <TabsTrigger value="coverage">
            <TrendingUp className="h-4 w-4 mr-2" />
            Herd Coverage
          </TabsTrigger>
        </TabsList>

        {/* Upcoming Tab */}
        <TabsContent value="upcoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Vaccinations (Next 30 Days)</CardTitle>
              <CardDescription>
                Scheduled vaccinations and drench programs due soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUpcoming ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : upcomingVaccinations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No vaccinations scheduled for the next 30 days
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingVaccinations.map((schedule) => {
                    const dueDate = schedule.nextDueDate ? new Date(schedule.nextDueDate) : null;
                    const isOverdue = dueDate && dueDate < new Date();
                    const isDueSoon = dueDate && !isOverdue && differenceInDays(dueDate, new Date()) <= 7;
                    const group = groups.find(g => g.id === schedule.groupId);
                    const product = products.find(p => p.id === schedule.vaccineProductId);

                    return (
                      <div
                        key={schedule.id}
                        className={`p-4 border rounded-lg ${
                          isOverdue ? "border-red-200 bg-red-50" :
                          isDueSoon ? "border-yellow-200 bg-yellow-50" :
                          "border-gray-200"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{schedule.programName}</span>
                              <Badge variant={schedule.programType === "vaccination" ? "default" : "secondary"}>
                                {schedule.programType === "vaccination" ? (
                                  <><Syringe className="h-3 w-3 mr-1" /> Vaccination</>
                                ) : (
                                  <><Droplets className="h-3 w-3 mr-1" /> Drench</>
                                )}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Group: {group?.name || "Unknown"} • Product: {product?.name || "Unknown"}
                            </div>
                            {schedule.doseAmount && (
                              <div className="text-sm text-muted-foreground">
                                Dose: {schedule.doseAmount} {schedule.doseUnit}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`font-medium ${
                              isOverdue ? "text-red-600" :
                              isDueSoon ? "text-yellow-600" :
                              "text-gray-600"
                            }`}>
                              {dueDate ? format(dueDate, "MMM d, yyyy") : "No date"}
                            </div>
                            {isOverdue && (
                              <Badge variant="destructive" className="mt-1">
                                <AlertTriangle className="h-3 w-3 mr-1" /> Overdue
                              </Badge>
                            )}
                            {isDueSoon && !isOverdue && (
                              <Badge variant="outline" className="mt-1 text-yellow-600 border-yellow-600">
                                <Clock className="h-3 w-3 mr-1" /> Due Soon
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Schedules Tab */}
        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Vaccination Schedules</CardTitle>
              <CardDescription>
                Manage your vaccination and drench programs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSchedules ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-8">
                  <Syringe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No vaccination schedules yet</p>
                  <Button onClick={() => setShowScheduleDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Schedule
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map((schedule) => {
                    const group = groups.find(g => g.id === schedule.groupId);
                    const product = products.find(p => p.id === schedule.vaccineProductId);

                    return (
                      <div key={schedule.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{schedule.programName}</span>
                              <Badge variant={schedule.programType === "vaccination" ? "default" : "secondary"}>
                                {schedule.programType}
                              </Badge>
                              {!schedule.isActive && (
                                <Badge variant="outline">Inactive</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Group: {group?.name || "Unknown"} • Product: {product?.name || "Unknown"}
                            </div>
                            {schedule.frequencyMonths && (
                              <div className="text-sm text-muted-foreground">
                                Repeats every {schedule.frequencyMonths} months
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm">
                              Next: {schedule.nextDueDate ? format(new Date(schedule.nextDueDate), "MMM d, yyyy") : "Not set"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Created {format(new Date(schedule.createdAt), "MMM d, yyyy")}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Herd Coverage Tab */}
        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Herd Vaccination Coverage</CardTitle>
              <CardDescription>
                Select a group to view vaccination coverage and history
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs">
                <Label>Select Animal Group</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
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
                <div className="space-y-4 mt-6">
                  {/* Coverage Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <Syringe className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                          <div className="text-2xl font-bold">
                            {vaccinationRecords.filter(r => r.category === "vaccination").length}
                          </div>
                          <p className="text-sm text-muted-foreground">Vaccinations Given</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <Droplets className="h-8 w-8 mx-auto text-green-600 mb-2" />
                          <div className="text-2xl font-bold">
                            {vaccinationRecords.filter(r => r.category === "drench").length}
                          </div>
                          <p className="text-sm text-muted-foreground">Drenches Given</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <CheckCircle2 className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                          <div className="text-2xl font-bold">
                            {schedules.filter(s => s.groupId === selectedGroupId).length}
                          </div>
                          <p className="text-sm text-muted-foreground">Active Programs</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent Records */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Recent Vaccination Records</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {vaccinationRecords.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                          No vaccination records for this group yet
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {vaccinationRecords.slice(0, 10).map((record) => (
                            <div key={record.id} className="p-3 border rounded-md text-sm">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-medium">{record.treatmentType || "Unknown"}</span>
                                  <Badge variant={record.category === "vaccination" ? "default" : "secondary"} className="ml-2 text-xs">
                                    {record.category}
                                  </Badge>
                                </div>
                                <span className="text-muted-foreground">
                                  {format(new Date(record.dateTime), "MMM d, yyyy")}
                                </span>
                              </div>
                              {record.clinicalNotes && (
                                <p className="text-muted-foreground text-xs mt-1">{record.clinicalNotes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {!selectedGroupId && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select an animal group to view vaccination coverage</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
