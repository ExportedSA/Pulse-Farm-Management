import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { format, differenceInDays, differenceInYears } from 'date-fns';
import { toast } from 'sonner';
import { Package, Wrench, Car, Tractor, Plus, Calendar, Clock, AlertTriangle, DollarSign, Fuel, Gauge, MapPin, Users, History, Cog, Hammer, Droplets, BarChart3 } from 'lucide-react';

// Interfaces
interface Asset {
  id: string; name: string; category: 'vehicle' | 'tractor' | 'implement' | 'tool' | 'irrigation' | 'other';
  make?: string; model?: string; year?: number; serialNumber?: string;
  purchaseDate?: string; purchasePrice?: number; currentValue?: number;
  depreciationMethod: 'straight_line' | 'declining_balance' | 'none';
  usefulLifeYears?: number; salvageValue?: number;
  status: 'operational' | 'maintenance' | 'repair' | 'retired';
  location?: string; assignedToName?: string;
  fuelType?: 'diesel' | 'petrol' | 'electric' | 'none';
  lastServiceDate?: string; nextServiceDue?: string;
  currentHours?: number; odometerReading?: number; notes?: string;
}

interface MaintenanceRecord {
  id: string; assetId: string; assetName: string;
  type: 'scheduled_service' | 'repair' | 'inspection' | 'breakdown';
  description: string; performedBy: string; performedDate: string;
  laborCost?: number; partsCost?: number; totalCost?: number;
  status: 'scheduled' | 'in_progress' | 'completed';
}

interface FuelRecord {
  id: string; assetId: string; assetName: string; date: string;
  fuelType: string; quantity: number; unitCost: number; totalCost: number;
  location?: string; recordedBy: string;
}

// Mock Data
const mockAssets: Asset[] = [
  { id: 'asset-1', name: 'John Deere 6130R', category: 'tractor', make: 'John Deere', model: '6130R', year: 2019, purchaseDate: '2019-03-15', purchasePrice: 185000, currentValue: 142000, depreciationMethod: 'straight_line', usefulLifeYears: 15, salvageValue: 25000, status: 'operational', location: 'Main Shed', assignedToName: 'John Smith', fuelType: 'diesel', lastServiceDate: '2024-01-10', nextServiceDue: '2024-04-10', currentHours: 2450 },
  { id: 'asset-2', name: 'Massey Ferguson 5711', category: 'tractor', make: 'Massey Ferguson', model: '5711', year: 2021, purchaseDate: '2021-06-20', purchasePrice: 145000, currentValue: 125000, depreciationMethod: 'straight_line', usefulLifeYears: 15, salvageValue: 20000, status: 'operational', location: 'Back Shed', fuelType: 'diesel', lastServiceDate: '2024-01-05', nextServiceDue: '2024-04-05', currentHours: 1850 },
  { id: 'asset-3', name: 'Toyota Hilux SR5', category: 'vehicle', make: 'Toyota', model: 'Hilux SR5', year: 2022, purchaseDate: '2022-02-10', purchasePrice: 68000, currentValue: 58000, depreciationMethod: 'declining_balance', usefulLifeYears: 10, salvageValue: 15000, status: 'operational', location: 'Office', assignedToName: 'John Smith', fuelType: 'diesel', lastServiceDate: '2024-01-15', nextServiceDue: '2024-07-15', odometerReading: 45000 },
  { id: 'asset-4', name: 'Kuhn FC 3160 Mower', category: 'implement', make: 'Kuhn', model: 'FC 3160', year: 2020, purchaseDate: '2020-09-01', purchasePrice: 42000, currentValue: 32000, depreciationMethod: 'straight_line', usefulLifeYears: 12, salvageValue: 5000, status: 'operational', location: 'Implement Shed', fuelType: 'none', lastServiceDate: '2023-11-15', nextServiceDue: '2024-03-15' },
  { id: 'asset-5', name: 'Honda TRX420 Quad', category: 'vehicle', make: 'Honda', model: 'TRX420', year: 2023, purchaseDate: '2023-01-15', purchasePrice: 12500, currentValue: 11000, depreciationMethod: 'declining_balance', usefulLifeYears: 8, salvageValue: 2000, status: 'maintenance', location: 'Workshop', fuelType: 'petrol', lastServiceDate: '2024-01-20', nextServiceDue: '2024-04-20', currentHours: 380, notes: 'In for brake service' },
  { id: 'asset-6', name: 'Irrigation Pump', category: 'irrigation', make: 'Grundfos', model: 'CR 45-3', year: 2018, purchaseDate: '2018-10-01', purchasePrice: 28000, currentValue: 18000, depreciationMethod: 'straight_line', usefulLifeYears: 20, salvageValue: 3000, status: 'operational', location: 'Pump House', fuelType: 'electric', lastServiceDate: '2023-09-01', nextServiceDue: '2024-09-01', currentHours: 12500 },
  { id: 'asset-7', name: 'Stihl MS 462 Chainsaw', category: 'tool', make: 'Stihl', model: 'MS 462', year: 2022, purchaseDate: '2022-05-10', purchasePrice: 1800, currentValue: 1200, depreciationMethod: 'straight_line', usefulLifeYears: 5, salvageValue: 200, status: 'operational', location: 'Tool Shed', fuelType: 'petrol', lastServiceDate: '2024-01-05', nextServiceDue: '2024-07-05' },
];

