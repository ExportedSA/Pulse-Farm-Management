import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { pulseGet, pulseDelete } from '@/lib/pulseApi';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Wrench,
  Plus,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Tractor,
  Thermometer,
  Building,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import EquipmentForm from '@/components/EquipmentForm';

// Types
interface Equipment {
  id: string;
  farmId: string;
  name: string;
  type: string;
  model: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  yearManufactured: number | null;
  purchaseDate: string | null;
  purchasePrice: string | null;
  location: string | null;
  status: 'operational' | 'maintenance_due' | 'in_maintenance' | 'out_of_service';
  lastServiceDate: string | null;
  nextServiceDue: string | null;
  serviceIntervalDays: number | null;
  warrantyExpiry: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Manager roles
const MANAGER_ROLES = ['owner', 'manager', 'admin', 'maintenance'];

export default function EquipmentListPage() {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [deleteEquipment, setDeleteEquipment] = useState<Equipment | null>(null);

  const isManager = user?.role && MANAGER_ROLES.includes(user.role.toLowerCase());

  // Load equipment
  const loadEquipment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pulseGet<Equipment[]>('/farm-equipment');
      setEquipment(data);
    } catch (err: any) {
      console.error('Failed to load equipment:', err);
      setError('Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEquipment();
  }, [loadEquipment]);

  // Filter equipment
  const filteredEquipment = equipment.filter(item => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        item.name.toLowerCase().includes(search) ||
        item.type.toLowerCase().includes(search) ||
        item.model?.toLowerCase().includes(search) ||
        item.serialNumber?.toLowerCase().includes(search) ||
        item.manufacturer?.toLowerCase().includes(search) ||
        item.location?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && item.status !== statusFilter) {
      return false;
    }

    // Type filter
    if (typeFilter !== 'all' && item.type.toLowerCase() !== typeFilter.toLowerCase()) {
      return false;
    }

    return true;
  });

  // Get unique types for filter
  const uniqueTypes = Array.from(new Set(equipment.map(e => e.type)));

  // Get status badge
  function getStatusBadge(status: string) {
    switch (status) {
      case 'operational':
        return (
          <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Operational
          </Badge>
        );
      case 'maintenance_due':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Maintenance Due
          </Badge>
        );
      case 'in_maintenance':
        return (
          <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            In Maintenance
          </Badge>
        );
      case 'out_of_service':
        return (
          <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Out of Service
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  // Get type icon
  function getTypeIcon(type: string) {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('tractor') || lowerType.includes('vehicle')) {
      return <Tractor className="h-4 w-4 text-gray-500" />;
    }
    if (lowerType.includes('sensor') || lowerType.includes('temperature')) {
      return <Thermometer className="h-4 w-4 text-gray-500" />;
    }
    if (lowerType.includes('building') || lowerType.includes('shed')) {
      return <Building className="h-4 w-4 text-gray-500" />;
    }
    return <Wrench className="h-4 w-4 text-gray-500" />;
  }

  // Format date
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  }

  // Handle delete
  async function handleDelete() {
    if (!deleteEquipment) return;
    
    try {
      await pulseDelete(`/farm-equipment/${deleteEquipment.id}`);
      setEquipment(prev => prev.filter(e => e.id !== deleteEquipment.id));
      toast.success('Equipment deleted successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete equipment');
    } finally {
      setDeleteEquipment(null);
    }
  }

  // Handle form success
  function handleFormSuccess(newEquipment: Equipment) {
    if (editingEquipment) {
      // Update existing
      setEquipment(prev => prev.map(e => e.id === newEquipment.id ? newEquipment : e));
    } else {
      // Add new
      setEquipment(prev => [newEquipment, ...prev]);
    }
    setShowAddDialog(false);
    setEditingEquipment(null);
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
            <Button variant="outline" className="mt-4" onClick={loadEquipment}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pulse-green-800">Equipment</h1>
          <p className="text-gray-500">Manage farm equipment and machinery</p>
        </div>
        {isManager && (
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-pulse-green-600 hover:bg-pulse-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Equipment
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search equipment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="maintenance_due">Maintenance Due</SelectItem>
                <SelectItem value="in_maintenance">In Maintenance</SelectItem>
                <SelectItem value="out_of_service">Out of Service</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map(type => (
                  <SelectItem key={type} value={type.toLowerCase()}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Equipment Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Equipment List ({filteredEquipment.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEquipment.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Wrench className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No equipment found</p>
              {isManager && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Equipment
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Service</TableHead>
                  <TableHead>Next Service</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEquipment.map(item => (
                  <TableRow key={item.id} className="hover:bg-gray-50">
                    <TableCell>
                      <Link href={`/app/equipment/${item.id}`}>
                        <span className="font-medium text-pulse-green-700 hover:underline cursor-pointer">
                          {item.name}
                        </span>
                      </Link>
                      {item.model && (
                        <p className="text-sm text-gray-500">{item.model}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(item.type)}
                        <span>{item.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-gray-600">
                      {item.location || '-'}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {formatDate(item.lastServiceDate)}
                    </TableCell>
                    <TableCell>
                      {item.nextServiceDue ? (
                        <span className={
                          new Date(item.nextServiceDue) < new Date() 
                            ? 'text-red-600 font-medium' 
                            : 'text-gray-600'
                        }>
                          {formatDate(item.nextServiceDue)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/app/equipment/${item.id}`}>
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </Link>
                          {isManager && (
                            <>
                              <DropdownMenuItem onClick={() => setEditingEquipment(item)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setDeleteEquipment(item)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog || !!editingEquipment} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setEditingEquipment(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}
            </DialogTitle>
          </DialogHeader>
          <EquipmentForm
            existingEquipment={editingEquipment}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowAddDialog(false);
              setEditingEquipment(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEquipment} onOpenChange={(open) => !open && setDeleteEquipment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Equipment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteEquipment?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
