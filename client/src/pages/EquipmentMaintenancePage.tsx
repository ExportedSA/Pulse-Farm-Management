import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { Wrench, Calendar, AlertTriangle, CheckCircle2, Clock, Plus, Filter } from "lucide-react";

interface MaintenanceSchedule {
  id: string;
  equipmentId: string;
  equipmentName: string;
  maintenanceType: string;
  frequency: string;
  lastCompleted?: string;
  nextDue: string;
  status: "overdue" | "due-soon" | "scheduled" | "completed";
  priority: "high" | "medium" | "low";
  estimatedCost?: number;
  notes?: string;
}

export default function EquipmentMaintenancePage() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [newSchedule, setNewSchedule] = useState({
    equipmentId: "",
    maintenanceType: "",
    frequency: "monthly",
    nextDue: "",
    priority: "medium",
    estimatedCost: "",
    notes: "",
  });

  const { data: schedules = [], isLoading } = useQuery<MaintenanceSchedule[]>({
    queryKey: ["/api/equipment/maintenance"],
    queryFn: async () => {
      const res = await fetch("/api/equipment/maintenance");
      if (!res.ok) throw new Error("Failed to fetch maintenance schedules");
      return res.json();
    },
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["/api/equipment"],
    queryFn: async () => {
      const res = await fetch("/api/equipment");
      if (!res.ok) throw new Error("Failed to fetch equipment");
      return res.json();
    },
  });

  const addScheduleMutation = useMutation({
    mutationFn: async (schedule: any) => {
      const res = await fetch("/api/equipment/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      if (!res.ok) throw new Error("Failed to create maintenance schedule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/maintenance"] });
      toast.success("Maintenance schedule created");
      setShowAddDialog(false);
      setNewSchedule({
        equipmentId: "",
        maintenanceType: "",
        frequency: "monthly",
        nextDue: "",
        priority: "medium",
        estimatedCost: "",
        notes: "",
      });
    },
    onError: () => {
      toast.error("Failed to create maintenance schedule");
    },
  });

  const completeMaintenanceMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await fetch(`/api/equipment/maintenance/${scheduleId}/complete`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to complete maintenance");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/maintenance"] });
      toast.success("Maintenance marked as completed");
    },
  });

  const filteredSchedules = schedules.filter((schedule) => {
    if (filterStatus === "all") return true;
    return schedule.status === filterStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      overdue: { variant: "destructive", icon: AlertTriangle },
      "due-soon": { variant: "default", icon: Clock },
      scheduled: { variant: "secondary", icon: Calendar },
      completed: { variant: "outline", icon: CheckCircle2 },
    };
    const config = variants[status] || variants.scheduled;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant as any} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.replace("-", " ")}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-green-100 text-green-800",
    };
    return (
      <Badge className={colors[priority] || colors.medium}>
        {priority}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-semibold">Equipment Maintenance</h1>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Schedule Maintenance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Maintenance</DialogTitle>
                <DialogDescription>
                  Create a new maintenance schedule for equipment
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="equipment">Equipment</Label>
                  <Select
                    value={newSchedule.equipmentId}
                    onValueChange={(value) =>
                      setNewSchedule({ ...newSchedule, equipmentId: value })
                    }
                  >
                    <SelectTrigger id="equipment">
                      <SelectValue placeholder="Select equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipment.map((item: any) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Maintenance Type</Label>
                  <Input
                    id="type"
                    value={newSchedule.maintenanceType}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, maintenanceType: e.target.value })
                    }
                    placeholder="e.g., Oil change, Filter replacement"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={newSchedule.frequency}
                    onValueChange={(value) =>
                      setNewSchedule({ ...newSchedule, frequency: value })
                    }
                  >
                    <SelectTrigger id="frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nextDue">Next Due Date</Label>
                  <Input
                    id="nextDue"
                    type="date"
                    value={newSchedule.nextDue}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, nextDue: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={newSchedule.priority}
                    onValueChange={(value) =>
                      setNewSchedule({ ...newSchedule, priority: value })
                    }
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cost">Estimated Cost ($)</Label>
                  <Input
                    id="cost"
                    type="number"
                    value={newSchedule.estimatedCost}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, estimatedCost: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newSchedule.notes}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, notes: e.target.value })
                    }
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => addScheduleMutation.mutate(newSchedule)}>
                  Create Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schedules</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due-soon">Due Soon</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance Schedules</CardTitle>
            <CardDescription>
              Manage and track equipment maintenance schedules
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredSchedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No maintenance schedules found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Maintenance Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Est. Cost</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {schedule.equipmentName}
                      </TableCell>
                      <TableCell>{schedule.maintenanceType}</TableCell>
                      <TableCell className="capitalize">{schedule.frequency}</TableCell>
                      <TableCell>
                        {format(new Date(schedule.nextDue), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                      <TableCell>{getPriorityBadge(schedule.priority)}</TableCell>
                      <TableCell>
                        {schedule.estimatedCost
                          ? `$${schedule.estimatedCost.toFixed(2)}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {schedule.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => completeMaintenanceMutation.mutate(schedule.id)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
