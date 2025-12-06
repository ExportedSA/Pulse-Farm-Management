import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Tag,
  Plus,
  Search,
  Filter,
  Link2,
  Unlink,
  Wrench,
  Battery,
  MapPin,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  History,
  Settings,
  Package,
  Cpu,
  Radio,
  Activity,
  Thermometer,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
} from 'lucide-react';

interface Equipment {
  id: string;
  type: string;
  name: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  status: 'available' | 'assigned' | 'maintenance' | 'lost' | 'retired';
  assignedToAnimalId?: string;
  assignedToAnimalTag?: string;
  assignedToAnimalName?: string;
  assignedAt?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  notes?: string;
  batteryLevel?: number;
  lastReading?: string;
  typeInfo?: { label: string; icon: string; description: string };
}

interface EquipmentStats {
  total: number;
  available: number;
  assigned: number;
  maintenance: number;
  lost: number;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  assigned: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  lost: 'bg-red-100 text-red-800',
  retired: 'bg-gray-100 text-gray-800',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  available: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  assigned: <Link2 className="h-4 w-4 text-blue-600" />,
  maintenance: <Wrench className="h-4 w-4 text-yellow-600" />,
  lost: <XCircle className="h-4 w-4 text-red-600" />,
  retired: <Package className="h-4 w-4 text-gray-600" />,
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ear_tag: <Tag className="h-5 w-5" />,
  collar: <Radio className="h-5 w-5" />,
  sensor: <Cpu className="h-5 w-5" />,
  gps_tracker: <MapPin className="h-5 w-5" />,
  activity_monitor: <Activity className="h-5 w-5" />,
  milk_meter: <Package className="h-5 w-5" />,
  bolus: <Thermometer className="h-5 w-5" />,
  pedometer: <Activity className="h-5 w-5" />,
  rfid_tag: <Radio className="h-5 w-5" />,
  heat_detector: <Thermometer className="h-5 w-5" />,
  other: <Settings className="h-5 w-5" />,
};

// Mock animals for assignment
const MOCK_ANIMALS = [
  { id: 'animal-1', tag: 'NZ-1234', name: 'Daisy' },
  { id: 'animal-2', tag: 'NZ-1235', name: 'Bella' },
  { id: 'animal-3', tag: 'NZ-1236', name: 'Rosie' },
  { id: 'animal-4', tag: 'NZ-1237', name: 'Clover' },
  { id: 'animal-5', tag: 'NZ-1238', name: 'Buttercup' },
  { id: 'animal-6', tag: 'NZ-1239', name: 'Poppy' },
  { id: 'animal-7', tag: 'NZ-1240', name: 'Willow' },
  { id: 'animal-8', tag: 'NZ-1241', name: 'Hazel' },
];

