import { useState, useEffect, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MapPin, 
  Plus, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Filter,
  Trash2,
  Edit,
  Navigation,
  Target,
  Ruler,
  Map,
  List,
  Crosshair,
  Users,
  Calendar,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';

// Lazy load the map component to avoid SSR issues
const FarmMap = lazy(() => import('@/components/FarmMap'));

interface TaskPin {
  id: string;
  title: string;
  description: string | null;
  latitude: string;
  longitude: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string | null;
  dueDate: string | null;
  assignedTo: string | null;
  pastureId: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
}

const TASK_CATEGORIES = [
  { value: 'fence_repair', label: 'Fence Repair' },
  { value: 'water_issue', label: 'Water Issue' },
  { value: 'animal_check', label: 'Animal Check' },
  { value: 'pasture_maintenance', label: 'Pasture Maintenance' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'hazard', label: 'Hazard' },
  { value: 'other', label: 'Other' },
];

interface StaffMember {
  id: string;
  name: string;
  position?: string;
}

interface Paddock {
  id: string;
  name: string;
  coordinates: [number, number][];
  status?: string;
}

export default function MapTasksPage() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPin, setSelectedPin] = useState<TaskPin | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [showPaddocks, setShowPaddocks] = useState(true);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    latitude: '',
    longitude: '',
    priority: 'medium',
    category: 'other',
    dueDate: '',
    assignedTo: '',
  });

  // Farm center coordinates (would come from farm settings in production)
  const farmCenter: [number, number] = [-36.8485, 174.7633];

  // Mock staff for assignment
  const staff: StaffMember[] = [
    { id: 'staff-1', name: 'John Smith', position: 'Farm Manager' },
    { id: 'staff-2', name: 'Sarah Johnson', position: 'Stock Handler' },
    { id: 'staff-3', name: 'Mike Wilson', position: 'Seasonal Worker' },
  ];

  // Mock paddocks for map overlay
  const paddocks: Paddock[] = [
    {
      id: 'paddock-1',
      name: 'North Paddock',
      coordinates: [
        [-36.845, 174.760],
        [-36.845, 174.768],
        [-36.850, 174.768],
        [-36.850, 174.760],
      ],
      status: 'grazing',
    },
    {
      id: 'paddock-2',
      name: 'South Paddock',
      coordinates: [
        [-36.850, 174.760],
        [-36.850, 174.768],
        [-36.855, 174.768],
        [-36.855, 174.760],
      ],
      status: 'resting',
    },
    {
      id: 'paddock-3',
      name: 'East Paddock',
      coordinates: [
        [-36.847, 174.768],
        [-36.847, 174.775],
        [-36.853, 174.775],
        [-36.853, 174.768],
      ],
      status: 'available',
    },
  ];

  // Fetch task pins
  const { data: taskPins = [], isLoading } = useQuery<TaskPin[]>({
    queryKey: ['taskPins', statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      const response = await fetch(`/api/map/pins?${params}`);
      if (!response.ok) throw new Error('Failed to fetch task pins');
      return response.json();
    },
  });

  // Create task pin mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newTask) => {
      const response = await fetch('/api/map/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create task pin');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskPins'] });
      setIsCreateDialogOpen(false);
      setIsPlacingPin(false);
      setNewTask({
        title: '',
        description: '',
        latitude: '',
        longitude: '',
        priority: 'medium',
        category: 'other',
        dueDate: '',
        assignedTo: '',
      });
      toast.success('Task pin created');
    },
  });

  // Complete task pin mutation
  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/map/pins/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedBy: null }),
      });
      if (!response.ok) throw new Error('Failed to complete task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskPins'] });
      setSelectedPin(null);
    },
  });

  // Delete task pin mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/map/pins/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskPins'] });
      setSelectedPin(null);
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'cancelled': return <AlertTriangle className="h-4 w-4 text-gray-500" />;
      default: return <Target className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getCategoryLabel = (category: string | null) => {
    const cat = TASK_CATEGORIES.find(c => c.value === category);
    return cat?.label || category || 'Other';
  };

  // Summary stats
  const stats = {
    total: taskPins.length,
    pending: taskPins.filter(p => p.status === 'pending').length,
    inProgress: taskPins.filter(p => p.status === 'in_progress').length,
    completed: taskPins.filter(p => p.status === 'completed').length,
    urgent: taskPins.filter(p => p.priority === 'urgent' && p.status !== 'completed').length,
  };

  // Handle map click for placing pins
  const handleMapClick = (lat: number, lng: number) => {
    setNewTask(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
    setIsPlacingPin(false);
    setIsCreateDialogOpen(true);
  };

  // Handle pin click from map
  const handlePinClick = (pin: TaskPin) => {
    setSelectedPin(pin);
  };

  // Handle complete from map
  const handlePinComplete = (pinId: string) => {
    completeMutation.mutate(pinId);
    toast.success('Task marked as complete');
  };

  // Handle delete from map
  const handlePinDelete = (pinId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteMutation.mutate(pinId);
      toast.success('Task deleted');
    }
  };

  // Start placing pin mode
  const startPlacingPin = () => {
    setIsPlacingPin(true);
    toast.info('Click on the map to place a task pin');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header section temporarily commented out for debugging */}
      {/* <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Map Tasks</h1>
          <p className="text-muted-foreground">Manage location-based farm tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'map' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('map')}
            >
              <Map className="h-4 w-4 mr-1" />
              Map
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-none"
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>
          <Button
            variant={isPlacingPin ? 'destructive' : 'outline'}
            onClick={() => isPlacingPin ? setIsPlacingPin(false) : startPlacingPin()}
          >
            <Crosshair className="h-4 w-4 mr-2" />
            {isPlacingPin ? 'Cancel' : 'Drop Pin'}
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-pulse-forest hover:bg-pulse-forest-dark">
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Task Pin</DialogTitle>
                <DialogDescription>
                  Add a new location-based task to the map
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="e.g., Fix broken fence"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Detailed description of the task..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      value={newTask.latitude}
                      onChange={(e) => setNewTask({ ...newTask, latitude: e.target.value })}
                      placeholder="-36.8485"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      value={newTask.longitude}
                      onChange={(e) => setNewTask({ ...newTask, longitude: e.target.value })}
                      placeholder="174.7633"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select
                      value={newTask.category}
                      onValueChange={(value) => setNewTask({ ...newTask, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">Due Date (Optional)</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createMutation.mutate(newTask)}
                  disabled={!newTask.title || !newTask.latitude || !newTask.longitude || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Task'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div> */}
            {/* </DialogFooter>
          </DialogContent>
        </Dialog>
      </div> */}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <MapPin className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Target className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent</p>
                <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label>Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Priority:</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant={showPaddocks ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowPaddocks(!showPaddocks)}
              >
                <Layers className="h-4 w-4 mr-1" />
                Paddocks
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map View - Temporarily commented out for debugging */}
      {/* {viewMode === 'map' && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="h-[500px]">
              <Suspense fallback={
                <div className="h-full flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <Map className="h-12 w-12 mx-auto text-gray-400 animate-pulse mb-2" />
                    <p className="text-gray-500">Loading map...</p>
                  </div>
                </div>
              }>
                <FarmMap
                  taskPins={taskPins}
                  paddocks={paddocks}
                  center={farmCenter}
                  zoom={14}
                  onPinClick={handlePinClick}
                  onMapClick={handleMapClick}
                  onPinComplete={handlePinComplete}
                  onPinDelete={handlePinDelete}
                  isPlacingPin={isPlacingPin}
                  showPaddocks={showPaddocks}
                  selectedPinId={selectedPin?.id}
                />
              </Suspense>
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* Task List - Temporarily commented out for debugging */}
      {/* {viewMode === 'list' && (
      <Card>
        <CardHeader>
          <CardTitle>Task Pins</CardTitle>
          <CardDescription>
            {isLoading ? 'Loading...' : `${taskPins.length} tasks found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {taskPins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No task pins found</p>
              <p className="text-sm">Create a new task pin to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {taskPins.map((pin) => (
                <div
                  key={pin.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${getPriorityColor(pin.priority)}`} />
                    {getStatusIcon(pin.status)}
                    <div>
                      <p className="font-medium">{pin.title}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{getCategoryLabel(pin.category)}</Badge>
                        <span>•</span>
                        <Navigation className="h-3 w-3" />
                        <span>{parseFloat(pin.latitude).toFixed(4)}, {parseFloat(pin.longitude).toFixed(4)}</span>
                        {pin.dueDate && (
                          <>
                            <span>•</span>
                            <span>Due: {new Date(pin.dueDate).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pin.status !== 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => completeMutation.mutate(pin.id)}
                        disabled={completeMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Complete
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(pin.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )} */}

      {/* Distance Calculator - Temporarily commented out for debugging */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Distance Calculator
          </CardTitle>
          <CardDescription>
            Calculate distance between two coordinates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DistanceCalculator />
        </CardContent>
      </Card> */}
    </div>
  );
}

