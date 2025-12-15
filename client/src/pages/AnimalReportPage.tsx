import { useState, useEffect, useCallback } from 'react';
import { pulseGet } from '@/lib/pulseApi';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Heart,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  Activity,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

// Types
interface AnimalInventory {
  total: number;
  byBreed: Record<string, number>;
  byStatus: Record<string, number>;
  animals: Array<{
    id: string;
    visualTag: string;
    name: string | null;
    breed: string | null;
    dateOfBirth: string | null;
    status: string;
    sex: string | null;
    species: string | null;
    ageMonths: number | null;
  }>;
  generatedAt: string;
}

interface HealthRecordsReport {
  total: number;
  byType: Record<string, number>;
  totalCost: string;
  dateRange: { from: string; to: string };
  records: Array<{
    id: string;
    animalId: string;
    animalTag: string;
    animalName: string | null;
    recordDate: string;
    recordType: string;
    description: string | null;
    treatment: string | null;
    veterinarian: string | null;
    cost: string | null;
    notes: string | null;
  }>;
  generatedAt: string;
}

// Manager roles
const MANAGER_ROLES = ['owner', 'manager', 'admin'];

export default function AnimalReportPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<AnimalInventory | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecordsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const isManager = user?.role && MANAGER_ROLES.includes(user.role.toLowerCase());

  // Load inventory data
  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pulseGet<AnimalInventory>('/api/reports/animal-inventory');
      setInventory(data);
    } catch (err: any) {
      console.error('Failed to load animal inventory:', err);
      setError('Failed to load animal inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load health records
  const loadHealthRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pulseGet<HealthRecordsReport>(
        `/api/reports/health-records?from=${fromDate}&to=${toDate}`
      );
      setHealthRecords(data);
    } catch (err: any) {
      console.error('Failed to load health records:', err);
      setError('Failed to load health records');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      loadInventory();
    } else {
      loadHealthRecords();
    }
  }, [activeTab, loadInventory, loadHealthRecords]);

  // Filter animals by search term
  const filteredAnimals = inventory?.animals.filter(animal => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      animal.visualTag?.toLowerCase().includes(search) ||
      animal.name?.toLowerCase().includes(search) ||
      animal.breed?.toLowerCase().includes(search)
    );
  }) || [];

  // Export inventory to CSV
  function exportInventoryCSV() {
    if (!inventory) return;

    const headers = ['Tag', 'Name', 'Breed', 'Species', 'Sex', 'Age (months)', 'Status'];
    const rows = inventory.animals.map(animal => [
      animal.visualTag || '',
      animal.name || '',
      animal.breed || '',
      animal.species || '',
      animal.sex || '',
      animal.ageMonths?.toString() || '',
      animal.status || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animal-inventory-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Inventory exported to CSV');
  }

  // Export health records to CSV
  function exportHealthCSV() {
    if (!healthRecords) return;

    const headers = ['Date', 'Animal Tag', 'Animal Name', 'Type', 'Description', 'Treatment', 'Veterinarian', 'Cost'];
    const rows = healthRecords.records.map(record => [
      record.recordDate,
      record.animalTag || '',
      record.animalName || '',
      record.recordType || '',
      record.description || '',
      record.treatment || '',
      record.veterinarian || '',
      record.cost || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-records-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Health records exported to CSV');
  }

  // Get status badge
  function getStatusBadge(status: string) {
    switch (status?.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'sold':
        return <Badge className="bg-blue-500">Sold</Badge>;
      case 'deceased':
        return <Badge variant="destructive">Deceased</Badge>;
      case 'culled':
        return <Badge className="bg-gray-500">Culled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (!isManager) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              <p>You do not have permission to view animal reports.</p>
            </div>
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
          <h1 className="text-2xl font-bold text-pulse-green-800">Animal Reports</h1>
          <p className="text-gray-500">Inventory and health records</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="health">Health Records</TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          {/* Controls */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by tag, name, or breed..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={loadInventory} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button variant="outline" onClick={exportInventoryCSV} disabled={!inventory}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-pulse-green-600" />
            </div>
          ) : error ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-red-800">
                  <AlertTriangle className="h-5 w-5" />
                  <p>{error}</p>
                </div>
              </CardContent>
            </Card>
          ) : inventory && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-pulse-green-600">{inventory.total}</p>
                      <p className="text-sm text-gray-500">Total Animals</p>
                    </div>
                  </CardContent>
                </Card>
                {Object.entries(inventory.byStatus).slice(0, 3).map(([status, count]) => (
                  <Card key={status}>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-sm text-gray-500 capitalize">{status}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Breed Breakdown */}
              {Object.keys(inventory.byBreed).length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>By Breed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(inventory.byBreed).map(([breed, count]) => (
                        <Badge key={breed} variant="outline" className="text-sm py-1 px-3">
                          {breed}: {count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Animals Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Animal List ({filteredAnimals.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tag</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Breed</TableHead>
                        <TableHead>Sex</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAnimals.slice(0, 100).map((animal) => (
                        <TableRow key={animal.id}>
                          <TableCell className="font-medium">{animal.visualTag}</TableCell>
                          <TableCell>{animal.name || '-'}</TableCell>
                          <TableCell>{animal.breed || '-'}</TableCell>
                          <TableCell className="capitalize">{animal.sex || '-'}</TableCell>
                          <TableCell>
                            {animal.ageMonths !== null 
                              ? animal.ageMonths >= 12 
                                ? `${Math.floor(animal.ageMonths / 12)}y ${animal.ageMonths % 12}m`
                                : `${animal.ageMonths}m`
                              : '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(animal.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredAnimals.length > 100 && (
                    <p className="text-sm text-gray-500 mt-4 text-center">
                      Showing 100 of {filteredAnimals.length} animals. Export to CSV for full list.
                    </p>
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-gray-400 mt-4 text-right">
                Report generated: {new Date(inventory.generatedAt).toLocaleString()}
              </p>
            </>
          )}
        </TabsContent>

        {/* Health Records Tab */}
        <TabsContent value="health">
          {/* Date Range Controls */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-40">
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-40">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
                <Button onClick={loadHealthRecords} disabled={loading}>
                  Apply
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={exportHealthCSV} disabled={!healthRecords}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-pulse-green-600" />
            </div>
          ) : error ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-red-800">
                  <AlertTriangle className="h-5 w-5" />
                  <p>{error}</p>
                </div>
              </CardContent>
            </Card>
          ) : healthRecords && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-pulse-green-100 rounded-lg">
                        <Activity className="h-5 w-5 text-pulse-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Records</p>
                        <p className="text-2xl font-bold">{healthRecords.total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Date Range</p>
                        <p className="text-sm font-medium">
                          {healthRecords.dateRange.from} to {healthRecords.dateRange.to}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Heart className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Cost</p>
                        <p className="text-2xl font-bold">${healthRecords.totalCost}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* By Type Breakdown */}
              {Object.keys(healthRecords.byType).length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Records by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(healthRecords.byType).map(([type, count]) => (
                        <Badge key={type} variant="outline" className="text-sm py-1 px-3 capitalize">
                          {type}: {count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Records Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Health Records ({healthRecords.total})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {healthRecords.records.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Heart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No health records found for this period</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Animal</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Veterinarian</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {healthRecords.records.slice(0, 100).map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{record.recordDate}</TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium">{record.animalTag}</span>
                                {record.animalName && (
                                  <span className="text-gray-500 ml-1">({record.animalName})</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {record.recordType}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {record.description || '-'}
                            </TableCell>
                            <TableCell>{record.veterinarian || '-'}</TableCell>
                            <TableCell className="text-right">
                              {record.cost ? `$${record.cost}` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {healthRecords.records.length > 100 && (
                    <p className="text-sm text-gray-500 mt-4 text-center">
                      Showing 100 of {healthRecords.records.length} records. Export to CSV for full list.
                    </p>
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-gray-400 mt-4 text-right">
                Report generated: {new Date(healthRecords.generatedAt).toLocaleString()}
              </p>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
