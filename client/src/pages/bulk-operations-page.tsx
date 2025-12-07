import { useState, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { 
  Users, CheckSquare, Trash2, MapPin, FolderPlus, Upload, Download,
  Loader2, Search, AlertTriangle, CheckCircle2, XCircle, RefreshCw
} from "lucide-react";
import type { Animal, AnimalGroup, Pasture } from "@shared/schema";

export default function BulkOperationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [selectedAnimals, setSelectedAnimals] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  
  // Dialog states
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showPastureDialog, setShowPastureDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // Form states
  const [newStatus, setNewStatus] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [groupAction, setGroupAction] = useState<"add" | "remove">("add");
  const [selectedPastureId, setSelectedPastureId] = useState<string>("");
  const [hardDelete, setHardDelete] = useState(false);
  const [importData, setImportData] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);

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

  // Fetch pastures
  const { data: pastures = [] } = useQuery<Pasture[]>({
    queryKey: ["/api/pastures"],
    queryFn: async () => {
      const res = await fetch("/api/pastures");
      if (!res.ok) throw new Error("Failed to fetch pastures");
      return res.json();
    },
  });

  // Filter animals
  const filteredAnimals = useMemo(() => {
    let filtered = animals;
    
    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter(a => a.status === statusFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.cowId?.toLowerCase().includes(query) ||
        a.naitTag?.toLowerCase().includes(query) ||
        a.eid?.toLowerCase().includes(query) ||
        a.breed?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [animals, statusFilter, searchQuery]);

  // Bulk status mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async (data: { animalIds: string[]; status: string }) => {
      const res = await fetch("/api/bulk/animals/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
      setShowStatusDialog(false);
      setSelectedAnimals([]);
    },
    onError: () => toast.error("Failed to update status"),
  });

  // Bulk group mutation
  const bulkGroupMutation = useMutation({
    mutationFn: async (data: { animalIds: string[]; groupId: string; action: string }) => {
      const res = await fetch("/api/bulk/animals/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update group");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setShowGroupDialog(false);
      setSelectedAnimals([]);
    },
    onError: () => toast.error("Failed to update group"),
  });

  // Bulk pasture mutation
  const bulkPastureMutation = useMutation({
    mutationFn: async (data: { animalIds: string[]; pastureId: string; movedBy?: string }) => {
      const res = await fetch("/api/bulk/animals/pasture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to move to pasture");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
      setShowPastureDialog(false);
      setSelectedAnimals([]);
    },
    onError: () => toast.error("Failed to move to pasture"),
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (data: { animalIds: string[]; hardDelete: boolean }) => {
      const res = await fetch("/api/bulk/animals/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
      setShowDeleteDialog(false);
      setSelectedAnimals([]);
    },
    onError: () => toast.error("Failed to delete"),
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: { animals: any[]; updateExisting: boolean }) => {
      const res = await fetch("/api/bulk/animals/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to import");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
      setShowImportDialog(false);
      setImportData("");
    },
    onError: () => toast.error("Failed to import"),
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (data: { animalIds?: string[]; format: string }) => {
      const res = await fetch("/api/bulk/animals/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to export");
      
      if (data.format === "csv") {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "animals-export.csv";
        a.click();
        window.URL.revokeObjectURL(url);
        return { success: true };
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Export complete");
    },
    onError: () => toast.error("Failed to export"),
  });

  // Toggle animal selection
  const toggleAnimal = (animalId: string) => {
    setSelectedAnimals(prev => 
      prev.includes(animalId) 
        ? prev.filter(id => id !== animalId)
        : [...prev, animalId]
    );
  };

  // Select all filtered
  const selectAllFiltered = () => {
    const filteredIds = filteredAnimals.map(a => a.id);
    const allSelected = filteredIds.every(id => selectedAnimals.includes(id));
    
    if (allSelected) {
      setSelectedAnimals(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedAnimals(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // Parse CSV import
  const parseImportData = () => {
    try {
      const lines = importData.trim().split("\n");
      if (lines.length < 2) {
        toast.error("CSV must have header row and at least one data row");
        return null;
      }
      
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const animals = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        const animal: Record<string, any> = {};
        
        headers.forEach((header, idx) => {
          const value = values[idx];
          if (value) {
            // Map common header names
            if (header === "cowid" || header === "cow_id" || header === "id") {
              animal.cowId = value;
            } else if (header === "naittag" || header === "nait_tag" || header === "nait") {
              animal.naitTag = value;
            } else if (header === "eid" || header === "rfid") {
              animal.eid = value;
            } else if (header === "breed") {
              animal.breed = value;
            } else if (header === "sex" || header === "gender") {
              animal.sex = value.toLowerCase() === "m" || value.toLowerCase() === "male" ? "male" : "female";
            } else if (header === "dob" || header === "dateofbirth" || header === "date_of_birth" || header === "birthdate") {
              animal.dateOfBirth = value;
            } else if (header === "status") {
              animal.status = value.toLowerCase();
            }
          }
        });
        
        if (Object.keys(animal).length > 0) {
          animals.push(animal);
        }
      }
      
      return animals;
    } catch (e) {
      toast.error("Failed to parse CSV data");
      return null;
    }
  };

  const handleImport = () => {
    const animals = parseImportData();
    if (animals && animals.length > 0) {
      importMutation.mutate({ animals, updateExisting });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CheckSquare className="h-8 w-8 text-indigo-600" />
            Bulk Operations
          </h1>
          <p className="text-muted-foreground mt-1">
            Perform bulk actions on multiple animals at once
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={() => exportMutation.mutate({ 
              animalIds: selectedAnimals.length > 0 ? selectedAnimals : undefined,
              format: "csv" 
            })}
            disabled={exportMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Selection Stats */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {selectedAnimals.length} selected
              </Badge>
              <span className="text-muted-foreground">
                of {filteredAnimals.length} animals
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAnimals([])}
                disabled={selectedAnimals.length === 0}
              >
                Clear Selection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllFiltered}
              >
                {filteredAnimals.every(a => selectedAnimals.includes(a.id)) 
                  ? "Deselect All" 
                  : "Select All"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedAnimals.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardHeader>
            <CardTitle>Bulk Actions</CardTitle>
            <CardDescription>
              Apply actions to {selectedAnimals.length} selected animals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => setShowStatusDialog(true)}
              >
                <RefreshCw className="h-6 w-6" />
                <span>Change Status</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => setShowGroupDialog(true)}
              >
                <FolderPlus className="h-6 w-6" />
                <span>Assign Group</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => setShowPastureDialog(true)}
              >
                <MapPin className="h-6 w-6" />
                <span>Move to Pasture</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col items-center gap-2 text-red-600 hover:text-red-700"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-6 w-6" />
                <span>Delete/Archive</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search animals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="deceased">Deceased</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Animals Table */}
      <Card>
        <CardContent className="p-0">
          {loadingAnimals ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : filteredAnimals.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No animals found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={filteredAnimals.length > 0 && filteredAnimals.every(a => selectedAnimals.includes(a.id))}
                        onCheckedChange={selectAllFiltered}
                      />
                    </TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>NAIT Tag</TableHead>
                    <TableHead>Breed</TableHead>
                    <TableHead>Sex</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnimals.map((animal) => (
                    <TableRow 
                      key={animal.id}
                      className={selectedAnimals.includes(animal.id) ? "bg-indigo-50" : ""}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={selectedAnimals.includes(animal.id)}
                          onCheckedChange={() => toggleAnimal(animal.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {animal.cowId || animal.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{animal.naitTag || "—"}</TableCell>
                      <TableCell>{animal.breed || "—"}</TableCell>
                      <TableCell>{animal.sex || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={
                          animal.status === "active" ? "default" :
                          animal.status === "sold" ? "secondary" : "destructive"
                        }>
                          {animal.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Change Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>
              Update status for {selectedAnimals.length} animals
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="deceased">Deceased</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => bulkStatusMutation.mutate({ animalIds: selectedAnimals, status: newStatus })}
              disabled={!newStatus || bulkStatusMutation.isPending}
            >
              {bulkStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Group</DialogTitle>
            <DialogDescription>
              Add or remove {selectedAnimals.length} animals from a group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Action</Label>
              <Select value={groupAction} onValueChange={(v: "add" | "remove") => setGroupAction(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add to Group</SelectItem>
                  <SelectItem value="remove">Remove from Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Group</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => bulkGroupMutation.mutate({ 
                animalIds: selectedAnimals, 
                groupId: selectedGroupId,
                action: groupAction 
              })}
              disabled={!selectedGroupId || bulkGroupMutation.isPending}
            >
              {bulkGroupMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {groupAction === "add" ? "Add to Group" : "Remove from Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to Pasture Dialog */}
      <Dialog open={showPastureDialog} onOpenChange={setShowPastureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Pasture</DialogTitle>
            <DialogDescription>
              Move {selectedAnimals.length} animals to a pasture
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Destination Pasture</Label>
              <Select value={selectedPastureId} onValueChange={setSelectedPastureId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pasture" />
                </SelectTrigger>
                <SelectContent>
                  {pastures.map((pasture) => (
                    <SelectItem key={pasture.id} value={pasture.id}>
                      {pasture.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPastureDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => bulkPastureMutation.mutate({ 
                animalIds: selectedAnimals, 
                pastureId: selectedPastureId,
                movedBy: user?.id 
              })}
              disabled={!selectedPastureId || bulkPastureMutation.isPending}
            >
              {bulkPastureMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Move Animals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete/Archive Animals</DialogTitle>
            <DialogDescription>
              This will affect {selectedAnimals.length} animals
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="hardDelete"
                checked={hardDelete}
                onCheckedChange={(checked) => setHardDelete(checked as boolean)}
              />
              <Label htmlFor="hardDelete" className="text-red-600">
                Permanently delete (cannot be undone)
              </Label>
            </div>
            {!hardDelete && (
              <p className="text-sm text-muted-foreground">
                Animals will be marked as "deceased" but can be restored later.
              </p>
            )}
            {hardDelete && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Warning: This action cannot be undone!</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate({ 
                animalIds: selectedAnimals, 
                hardDelete 
              })}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {hardDelete ? "Delete Permanently" : "Archive Animals"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Animals from CSV</DialogTitle>
            <DialogDescription>
              Paste CSV data with headers: cowId, naitTag, eid, breed, sex, dateOfBirth, status
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>CSV Data</Label>
              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="cowId,naitTag,breed,sex,dateOfBirth&#10;COW001,123-456-789,Holstein,female,2020-01-15&#10;COW002,123-456-790,Jersey,female,2019-06-20"
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="updateExisting"
                checked={updateExisting}
                onCheckedChange={(checked) => setUpdateExisting(checked as boolean)}
              />
              <Label htmlFor="updateExisting">
                Update existing animals if ID matches
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!importData.trim() || importMutation.isPending}
            >
              {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