const mockMaintenance: MaintenanceRecord[] = [
  { id: 'maint-1', assetId: 'asset-1', assetName: 'John Deere 6130R', type: 'scheduled_service', description: '250 hour service - oil, filters', performedBy: 'Farm Machinery Services', performedDate: '2024-01-10', laborCost: 350, partsCost: 420, totalCost: 770, status: 'completed' },
  { id: 'maint-2', assetId: 'asset-3', assetName: 'Toyota Hilux SR5', type: 'scheduled_service', description: '45,000km service', performedBy: 'Toyota Dealer', performedDate: '2024-01-15', laborCost: 280, partsCost: 350, totalCost: 630, status: 'completed' },
  { id: 'maint-3', assetId: 'asset-5', assetName: 'Honda TRX420 Quad', type: 'repair', description: 'Brake pad replacement', performedBy: 'In-house', performedDate: '2024-01-20', laborCost: 0, partsCost: 180, totalCost: 180, status: 'in_progress' },
  { id: 'maint-4', assetId: 'asset-1', assetName: 'John Deere 6130R', type: 'scheduled_service', description: '500 hour major service', performedBy: 'Farm Machinery Services', performedDate: '2024-04-10', status: 'scheduled' },
];

const mockFuel: FuelRecord[] = [
  { id: 'fuel-1', assetId: 'asset-1', assetName: 'John Deere 6130R', date: '2024-01-18', fuelType: 'diesel', quantity: 180, unitCost: 1.85, totalCost: 333, location: 'Farm Tank', recordedBy: 'John Smith' },
  { id: 'fuel-2', assetId: 'asset-1', assetName: 'John Deere 6130R', date: '2024-01-12', fuelType: 'diesel', quantity: 165, unitCost: 1.82, totalCost: 300.30, location: 'Farm Tank', recordedBy: 'John Smith' },
  { id: 'fuel-3', assetId: 'asset-3', assetName: 'Toyota Hilux SR5', date: '2024-01-17', fuelType: 'diesel', quantity: 72, unitCost: 2.15, totalCost: 154.80, location: 'BP Station', recordedBy: 'John Smith' },
  { id: 'fuel-4', assetId: 'asset-2', assetName: 'Massey Ferguson 5711', date: '2024-01-16', fuelType: 'diesel', quantity: 150, unitCost: 1.85, totalCost: 277.50, location: 'Farm Tank', recordedBy: 'Sarah Johnson' },
];