export default function EquipmentPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  // Form states
  const [newEquipment, setNewEquipment] = useState({
    type: 'ear_tag',
    name: '',
    serialNumber: '',
    manufacturer: '',
    model: '',
    purchaseDate: '',
    notes: '',
  });

  const [assignForm, setAssignForm] = useState({
    animalId: '',
    notes: '',
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    type: 'routine',
    description: '',
    cost: '',
    notes: '',
    nextScheduled: '',
  });

  // Fetch equipment
  const { data: equipmentData, isLoading } = useQuery<{ equipment: Equipment[]; stats: EquipmentStats }>({
    queryKey: ['equipment', filterType, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      const res = await fetch(`/api/equipment?${params}`);
      if (!res.ok) throw new Error('Failed to fetch equipment');
      return res.json();
    },
  });

  // Fetch equipment types
  const { data: equipmentTypes = [] } = useQuery<{ id: string; label: string; icon: string }[]>({
    queryKey: ['equipmentTypes'],
    queryFn: async () => {
      const res = await fetch('/api/equipment/types');
      if (!res.ok) throw new Error('Failed to fetch types');
      return res.json();
    },
  });

  // Fetch maintenance due
  const { data: maintenanceDue } = useQuery({
    queryKey: ['maintenanceDue'],
    queryFn: async () => {
      const res = await fetch('/api/equipment/maintenance/due');
      if (!res.ok) throw new Error('Failed to fetch maintenance');
      return res.json();
    },
  });

  // Fetch equipment details
  const { data: equipmentDetail } = useQuery({
    queryKey: ['equipmentDetail', selectedEquipment?.id],
    queryFn: async () => {
      if (!selectedEquipment?.id) return null;
      const res = await fetch(`/api/equipment/${selectedEquipment.id}`);
      if (!res.ok) throw new Error('Failed to fetch details');
      return res.json();
    },
    enabled: !!selectedEquipment?.id && isDetailDialogOpen,
  });

  const equipment = equipmentData?.equipment || [];
  const stats = equipmentData?.stats;

  // Filter equipment by search
  const filteredEquipment = equipment.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.assignedToAnimalTag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.assignedToAnimalName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Create equipment mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newEquipment) => {
      const res = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create equipment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setIsCreateDialogOpen(false);
      resetCreateForm();
      toast.success('Equipment added successfully');
    },
    onError: () => {
      toast.error('Failed to add equipment');
    },
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async ({ equipmentId, animalId, notes }: { equipmentId: string; animalId: string; notes?: string }) => {
      const animal = MOCK_ANIMALS.find(a => a.id === animalId);
      const res = await fetch(`/api/equipment/${equipmentId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animalId,
          animalTag: animal?.tag,
          animalName: animal?.name,
          notes,
        }),
      });
      if (!res.ok) throw new Error('Failed to assign equipment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setIsAssignDialogOpen(false);
      setAssignForm({ animalId: '', notes: '' });
      toast.success('Equipment assigned successfully');
    },
    onError: () => {
      toast.error('Failed to assign equipment');
    },
  });

  // Unassign mutation
  const unassignMutation = useMutation({
    mutationFn: async ({ equipmentId, reason }: { equipmentId: string; reason?: string }) => {
      const res = await fetch(`/api/equipment/${equipmentId}/unassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed to unassign equipment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipment unassigned');
    },
  });

  // Maintenance mutation
  const maintenanceMutation = useMutation({
    mutationFn: async ({ equipmentId, data }: { equipmentId: string; data: typeof maintenanceForm }) => {
      const res = await fetch(`/api/equipment/${equipmentId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          cost: data.cost ? parseFloat(data.cost) : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to log maintenance');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['maintenanceDue'] });
      setIsMaintenanceDialogOpen(false);
      setMaintenanceForm({ type: 'routine', description: '', cost: '', notes: '', nextScheduled: '' });
      toast.success('Maintenance logged');
    },
  });

  const resetCreateForm = () => {
    setNewEquipment({
      type: 'ear_tag',
      name: '',
      serialNumber: '',
      manufacturer: '',
      model: '',
      purchaseDate: '',
      notes: '',
    });
  };

  const openAssignDialog = (eq: Equipment) => {
    setSelectedEquipment(eq);
    setIsAssignDialogOpen(true);
  };

  const openMaintenanceDialog = (eq: Equipment) => {
    setSelectedEquipment(eq);
    setIsMaintenanceDialogOpen(true);
  };

  const openDetailDialog = (eq: Equipment) => {
    setSelectedEquipment(eq);
    setIsDetailDialogOpen(true);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Tag className="h-8 w-8 text-pulse-forest" />
            Equipment & Animal Linking
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage equipment assignments, tracking devices, and maintenance
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-pulse-forest hover:bg-pulse-forest-dark">
          <Plus className="h-4 w-4 mr-2" />
          Add Equipment
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{stats.available}</p>
              <p className="text-sm text-green-600">Available</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{stats.assigned}</p>
              <p className="text-sm text-blue-600">Assigned</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-700">{stats.maintenance}</p>
              <p className="text-sm text-yellow-600">Maintenance</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{stats.lost}</p>
              <p className="text-sm text-red-600">Lost</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Maintenance Alerts */}
      {maintenanceDue && maintenanceDue.overdue > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">
                {maintenanceDue.overdue} equipment overdue for maintenance
              </p>
              <p className="text-sm text-yellow-700">
                {maintenanceDue.upcoming} more due this week
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setActiveTab('maintenance')}>
              View All
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search equipment, serial, animal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {equipmentTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.icon} {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Equipment List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Equipment</TabsTrigger>
          <TabsTrigger value="assigned">Assigned</TabsTrigger>
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="grid gap-4">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Loading equipment...
                </CardContent>
              </Card>
            ) : filteredEquipment.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No equipment found</p>
                </CardContent>
              </Card>
            ) : (
              filteredEquipment
                .filter(e => {
                  if (activeTab === 'all') return true;
                  if (activeTab === 'assigned') return e.status === 'assigned';
                  if (activeTab === 'available') return e.status === 'available';
                  if (activeTab === 'maintenance') return e.status === 'maintenance' || e.nextMaintenanceDate;
                  return true;
                })
                .map(eq => (
                  <Card key={eq.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center",
                          eq.status === 'assigned' ? "bg-blue-100 text-blue-600" :
                          eq.status === 'available' ? "bg-green-100 text-green-600" :
                          eq.status === 'maintenance' ? "bg-yellow-100 text-yellow-600" :
                          "bg-gray-100 text-gray-600"
                        )}>
                          {TYPE_ICONS[eq.type] || <Package className="h-5 w-5" />}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold">{eq.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {eq.typeInfo?.label || eq.type} 
                                {eq.serialNumber && ` • ${eq.serialNumber}`}
                              </p>
                            </div>
                            <Badge className={STATUS_COLORS[eq.status]}>
                              {STATUS_ICONS[eq.status]}
                              <span className="ml-1 capitalize">{eq.status}</span>
                            </Badge>
                          </div>

                          {/* Assignment info */}
                          {eq.status === 'assigned' && eq.assignedToAnimalTag && (
                            <div className="mt-2 p-2 bg-blue-50 rounded-lg flex items-center gap-2">
                              <Link2 className="h-4 w-4 text-blue-600" />
                              <span className="text-sm">
                                Assigned to <strong>{eq.assignedToAnimalName}</strong> ({eq.assignedToAnimalTag})
                              </span>
                              {eq.assignedAt && (
                                <span className="text-xs text-muted-foreground ml-auto">
                                  since {formatDate(eq.assignedAt)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Battery and last reading */}
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            {eq.batteryLevel !== undefined && (
                              <div className="flex items-center gap-1">
                                <Battery className={cn(
                                  "h-4 w-4",
                                  eq.batteryLevel > 50 ? "text-green-600" :
                                  eq.batteryLevel > 20 ? "text-yellow-600" : "text-red-600"
                                )} />
                                <span>{eq.batteryLevel}%</span>
                              </div>
                            )}
                            {eq.lastReading && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <RefreshCw className="h-3 w-3" />
                                <span>Last reading: {formatTimeAgo(eq.lastReading)}</span>
                              </div>
                            )}
                            {eq.manufacturer && (
                              <span className="text-muted-foreground">
                                {eq.manufacturer} {eq.model}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {eq.status === 'available' && (
                            <Button size="sm" onClick={() => openAssignDialog(eq)}>
                              <Link2 className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                          )}
                          {eq.status === 'assigned' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unassignMutation.mutate({ equipmentId: eq.id })}
                            >
                              <Unlink className="h-4 w-4 mr-1" />
                              Unassign
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openMaintenanceDialog(eq)}>
                            <Wrench className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openDetailDialog(eq)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Equipment Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Equipment</DialogTitle>
            <DialogDescription>Register new equipment for tracking and animal assignment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Equipment Type *</Label>
              <Select
                value={newEquipment.type}
                onValueChange={(v) => setNewEquipment({ ...newEquipment, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {equipmentTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.icon} {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={newEquipment.name}
                onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
                placeholder="e.g., NAIT Tag #1234"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Serial Number</Label>
                <Input
                  value={newEquipment.serialNumber}
                  onChange={(e) => setNewEquipment({ ...newEquipment, serialNumber: e.target.value })}
                  placeholder="e.g., NZ-1234-5678"
                />
              </div>
              <div className="grid gap-2">
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={newEquipment.purchaseDate}
                  onChange={(e) => setNewEquipment({ ...newEquipment, purchaseDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Manufacturer</Label>
                <Input
                  value={newEquipment.manufacturer}
                  onChange={(e) => setNewEquipment({ ...newEquipment, manufacturer: e.target.value })}
                  placeholder="e.g., Allflex"
                />
              </div>
              <div className="grid gap-2">
                <Label>Model</Label>
                <Input
                  value={newEquipment.model}
                  onChange={(e) => setNewEquipment({ ...newEquipment, model: e.target.value })}
                  placeholder="e.g., HDX EID"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={newEquipment.notes}
                onChange={(e) => setNewEquipment({ ...newEquipment, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(newEquipment)}
              disabled={!newEquipment.name || createMutation.isPending}
            >
              Add Equipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Equipment</DialogTitle>
            <DialogDescription>
              Assign "{selectedEquipment?.name}" to an animal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Select Animal *</Label>
              <Select
                value={assignForm.animalId}
                onValueChange={(v) => setAssignForm({ ...assignForm, animalId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an animal..." />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_ANIMALS.map(animal => (
                    <SelectItem key={animal.id} value={animal.id}>
                      {animal.name} ({animal.tag})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={assignForm.notes}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                placeholder="Assignment notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => assignMutation.mutate({
                equipmentId: selectedEquipment!.id,
                animalId: assignForm.animalId,
                notes: assignForm.notes,
              })}
              disabled={!assignForm.animalId || assignMutation.isPending}
            >
              <Link2 className="h-4 w-4 mr-1" />
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Dialog */}
      <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Maintenance</DialogTitle>
            <DialogDescription>
              Record maintenance for "{selectedEquipment?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Maintenance Type</Label>
              <Select
                value={maintenanceForm.type}
                onValueChange={(v) => setMaintenanceForm({ ...maintenanceForm, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine Check</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="battery_replacement">Battery Replacement</SelectItem>
                  <SelectItem value="calibration">Calibration</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Description *</Label>
              <Textarea
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                placeholder="What was done..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Cost ($)</Label>
                <Input
                  type="number"
                  value={maintenanceForm.cost}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label>Next Scheduled</Label>
                <Input
                  type="date"
                  value={maintenanceForm.nextScheduled}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextScheduled: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMaintenanceDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => maintenanceMutation.mutate({
                equipmentId: selectedEquipment!.id,
                data: maintenanceForm,
              })}
              disabled={!maintenanceForm.description || maintenanceMutation.isPending}
            >
              <Wrench className="h-4 w-4 mr-1" />
              Log Maintenance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          {equipmentDetail && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    equipmentDetail.status === 'assigned' ? "bg-blue-100 text-blue-600" : "bg-gray-100"
                  )}>
                    {TYPE_ICONS[equipmentDetail.type]}
                  </div>
                  <div>
                    <DialogTitle>{equipmentDetail.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      {equipmentDetail.typeInfo?.label} • {equipmentDetail.serialNumber || 'No serial'}
                    </p>
                  </div>
                  <Badge className={cn("ml-auto", STATUS_COLORS[equipmentDetail.status])}>
                    {equipmentDetail.status}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Current Assignment */}
                {equipmentDetail.status === 'assigned' && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Currently Assigned To
                    </h4>
                    <p className="text-lg font-semibold">
                      {equipmentDetail.assignedToAnimalName} ({equipmentDetail.assignedToAnimalTag})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Since {formatDate(equipmentDetail.assignedAt)}
                    </p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Manufacturer</p>
                    <p className="font-medium">{equipmentDetail.manufacturer || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Model</p>
                    <p className="font-medium">{equipmentDetail.model || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Purchase Date</p>
                    <p className="font-medium">{formatDate(equipmentDetail.purchaseDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Maintenance</p>
                    <p className="font-medium">{formatDate(equipmentDetail.lastMaintenanceDate)}</p>
                  </div>
                </div>

                {/* Assignment History */}
                {equipmentDetail.assignmentHistory?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Assignment History
                    </h4>
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-2">
                        {equipmentDetail.assignmentHistory.map((a: any) => (
                          <div key={a.id} className="p-2 border rounded text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{a.animalName} ({a.animalTag})</span>
                              {!a.unassignedAt && <Badge variant="outline">Current</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(a.assignedAt)} - {a.unassignedAt ? formatDate(a.unassignedAt) : 'Present'}
                            </p>
                            {a.reason && <p className="text-xs text-muted-foreground">Reason: {a.reason}</p>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Maintenance History */}
                {equipmentDetail.maintenanceHistory?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Maintenance History
                    </h4>
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-2">
                        {equipmentDetail.maintenanceHistory.map((m: any) => (
                          <div key={m.id} className="p-2 border rounded text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium capitalize">{m.type.replace('_', ' ')}</span>
                              {m.cost && <span className="text-muted-foreground">${m.cost}</span>}
                            </div>
                            <p className="text-xs">{m.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(m.performedAt)} by {m.performedBy}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
