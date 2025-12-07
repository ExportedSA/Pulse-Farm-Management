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
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Shield, CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw,
  Upload, Download, Search, Plus, Truck, Skull, ArrowRightLeft,
  FileText, Users, Loader2, ChevronRight, AlertCircle, Settings
} from "lucide-react";
import type { Animal } from "@shared/schema";

interface NaitRecord {
  id: string;
  animalId: string;
  naitTag: string;
  registrationDate: string;
  status: "registered" | "pending" | "error";
  lastSyncDate: string | null;
}

interface NaitQueueItem {
  id: string;
  animalId: string | null;
  actionType: string;
  payload: any;
  status: string;
  attempts: number;
  lastAttempt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface NaitStatus {
  records: {
    total: number;
    registered: number;
    pending: number;
    errors: number;
  };
  queue: {
    total: number;
    pending: number;
    failed: number;
    completed: number;
  };
  lastSync: string | null;
}

export default function NaitCompliancePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnimals, setSelectedAnimals] = useState<string[]>([]);
  
  // Dialog states
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [showDeathDialog, setShowDeathDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showBulkRegisterDialog, setShowBulkRegisterDialog] = useState(false);
  
  // Form states
  const [movementForm, setMovementForm] = useState({
    movementDate: format(new Date(), "yyyy-MM-dd"),
    fromLocation: "",
    toLocation: "",
    reason: "",
  });
  
  const [deathForm, setDeathForm] = useState({
    animalId: "",
    deathDate: format(new Date(), "yyyy-MM-dd"),
    cause: "",
    disposalMethod: "",
  });
  
  const [transferForm, setTransferForm] = useState({
    transferDate: format(new Date(), "yyyy-MM-dd"),
    transferType: "sale" as "sale" | "purchase",
    otherPartyNait: "",
    otherPartyName: "",
    price: "",
  });

  // Fetch NAIT status
  const { data: naitStatus, isLoading: loadingStatus } = useQuery<NaitStatus>({
    queryKey: ["/api/nait/status"],
    queryFn: async () => {
      const res = await fetch("/api/nait/status");
      if (!res.ok) throw new Error("Failed to fetch NAIT status");
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
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

  // Fetch NAIT records
  const { data: naitRecords = [] } = useQuery<NaitRecord[]>({
    queryKey: ["/api/nait/records"],
    queryFn: async () => {
      const res = await fetch("/api/nait/records");
      if (!res.ok) throw new Error("Failed to fetch NAIT records");
      return res.json();
    },
  });

  // Fetch unregistered animals
  const { data: unregisteredAnimals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/nait/unregistered"],
    queryFn: async () => {
      const res = await fetch("/api/nait/unregistered");
      if (!res.ok) throw new Error("Failed to fetch unregistered animals");
      return res.json();
    },
  });

  // Fetch queue
  const { data: queueItems = [] } = useQuery<NaitQueueItem[]>({
    queryKey: ["/api/nait/queue"],
    queryFn: async () => {
      const res = await fetch("/api/nait/queue");
      if (!res.ok) throw new Error("Failed to fetch NAIT queue");
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: { animalId: string; naitTag: string }) => {
      const res = await fetch("/api/nait/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to register");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Registration queued");
      queryClient.invalidateQueries({ queryKey: ["/api/nait"] });
      setShowRegisterDialog(false);
    },
    onError: () => toast.error("Failed to register animal"),
  });

  // Bulk register mutation
  const bulkRegisterMutation = useMutation({
    mutationFn: async (animalIds: string[]) => {
      const res = await fetch("/api/nait/bulk-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalIds }),
      });
      if (!res.ok) throw new Error("Failed to bulk register");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Bulk registration queued for ${data.results?.length || 0} animals`);
      queryClient.invalidateQueries({ queryKey: ["/api/nait"] });
      setShowBulkRegisterDialog(false);
      setSelectedAnimals([]);
    },
    onError: () => toast.error("Failed to bulk register"),
  });

  // Movement mutation
  const movementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/nait/movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to record movement");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Movement recorded");
      queryClient.invalidateQueries({ queryKey: ["/api/nait"] });
      setShowMovementDialog(false);
      setSelectedAnimals([]);
    },
    onError: () => toast.error("Failed to record movement"),
  });

  // Death mutation
  const deathMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/nait/death", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to record death");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Death notification queued");
      queryClient.invalidateQueries({ queryKey: ["/api/nait"] });
      setShowDeathDialog(false);
    },
    onError: () => toast.error("Failed to record death"),
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/nait/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to record transfer");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Transfer recorded");
      queryClient.invalidateQueries({ queryKey: ["/api/nait"] });
      setShowTransferDialog(false);
      setSelectedAnimals([]);
    },
    onError: () => toast.error("Failed to record transfer"),
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/nait/sync", { method: "POST" });
      if (!res.ok) throw new Error("Failed to sync");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.processed} items`);
      queryClient.invalidateQueries({ queryKey: ["/api/nait"] });
    },
    onError: () => toast.error("Sync failed"),
  });

  // Retry queue item mutation
  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/nait/queue/${id}/retry`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to retry");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Retry queued");
      queryClient.invalidateQueries({ queryKey: ["/api/nait/queue"] });
    },
  });

  // Filter animals
  const filteredAnimals = useMemo(() => {
    if (!searchQuery) return animals.filter(a => a.status === "active");
    const query = searchQuery.toLowerCase();
    return animals.filter(a => 
      a.status === "active" && (
        a.cowId?.toLowerCase().includes(query) ||
        a.naitTag?.toLowerCase().includes(query) ||
        a.eid?.toLowerCase().includes(query)
      )
    );
  }, [animals, searchQuery]);

  // Get animal name
  const getAnimalName = (animalId: string | null) => {
    if (!animalId) return "Unknown";
    const animal = animals.find(a => a.id === animalId);
    return animal?.cowId || animal?.naitTag || animalId.slice(0, 8);
  };

  // Toggle animal selection
  const toggleAnimalSelection = (animalId: string) => {
    setSelectedAnimals(prev => 
      prev.includes(animalId) 
        ? prev.filter(id => id !== animalId)
        : [...prev, animalId]
    );
  };

  // Select all filtered animals
  const selectAllFiltered = () => {
    const filteredIds = filteredAnimals.map(a => a.id);
    setSelectedAnimals(prev => {
      const allSelected = filteredIds.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !filteredIds.includes(id));
      }
      return Array.from(new Set([...prev, ...filteredIds]));
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-green-600" />
            NAIT Compliance
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage NAIT registrations, movements, and compliance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync with NAIT
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Registered</p>
                <p className="text-3xl font-bold text-green-600">
                  {naitStatus?.records.registered || 0}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {naitStatus?.records.pending || 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-3xl font-bold text-red-600">
                  {naitStatus?.records.errors || 0}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unregistered</p>
                <p className="text-3xl font-bold text-orange-600">
                  {unregisteredAnimals.length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Queue</p>
                <p className="text-3xl font-bold text-blue-600">
                  {naitStatus?.queue.pending || 0}
                </p>
              </div>
              <Upload className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common NAIT operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setShowBulkRegisterDialog(true)}
            >
              <Users className="h-6 w-6" />
              <span>Bulk Register</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setShowMovementDialog(true)}
            >
              <Truck className="h-6 w-6" />
              <span>Record Movement</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setShowDeathDialog(true)}
            >
              <Skull className="h-6 w-6" />
              <span>Report Death</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setShowTransferDialog(true)}
            >
              <ArrowRightLeft className="h-6 w-6" />
              <span>Record Transfer</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="unregistered">
            Unregistered ({unregisteredAnimals.length})
          </TabsTrigger>
          <TabsTrigger value="records">All Records</TabsTrigger>
          <TabsTrigger value="queue">
            Queue ({queueItems.filter(q => q.status === "pending").length})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Compliance Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Registration Rate</span>
                    <span className="font-medium">
                      {animals.length > 0 
                        ? Math.round((naitStatus?.records.registered || 0) / animals.filter(a => a.status === "active").length * 100)
                        : 0}%
                    </span>
                  </div>
                  <Progress 
                    value={animals.length > 0 
                      ? (naitStatus?.records.registered || 0) / animals.filter(a => a.status === "active").length * 100
                      : 0} 
                  />
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Last Sync</p>
                  <p className="font-medium">
                    {naitStatus?.lastSync 
                      ? format(new Date(naitStatus.lastSync), "PPp")
                      : "Never"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Queue Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {queueItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                ) : (
                  <div className="space-y-2">
                    {queueItems.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            item.status === "completed" ? "default" :
                            item.status === "failed" ? "destructive" : "secondary"
                          }>
                            {item.status}
                          </Badge>
                          <span className="text-sm capitalize">{item.actionType.replace("_", " ")}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.createdAt), "MMM d, HH:mm")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Compliance Alerts */}
          {unregisteredAnimals.length > 0 && (
            <Card className="border-orange-500 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-800">
                      {unregisteredAnimals.length} animals require NAIT registration
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      These animals have NAIT tags but are not yet registered in the NAIT system.
                    </p>
                    <Button 
                      className="mt-3" 
                      size="sm"
                      onClick={() => {
                        setSelectedAnimals(unregisteredAnimals.map(a => a.id));
                        setShowBulkRegisterDialog(true);
                      }}
                    >
                      Register All
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Unregistered Tab */}
        <TabsContent value="unregistered" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search animals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {selectedAnimals.length > 0 && (
              <Button onClick={() => setShowBulkRegisterDialog(true)}>
                Register Selected ({selectedAnimals.length})
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {unregisteredAnimals.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p className="font-medium">All animals are registered!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={unregisteredAnimals.every(a => selectedAnimals.includes(a.id))}
                          onCheckedChange={() => {
                            if (unregisteredAnimals.every(a => selectedAnimals.includes(a.id))) {
                              setSelectedAnimals([]);
                            } else {
                              setSelectedAnimals(unregisteredAnimals.map(a => a.id));
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Animal ID</TableHead>
                      <TableHead>NAIT Tag</TableHead>
                      <TableHead>EID</TableHead>
                      <TableHead>Breed</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unregisteredAnimals.map((animal) => (
                      <TableRow key={animal.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedAnimals.includes(animal.id)}
                            onCheckedChange={() => toggleAnimalSelection(animal.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {animal.cowId || "—"}
                        </TableCell>
                        <TableCell>{animal.naitTag || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {animal.eid || "—"}
                        </TableCell>
                        <TableCell>{animal.breed || "—"}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (animal.naitTag) {
                                registerMutation.mutate({
                                  animalId: animal.id,
                                  naitTag: animal.naitTag,
                                });
                              } else {
                                toast.error("Animal has no NAIT tag");
                              }
                            }}
                            disabled={!animal.naitTag || registerMutation.isPending}
                          >
                            Register
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

        {/* Records Tab */}
        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {naitRecords.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No NAIT records yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Animal</TableHead>
                      <TableHead>NAIT Tag</TableHead>
                      <TableHead>Registration Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Sync</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {naitRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {getAnimalName(record.animalId)}
                        </TableCell>
                        <TableCell>{record.naitTag}</TableCell>
                        <TableCell>
                          {format(new Date(record.registrationDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            record.status === "registered" ? "default" :
                            record.status === "error" ? "destructive" : "secondary"
                          } className={record.status === "registered" ? "bg-green-500" : ""}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.lastSyncDate 
                            ? format(new Date(record.lastSyncDate), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {queueItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>Queue is empty</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Animal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="capitalize">
                          {item.actionType.replace("_", " ")}
                        </TableCell>
                        <TableCell>{getAnimalName(item.animalId)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            item.status === "completed" ? "default" :
                            item.status === "failed" ? "destructive" : "secondary"
                          } className={item.status === "completed" ? "bg-green-500" : ""}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.attempts}</TableCell>
                        <TableCell>
                          {format(new Date(item.createdAt), "MMM d, HH:mm")}
                        </TableCell>
                        <TableCell>
                          {item.status === "failed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => retryMutation.mutate(item.id)}
                            >
                              Retry
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
        </TabsContent>
      </Tabs>

      {/* Bulk Register Dialog */}
      <Dialog open={showBulkRegisterDialog} onOpenChange={setShowBulkRegisterDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Register Animals</DialogTitle>
            <DialogDescription>
              Register {selectedAnimals.length} selected animals with NAIT
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will queue registration requests for all selected animals that have NAIT tags.
            </p>
            <div className="max-h-48 overflow-y-auto border rounded p-2">
              {selectedAnimals.map(id => {
                const animal = animals.find(a => a.id === id);
                return (
                  <div key={id} className="flex justify-between py-1 text-sm">
                    <span>{animal?.cowId || animal?.naitTag || id.slice(0, 8)}</span>
                    <span className="text-muted-foreground">{animal?.naitTag || "No tag"}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkRegisterDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => bulkRegisterMutation.mutate(selectedAnimals)}
              disabled={bulkRegisterMutation.isPending}
            >
              {bulkRegisterMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Register All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Movement</DialogTitle>
            <DialogDescription>
              Record animal movement between locations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Movement Date</Label>
              <Input
                type="date"
                value={movementForm.movementDate}
                onChange={(e) => setMovementForm({ ...movementForm, movementDate: e.target.value })}
              />
            </div>
            <div>
              <Label>From Location (NAIT Number)</Label>
              <Input
                value={movementForm.fromLocation}
                onChange={(e) => setMovementForm({ ...movementForm, fromLocation: e.target.value })}
                placeholder="e.g., 12345-12345"
              />
            </div>
            <div>
              <Label>To Location (NAIT Number)</Label>
              <Input
                value={movementForm.toLocation}
                onChange={(e) => setMovementForm({ ...movementForm, toLocation: e.target.value })}
                placeholder="e.g., 67890-67890"
              />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input
                value={movementForm.reason}
                onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                placeholder="e.g., Grazing, Sale, etc."
              />
            </div>
            <div>
              <Label>Selected Animals ({selectedAnimals.length})</Label>
              {selectedAnimals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Select animals from the list first</p>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {selectedAnimals.slice(0, 3).map(id => getAnimalName(id)).join(", ")}
                  {selectedAnimals.length > 3 && ` +${selectedAnimals.length - 3} more`}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMovementDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => movementMutation.mutate({
                animalIds: selectedAnimals,
                ...movementForm,
              })}
              disabled={movementMutation.isPending || selectedAnimals.length === 0}
            >
              {movementMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Movement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Death Dialog */}
      <Dialog open={showDeathDialog} onOpenChange={setShowDeathDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Death</DialogTitle>
            <DialogDescription>
              Notify NAIT of an animal death
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Animal</Label>
              <Select
                value={deathForm.animalId}
                onValueChange={(v) => setDeathForm({ ...deathForm, animalId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select animal" />
                </SelectTrigger>
                <SelectContent>
                  {animals.filter(a => a.status === "active").map((animal) => (
                    <SelectItem key={animal.id} value={animal.id}>
                      {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Death Date</Label>
              <Input
                type="date"
                value={deathForm.deathDate}
                onChange={(e) => setDeathForm({ ...deathForm, deathDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Cause of Death</Label>
              <Input
                value={deathForm.cause}
                onChange={(e) => setDeathForm({ ...deathForm, cause: e.target.value })}
                placeholder="e.g., Disease, Accident, etc."
              />
            </div>
            <div>
              <Label>Disposal Method</Label>
              <Select
                value={deathForm.disposalMethod}
                onValueChange={(v) => setDeathForm({ ...deathForm, disposalMethod: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="burial">Burial</SelectItem>
                  <SelectItem value="rendering">Rendering</SelectItem>
                  <SelectItem value="incineration">Incineration</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeathDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => deathMutation.mutate(deathForm)}
              disabled={deathMutation.isPending || !deathForm.animalId}
            >
              {deathMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Report Death
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Transfer</DialogTitle>
            <DialogDescription>
              Record sale or purchase of animals
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Transfer Type</Label>
              <Select
                value={transferForm.transferType}
                onValueChange={(v: "sale" | "purchase") => setTransferForm({ ...transferForm, transferType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Sale (Transfer Out)</SelectItem>
                  <SelectItem value="purchase">Purchase (Transfer In)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Transfer Date</Label>
              <Input
                type="date"
                value={transferForm.transferDate}
                onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Other Party NAIT Number</Label>
              <Input
                value={transferForm.otherPartyNait}
                onChange={(e) => setTransferForm({ ...transferForm, otherPartyNait: e.target.value })}
                placeholder="e.g., 12345-12345"
              />
            </div>
            <div>
              <Label>Other Party Name (optional)</Label>
              <Input
                value={transferForm.otherPartyName}
                onChange={(e) => setTransferForm({ ...transferForm, otherPartyName: e.target.value })}
                placeholder="Buyer/Seller name"
              />
            </div>
            <div>
              <Label>Price (optional)</Label>
              <Input
                type="number"
                value={transferForm.price}
                onChange={(e) => setTransferForm({ ...transferForm, price: e.target.value })}
                placeholder="Total price"
              />
            </div>
            <div>
              <Label>Selected Animals ({selectedAnimals.length})</Label>
              {selectedAnimals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Select animals from the list first</p>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {selectedAnimals.slice(0, 3).map(id => getAnimalName(id)).join(", ")}
                  {selectedAnimals.length > 3 && ` +${selectedAnimals.length - 3} more`}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => transferMutation.mutate({
                animalIds: selectedAnimals,
                ...transferForm,
                price: transferForm.price ? parseFloat(transferForm.price) : undefined,
              })}
              disabled={transferMutation.isPending || selectedAnimals.length === 0}
            >
              {transferMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