export default function AssetRegistryPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [assets, setAssets] = useState<Asset[]>(mockAssets);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>(mockMaintenance);
  const [fuel, setFuel] = useState<FuelRecord[]>(mockFuel);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isAddMaintenanceOpen, setIsAddMaintenanceOpen] = useState(false);
  const [isAddFuelOpen, setIsAddFuelOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [newAsset, setNewAsset] = useState({ name: '', category: 'tractor' as Asset['category'], make: '', model: '', year: new Date().getFullYear(), purchaseDate: format(new Date(), 'yyyy-MM-dd'), purchasePrice: 0, depreciationMethod: 'straight_line' as Asset['depreciationMethod'], usefulLifeYears: 10, salvageValue: 0, fuelType: 'diesel' as Asset['fuelType'], location: '', notes: '' });
  const [newMaint, setNewMaint] = useState({ assetId: '', type: 'scheduled_service' as MaintenanceRecord['type'], description: '', performedBy: '', performedDate: format(new Date(), 'yyyy-MM-dd'), laborCost: 0, partsCost: 0 });
  const [newFuel, setNewFuel] = useState({ assetId: '', date: format(new Date(), 'yyyy-MM-dd'), quantity: 0, unitCost: 0, location: '' });

  // Stats
  const stats = {
    totalAssets: assets.length,
    totalValue: assets.reduce((s, a) => s + (a.currentValue || 0), 0),
    operational: assets.filter(a => a.status === 'operational').length,
    serviceDue: assets.filter(a => a.nextServiceDue && differenceInDays(new Date(a.nextServiceDue), new Date()) <= 14).length,
    totalDepreciation: assets.reduce((s, a) => s + ((a.purchasePrice || 0) - (a.currentValue || 0)), 0),
    monthlyFuel: fuel.filter(f => new Date(f.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).reduce((s, f) => s + f.totalCost, 0),
    monthlyMaint: maintenance.filter(m => m.status === 'completed' && new Date(m.performedDate) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).reduce((s, m) => s + (m.totalCost || 0), 0),
  };

  const handleAddAsset = () => {
    const asset: Asset = { id: `asset-${Date.now()}`, ...newAsset, currentValue: newAsset.purchasePrice, status: 'operational' };
    setAssets([asset, ...assets]);
    setIsAddAssetOpen(false);
    setNewAsset({ name: '', category: 'tractor', make: '', model: '', year: new Date().getFullYear(), purchaseDate: format(new Date(), 'yyyy-MM-dd'), purchasePrice: 0, depreciationMethod: 'straight_line', usefulLifeYears: 10, salvageValue: 0, fuelType: 'diesel', location: '', notes: '' });
    toast.success('Asset added');
  };

  const handleAddMaintenance = () => {
    const asset = assets.find(a => a.id === newMaint.assetId);
    const record: MaintenanceRecord = { id: `maint-${Date.now()}`, ...newMaint, assetName: asset?.name || '', totalCost: newMaint.laborCost + newMaint.partsCost, status: 'completed' };
    setMaintenance([record, ...maintenance]);
    if (asset) setAssets(assets.map(a => a.id === asset.id ? { ...a, lastServiceDate: newMaint.performedDate } : a));
    setIsAddMaintenanceOpen(false);
    setNewMaint({ assetId: '', type: 'scheduled_service', description: '', performedBy: '', performedDate: format(new Date(), 'yyyy-MM-dd'), laborCost: 0, partsCost: 0 });
    toast.success('Maintenance recorded');
  };

  const handleAddFuel = () => {
    const asset = assets.find(a => a.id === newFuel.assetId);
    const record: FuelRecord = { id: `fuel-${Date.now()}`, ...newFuel, assetName: asset?.name || '', fuelType: asset?.fuelType || 'diesel', totalCost: newFuel.quantity * newFuel.unitCost, recordedBy: 'Current User' };
    setFuel([record, ...fuel]);
    setIsAddFuelOpen(false);
    setNewFuel({ assetId: '', date: format(new Date(), 'yyyy-MM-dd'), quantity: 0, unitCost: 0, location: '' });
    toast.success('Fuel recorded');
  };

  const getCategoryIcon = (cat: Asset['category']) => {
    switch (cat) { case 'vehicle': return <Car className="h-5 w-5" />; case 'tractor': return <Tractor className="h-5 w-5" />; case 'implement': return <Cog className="h-5 w-5" />; case 'tool': return <Hammer className="h-5 w-5" />; case 'irrigation': return <Droplets className="h-5 w-5" />; default: return <Package className="h-5 w-5" />; }
  };

  const getStatusColor = (s: Asset['status']) => {
    switch (s) { case 'operational': return 'bg-green-100 text-green-800'; case 'maintenance': return 'bg-yellow-100 text-yellow-800'; case 'repair': return 'bg-orange-100 text-orange-800'; default: return 'bg-gray-100 text-gray-800'; }
  };

  const getServiceStatus = (a: Asset) => {
    if (!a.nextServiceDue) return { status: 'unknown', days: null };
    const days = differenceInDays(new Date(a.nextServiceDue), new Date());
    if (days < 0) return { status: 'overdue', days };
    if (days <= 7) return { status: 'due_soon', days };
    return { status: 'ok', days };
  };

  const calculateDepreciation = (a: Asset) => {
    if (!a.purchaseDate || !a.purchasePrice || a.depreciationMethod === 'none') return null;
    const years = differenceInYears(new Date(), new Date(a.purchaseDate));
    const annual = (a.purchasePrice - (a.salvageValue || 0)) / (a.usefulLifeYears || 10);
    const total = Math.min(annual * years, a.purchasePrice - (a.salvageValue || 0));
    return { annual, total, current: a.purchasePrice - total, percent: (total / a.purchasePrice) * 100 };
  };

  const filteredAssets = assets.filter(a => {
    const matchCat = categoryFilter === 'all' || a.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.make?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchStatus && matchSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg"><Package className="h-6 w-6 text-orange-600" /></div>
              <div><h1 className="text-2xl font-bold text-gray-900">Asset Registry</h1><p className="text-sm text-gray-500">Equipment, maintenance & depreciation tracking</p></div>
            </div>
            <div className="flex gap-2">
              <Dialog open={isAddFuelOpen} onOpenChange={setIsAddFuelOpen}>
                <DialogTrigger asChild><Button variant="outline"><Fuel className="h-4 w-4 mr-2" />Log Fuel</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Log Fuel</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div><Label>Asset</Label><Select value={newFuel.assetId} onValueChange={(v) => setNewFuel({ ...newFuel, assetId: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{assets.filter(a => a.fuelType && a.fuelType !== 'none' && a.fuelType !== 'electric').map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid grid-cols-2 gap-4"><div><Label>Date</Label><Input type="date" value={newFuel.date} onChange={(e) => setNewFuel({ ...newFuel, date: e.target.value })} /></div><div><Label>Location</Label><Input value={newFuel.location} onChange={(e) => setNewFuel({ ...newFuel, location: e.target.value })} /></div></div>
                    <div className="grid grid-cols-2 gap-4"><div><Label>Quantity (L)</Label><Input type="number" value={newFuel.quantity} onChange={(e) => setNewFuel({ ...newFuel, quantity: parseFloat(e.target.value) || 0 })} /></div><div><Label>$/L</Label><Input type="number" step="0.01" value={newFuel.unitCost} onChange={(e) => setNewFuel({ ...newFuel, unitCost: parseFloat(e.target.value) || 0 })} /></div></div>
                    <div className="bg-gray-50 p-3 rounded"><p className="font-medium">Total: ${(newFuel.quantity * newFuel.unitCost).toFixed(2)}</p></div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setIsAddFuelOpen(false)}>Cancel</Button><Button onClick={handleAddFuel} disabled={!newFuel.assetId || newFuel.quantity <= 0}>Add</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isAddMaintenanceOpen} onOpenChange={setIsAddMaintenanceOpen}>
                <DialogTrigger asChild><Button variant="outline"><Wrench className="h-4 w-4 mr-2" />Log Service</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Log Maintenance</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div><Label>Asset</Label><Select value={newMaint.assetId} onValueChange={(v) => setNewMaint({ ...newMaint, assetId: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid grid-cols-2 gap-4"><div><Label>Type</Label><Select value={newMaint.type} onValueChange={(v: any) => setNewMaint({ ...newMaint, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="scheduled_service">Scheduled Service</SelectItem><SelectItem value="repair">Repair</SelectItem><SelectItem value="inspection">Inspection</SelectItem><SelectItem value="breakdown">Breakdown</SelectItem></SelectContent></Select></div><div><Label>Date</Label><Input type="date" value={newMaint.performedDate} onChange={(e) => setNewMaint({ ...newMaint, performedDate: e.target.value })} /></div></div>
                    <div><Label>Description</Label><Textarea value={newMaint.description} onChange={(e) => setNewMaint({ ...newMaint, description: e.target.value })} rows={2} /></div>
                    <div><Label>Performed By</Label><Input value={newMaint.performedBy} onChange={(e) => setNewMaint({ ...newMaint, performedBy: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-4"><div><Label>Labor ($)</Label><Input type="number" value={newMaint.laborCost} onChange={(e) => setNewMaint({ ...newMaint, laborCost: parseFloat(e.target.value) || 0 })} /></div><div><Label>Parts ($)</Label><Input type="number" value={newMaint.partsCost} onChange={(e) => setNewMaint({ ...newMaint, partsCost: parseFloat(e.target.value) || 0 })} /></div></div>
                    <div className="bg-gray-50 p-3 rounded"><p className="font-medium">Total: ${(newMaint.laborCost + newMaint.partsCost).toFixed(2)}</p></div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setIsAddMaintenanceOpen(false)}>Cancel</Button><Button onClick={handleAddMaintenance} disabled={!newMaint.assetId || !newMaint.description}>Add</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isAddAssetOpen} onOpenChange={setIsAddAssetOpen}>
                <DialogTrigger asChild><Button className="bg-orange-600 hover:bg-orange-700"><Plus className="h-4 w-4 mr-2" />Add Asset</Button></DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Add New Asset</DialogTitle><DialogDescription>Register equipment or machinery</DialogDescription></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4"><div><Label>Category</Label><Select value={newAsset.category} onValueChange={(v: any) => setNewAsset({ ...newAsset, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tractor">Tractor</SelectItem><SelectItem value="vehicle">Vehicle</SelectItem><SelectItem value="implement">Implement</SelectItem><SelectItem value="tool">Tool</SelectItem><SelectItem value="irrigation">Irrigation</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div><Label>Location</Label><Input value={newAsset.location} onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })} /></div></div>
                    <div><Label>Name *</Label><Input value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="e.g., John Deere 6130R" /></div>
                    <div className="grid grid-cols-3 gap-4"><div><Label>Make</Label><Input value={newAsset.make} onChange={(e) => setNewAsset({ ...newAsset, make: e.target.value })} /></div><div><Label>Model</Label><Input value={newAsset.model} onChange={(e) => setNewAsset({ ...newAsset, model: e.target.value })} /></div><div><Label>Year</Label><Input type="number" value={newAsset.year} onChange={(e) => setNewAsset({ ...newAsset, year: parseInt(e.target.value) || 0 })} /></div></div>
                    <div className="border-t pt-4"><h4 className="font-medium mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4" />Purchase & Depreciation</h4><div className="grid grid-cols-2 gap-4"><div><Label>Purchase Date</Label><Input type="date" value={newAsset.purchaseDate} onChange={(e) => setNewAsset({ ...newAsset, purchaseDate: e.target.value })} /></div><div><Label>Purchase Price ($)</Label><Input type="number" value={newAsset.purchasePrice} onChange={(e) => setNewAsset({ ...newAsset, purchasePrice: parseFloat(e.target.value) || 0 })} /></div></div><div className="grid grid-cols-3 gap-4 mt-4"><div><Label>Method</Label><Select value={newAsset.depreciationMethod} onValueChange={(v: any) => setNewAsset({ ...newAsset, depreciationMethod: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="straight_line">Straight Line</SelectItem><SelectItem value="declining_balance">Declining Balance</SelectItem><SelectItem value="none">None</SelectItem></SelectContent></Select></div><div><Label>Life (yrs)</Label><Input type="number" value={newAsset.usefulLifeYears} onChange={(e) => setNewAsset({ ...newAsset, usefulLifeYears: parseInt(e.target.value) || 0 })} /></div><div><Label>Salvage ($)</Label><Input type="number" value={newAsset.salvageValue} onChange={(e) => setNewAsset({ ...newAsset, salvageValue: parseFloat(e.target.value) || 0 })} /></div></div></div>
                    <div className="border-t pt-4"><h4 className="font-medium mb-3 flex items-center gap-2"><Fuel className="h-4 w-4" />Fuel</h4><Select value={newAsset.fuelType} onValueChange={(v: any) => setNewAsset({ ...newAsset, fuelType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="diesel">Diesel</SelectItem><SelectItem value="petrol">Petrol</SelectItem><SelectItem value="electric">Electric</SelectItem><SelectItem value="none">N/A</SelectItem></SelectContent></Select></div>
                    <div><Label>Notes</Label><Textarea value={newAsset.notes} onChange={(e) => setNewAsset({ ...newAsset, notes: e.target.value })} rows={2} /></div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setIsAddAssetOpen(false)}>Cancel</Button><Button onClick={handleAddAsset} disabled={!newAsset.name}>Add Asset</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="assets">All Assets</TabsTrigger><TabsTrigger value="maintenance">Maintenance</TabsTrigger><TabsTrigger value="fuel">Fuel & Usage</TabsTrigger><TabsTrigger value="depreciation">Depreciation</TabsTrigger></TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Total Assets</p><p className="text-2xl font-bold">{stats.totalAssets}</p></div><Package className="h-8 w-8 text-gray-200" /></div><p className="text-xs text-gray-400 mt-1">{stats.operational} operational</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Total Value</p><p className="text-2xl font-bold text-green-600">${stats.totalValue.toLocaleString()}</p></div><DollarSign className="h-8 w-8 text-green-200" /></div><p className="text-xs text-gray-400 mt-1">${stats.totalDepreciation.toLocaleString()} depreciated</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Service Due</p><p className="text-2xl font-bold text-orange-600">{stats.serviceDue}</p></div><Wrench className="h-8 w-8 text-orange-200" /></div><p className="text-xs text-gray-400 mt-1">Within 14 days</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Monthly Costs</p><p className="text-2xl font-bold text-blue-600">${(stats.monthlyFuel + stats.monthlyMaint).toFixed(0)}</p></div><BarChart3 className="h-8 w-8 text-blue-200" /></div><p className="text-xs text-gray-400 mt-1">Fuel: ${stats.monthlyFuel.toFixed(0)} | Service: ${stats.monthlyMaint.toFixed(0)}</p></CardContent></Card>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-600" />Service Alerts</CardTitle></CardHeader><CardContent><div className="space-y-3">{assets.filter(a => { const s = getServiceStatus(a); return s.status === 'overdue' || s.status === 'due_soon'; }).slice(0, 5).map(a => { const s = getServiceStatus(a); return (<div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><div className={`p-2 rounded ${s.status === 'overdue' ? 'bg-red-100' : 'bg-yellow-100'}`}>{getCategoryIcon(a.category)}</div><div><p className="font-medium text-sm">{a.name}</p><p className="text-xs text-gray-500">{s.status === 'overdue' ? `${Math.abs(s.days!)} days overdue` : `Due in ${s.days} days`}</p></div></div><Badge className={s.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>{s.status === 'overdue' ? 'Overdue' : 'Due Soon'}</Badge></div>); })}{assets.filter(a => { const s = getServiceStatus(a); return s.status === 'overdue' || s.status === 'due_soon'; }).length === 0 && <p className="text-sm text-gray-500 text-center py-4">No service alerts</p>}</div></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5 text-blue-600" />Recent Activity</CardTitle></CardHeader><CardContent><div className="space-y-3">{[...maintenance.filter(m => m.status === 'completed').slice(0, 2).map(m => ({ type: 'maint', date: m.performedDate, title: m.assetName, desc: m.description, cost: m.totalCost })), ...fuel.slice(0, 2).map(f => ({ type: 'fuel', date: f.date, title: f.assetName, desc: `${f.quantity}L`, cost: f.totalCost }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4).map((item, i) => (<div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><div className={`p-2 rounded ${item.type === 'maint' ? 'bg-blue-100' : 'bg-green-100'}`}>{item.type === 'maint' ? <Wrench className="h-4 w-4 text-blue-600" /> : <Fuel className="h-4 w-4 text-green-600" />}</div><div><p className="font-medium text-sm">{item.title}</p><p className="text-xs text-gray-500">{item.desc}</p></div></div><div className="text-right"><p className="font-medium text-sm">${item.cost?.toFixed(2)}</p><p className="text-xs text-gray-500">{format(new Date(item.date), 'MMM d')}</p></div></div>))}</div></CardContent></Card>
            </div>
            <Card><CardHeader><CardTitle className="text-lg">Assets by Category</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 md:grid-cols-6 gap-4">{['tractor', 'vehicle', 'implement', 'tool', 'irrigation', 'other'].map(cat => { const count = assets.filter(a => a.category === cat).length; const value = assets.filter(a => a.category === cat).reduce((s, a) => s + (a.currentValue || 0), 0); return (<div key={cat} className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => { setCategoryFilter(cat); setActiveTab('assets'); }}><div className="flex justify-center mb-2">{getCategoryIcon(cat as Asset['category'])}</div><p className="font-medium text-sm capitalize">{cat}s</p><p className="text-2xl font-bold">{count}</p><p className="text-xs text-gray-500">${value.toLocaleString()}</p></div>); })}</div></CardContent></Card>
          </TabsContent>

          <TabsContent value="assets" className="space-y-4">
            <div className="flex flex-wrap gap-3"><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 min-w-[200px]" /><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="tractor">Tractors</SelectItem><SelectItem value="vehicle">Vehicles</SelectItem><SelectItem value="implement">Implements</SelectItem><SelectItem value="tool">Tools</SelectItem><SelectItem value="irrigation">Irrigation</SelectItem></SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="operational">Operational</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="repair">Repair</SelectItem></SelectContent></Select></div>
            <div className="grid gap-4">{filteredAssets.map(a => { const svc = getServiceStatus(a); const dep = calculateDepreciation(a); return (<Card key={a.id} className="hover:shadow-md transition-shadow"><CardContent className="p-6"><div className="flex items-start justify-between"><div className="flex items-start gap-4"><div className={`p-3 rounded-lg ${getStatusColor(a.status)}`}>{getCategoryIcon(a.category)}</div><div><div className="flex items-center gap-2 mb-1"><h3 className="font-semibold text-lg">{a.name}</h3><Badge className={getStatusColor(a.status)}>{a.status}</Badge>{svc.status === 'overdue' && <Badge className="bg-red-100 text-red-800">Service Overdue</Badge>}{svc.status === 'due_soon' && <Badge className="bg-yellow-100 text-yellow-800">Service Due</Badge>}</div><p className="text-sm text-gray-600 mb-2">{a.make} {a.model} {a.year && `(${a.year})`}</p><div className="flex flex-wrap gap-4 text-xs text-gray-500">{a.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</span>}{a.currentHours && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.currentHours} hrs</span>}{a.odometerReading && <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{a.odometerReading.toLocaleString()} km</span>}{a.assignedToName && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{a.assignedToName}</span>}</div></div></div><div className="text-right"><p className="text-lg font-bold text-green-600">${a.currentValue?.toLocaleString()}</p>{dep && <p className="text-xs text-gray-500">{dep.percent.toFixed(0)}% depreciated</p>}{a.nextServiceDue && <p className="text-xs text-gray-500 mt-1">Service: {format(new Date(a.nextServiceDue), 'MMM d, yyyy')}</p>}</div></div></CardContent></Card>); })}</div>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 mb-6"><Card className="bg-blue-50"><CardContent className="p-4 text-center"><p className="text-sm text-blue-600">Scheduled</p><p className="text-3xl font-bold text-blue-700">{maintenance.filter(m => m.status === 'scheduled').length}</p></CardContent></Card><Card className="bg-yellow-50"><CardContent className="p-4 text-center"><p className="text-sm text-yellow-600">In Progress</p><p className="text-3xl font-bold text-yellow-700">{maintenance.filter(m => m.status === 'in_progress').length}</p></CardContent></Card><Card className="bg-green-50"><CardContent className="p-4 text-center"><p className="text-sm text-green-600">Completed (30d)</p><p className="text-3xl font-bold text-green-700">{maintenance.filter(m => m.status === 'completed' && new Date(m.performedDate) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}</p></CardContent></Card></div>
            <div className="space-y-4">{maintenance.map(m => (<Card key={m.id}><CardContent className="p-4"><div className="flex items-start justify-between"><div className="flex items-start gap-3"><div className={`p-2 rounded ${m.type === 'scheduled_service' ? 'bg-blue-100' : m.type === 'repair' ? 'bg-orange-100' : 'bg-gray-100'}`}><Wrench className="h-4 w-4" /></div><div><div className="flex items-center gap-2 mb-1"><h4 className="font-medium">{m.assetName}</h4><Badge variant="outline">{m.type.replace('_', ' ')}</Badge><Badge variant="secondary">{m.status}</Badge></div><p className="text-sm text-gray-600">{m.description}</p><div className="flex gap-4 text-xs text-gray-500 mt-2"><span><Calendar className="h-3 w-3 inline mr-1" />{format(new Date(m.performedDate), 'MMM d, yyyy')}</span>{m.performedBy && <span>By: {m.performedBy}</span>}</div></div></div>{m.totalCost && <div className="text-right"><p className="font-bold text-lg">${m.totalCost.toFixed(2)}</p>{m.laborCost && m.partsCost && <p className="text-xs text-gray-500">Labor: ${m.laborCost} | Parts: ${m.partsCost}</p>}</div>}</div></CardContent></Card>))}</div>
          </TabsContent>

          <TabsContent value="fuel" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 mb-6"><Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Total Fuel (30d)</p><p className="text-3xl font-bold">{fuel.filter(f => new Date(f.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).reduce((s, f) => s + f.quantity, 0).toFixed(0)}L</p></CardContent></Card><Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Total Cost (30d)</p><p className="text-3xl font-bold text-green-600">${stats.monthlyFuel.toFixed(2)}</p></CardContent></Card><Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Avg Cost/L</p><p className="text-3xl font-bold">${(fuel.reduce((s, f) => s + f.unitCost, 0) / fuel.length).toFixed(2)}</p></CardContent></Card></div>
            <Card><CardContent className="p-0"><table className="w-full"><thead className="bg-gray-50"><tr><th className="text-left p-4 text-sm font-medium">Date</th><th className="text-left p-4 text-sm font-medium">Asset</th><th className="text-left p-4 text-sm font-medium">Fuel</th><th className="text-right p-4 text-sm font-medium">Qty (L)</th><th className="text-right p-4 text-sm font-medium">$/L</th><th className="text-right p-4 text-sm font-medium">Total</th><th className="text-left p-4 text-sm font-medium">Location</th></tr></thead><tbody className="divide-y">{fuel.map(f => (<tr key={f.id}><td className="p-4 text-sm">{format(new Date(f.date), 'MMM d, yyyy')}</td><td className="p-4 text-sm font-medium">{f.assetName}</td><td className="p-4"><Badge variant="outline">{f.fuelType}</Badge></td><td className="p-4 text-sm text-right">{f.quantity}</td><td className="p-4 text-sm text-right">${f.unitCost.toFixed(2)}</td><td className="p-4 text-sm text-right font-medium">${f.totalCost.toFixed(2)}</td><td className="p-4 text-sm text-gray-500">{f.location}</td></tr>))}</tbody></table></CardContent></Card>
          </TabsContent>

          <TabsContent value="depreciation" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 mb-6"><Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Original Value</p><p className="text-3xl font-bold">${assets.reduce((s, a) => s + (a.purchasePrice || 0), 0).toLocaleString()}</p></CardContent></Card><Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Current Value</p><p className="text-3xl font-bold text-green-600">${stats.totalValue.toLocaleString()}</p></CardContent></Card><Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Total Depreciation</p><p className="text-3xl font-bold text-red-600">${stats.totalDepreciation.toLocaleString()}</p></CardContent></Card></div>
            <Card><CardContent className="p-0"><table className="w-full"><thead className="bg-gray-50"><tr><th className="text-left p-4 text-sm font-medium">Asset</th><th className="text-left p-4 text-sm font-medium">Purchase</th><th className="text-right p-4 text-sm font-medium">Original</th><th className="text-right p-4 text-sm font-medium">Current</th><th className="text-right p-4 text-sm font-medium">Depreciated</th><th className="text-left p-4 text-sm font-medium">Method</th><th className="p-4 text-sm font-medium">Progress</th></tr></thead><tbody className="divide-y">{assets.filter(a => a.depreciationMethod !== 'none').map(a => { const dep = calculateDepreciation(a); return (<tr key={a.id}><td className="p-4"><div className="flex items-center gap-2">{getCategoryIcon(a.category)}<span className="font-medium text-sm">{a.name}</span></div></td><td className="p-4 text-sm">{a.purchaseDate ? format(new Date(a.purchaseDate), 'MMM yyyy') : '-'}</td><td className="p-4 text-sm text-right">${a.purchasePrice?.toLocaleString()}</td><td className="p-4 text-sm text-right font-medium text-green-600">${a.currentValue?.toLocaleString()}</td><td className="p-4 text-sm text-right text-red-600">${dep?.total.toFixed(0)}</td><td className="p-4"><Badge variant="outline">{a.depreciationMethod.replace('_', ' ')}</Badge></td><td className="p-4 w-32"><div className="flex items-center gap-2"><Progress value={dep?.percent || 0} className="h-2" /><span className="text-xs text-gray-500">{dep?.percent.toFixed(0)}%</span></div></td></tr>); })}</tbody></table></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