function DistanceCalculator() {
  const [point1, setPoint1] = useState({ lat: '', lng: '' });
  const [point2, setPoint2] = useState({ lat: '', lng: '' });
  const [result, setResult] = useState<{ distanceKm: number; distanceM: number; distanceMiles: number } | null>(null);

  const calculateDistance = async () => {
    if (!point1.lat || !point1.lng || !point2.lat || !point2.lng) return;
    
    try {
      const response = await fetch('/api/map/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat1: parseFloat(point1.lat),
          lng1: parseFloat(point1.lng),
          lat2: parseFloat(point2.lat),
          lng2: parseFloat(point2.lng),
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch (error) {
      console.error('Error calculating distance:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="font-medium">Point 1</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Latitude"
              type="number"
              step="any"
              value={point1.lat}
              onChange={(e) => setPoint1({ ...point1, lat: e.target.value })}
            />
            <Input
              placeholder="Longitude"
              type="number"
              step="any"
              value={point1.lng}
              onChange={(e) => setPoint1({ ...point1, lng: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-medium">Point 2</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Latitude"
              type="number"
              step="any"
              value={point2.lat}
              onChange={(e) => setPoint2({ ...point2, lat: e.target.value })}
            />
            <Input
              placeholder="Longitude"
              type="number"
              step="any"
              value={point2.lng}
              onChange={(e) => setPoint2({ ...point2, lng: e.target.value })}
            />
          </div>
        </div>
      </div>
      <Button onClick={calculateDistance}>
        <Ruler className="h-4 w-4 mr-2" />
        Calculate Distance
      </Button>
      {result && (
        <div className="p-4 bg-muted rounded-lg">
          <p className="font-medium">Distance Results:</p>
          <div className="grid grid-cols-3 gap-4 mt-2">
            <div>
              <p className="text-sm text-muted-foreground">Kilometers</p>
              <p className="text-xl font-bold">{result.distanceKm} km</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Meters</p>
              <p className="text-xl font-bold">{result.distanceM} m</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Miles</p>
              <p className="text-xl font-bold">{result.distanceMiles} mi</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
