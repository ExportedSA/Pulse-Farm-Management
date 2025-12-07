import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { QrCode, Plus, Download, Copy, Eye, Edit, Trash2, MapPin, Calendar, Users, Activity, CheckCircle, XCircle, Clock, BarChart3, Printer, Share2, Link2, RefreshCw } from 'lucide-react';

interface QRCodeEntry {
  id: string;
  name: string;
  location: string;
  type: 'visitor_signin' | 'equipment_checkout' | 'area_access' | 'safety_checkin' | 'custom';
  description?: string;
  url: string;
  shortCode: string;
  isActive: boolean;
  requiresInduction: boolean;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
  scans: number;
  lastScanned?: string;
}

interface ScanLog {
  id: string;
  qrCodeId: string;
  qrCodeName: string;
  scannedBy: string;
  scannedAt: string;
  location: string;
  deviceInfo?: string;
  action: string;
}

// Mock Data
const mockQRCodes: QRCodeEntry[] = [
  { id: 'qr-1', name: 'Main Entrance Sign-In', location: 'Main Gate', type: 'visitor_signin', description: 'Primary visitor check-in point', url: 'https://pulse.farm/v/main-gate', shortCode: 'MAIN01', isActive: true, requiresInduction: true, createdAt: '2024-01-01T09:00:00Z', createdBy: 'John Smith', scans: 156, lastScanned: '2024-01-18T14:30:00Z' },
  { id: 'qr-2', name: 'Workshop Access', location: 'Workshop Building', type: 'area_access', description: 'Workshop entry point', url: 'https://pulse.farm/v/workshop', shortCode: 'WORK01', isActive: true, requiresInduction: true, createdAt: '2024-01-05T10:00:00Z', createdBy: 'John Smith', scans: 89, lastScanned: '2024-01-18T11:15:00Z' },
  { id: 'qr-3', name: 'Chemical Shed', location: 'Chemical Storage', type: 'safety_checkin', description: 'Hazardous area - PPE required', url: 'https://pulse.farm/v/chem-shed', shortCode: 'CHEM01', isActive: true, requiresInduction: true, createdAt: '2024-01-08T08:00:00Z', createdBy: 'Sarah Johnson', scans: 34, lastScanned: '2024-01-17T09:45:00Z' },
  { id: 'qr-4', name: 'Equipment Checkout', location: 'Tool Shed', type: 'equipment_checkout', description: 'Log equipment borrowing', url: 'https://pulse.farm/v/equip', shortCode: 'EQUIP1', isActive: true, requiresInduction: false, createdAt: '2024-01-10T14:00:00Z', createdBy: 'Mike Wilson', scans: 67, lastScanned: '2024-01-18T08:20:00Z' },
  { id: 'qr-5', name: 'Back Paddock Gate', location: 'Back Paddock', type: 'visitor_signin', description: 'Secondary entrance for contractors', url: 'https://pulse.farm/v/back-gate', shortCode: 'BACK01', isActive: false, requiresInduction: true, expiresAt: '2024-02-01', createdAt: '2024-01-12T11:00:00Z', createdBy: 'John Smith', scans: 12, lastScanned: '2024-01-15T16:00:00Z' },
];

const mockScanLogs: ScanLog[] = [
  { id: 'scan-1', qrCodeId: 'qr-1', qrCodeName: 'Main Entrance Sign-In', scannedBy: 'James Wilson', scannedAt: '2024-01-18T14:30:00Z', location: 'Main Gate', action: 'Visitor Sign-In' },
  { id: 'scan-2', qrCodeId: 'qr-4', qrCodeName: 'Equipment Checkout', scannedBy: 'Sarah Johnson', scannedAt: '2024-01-18T08:20:00Z', location: 'Tool Shed', action: 'Equipment Borrowed' },
  { id: 'scan-3', qrCodeId: 'qr-2', qrCodeName: 'Workshop Access', scannedBy: 'Mike Brown', scannedAt: '2024-01-18T11:15:00Z', location: 'Workshop', action: 'Area Access' },
  { id: 'scan-4', qrCodeId: 'qr-3', qrCodeName: 'Chemical Shed', scannedBy: 'John Smith', scannedAt: '2024-01-17T09:45:00Z', location: 'Chemical Storage', action: 'Safety Check-In' },
  { id: 'scan-5', qrCodeId: 'qr-1', qrCodeName: 'Main Entrance Sign-In', scannedBy: 'Emily Davis', scannedAt: '2024-01-17T08:00:00Z', location: 'Main Gate', action: 'Visitor Sign-In' },
];

export default function QRCodeManagementPage() {
  const [activeTab, setActiveTab] = useState('codes');
  const [qrCodes, setQRCodes] = useState<QRCodeEntry[]>(mockQRCodes);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>(mockScanLogs);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QRCodeEntry | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [newQR, setNewQR] = useState({
    name: '', location: '', type: 'visitor_signin' as QRCodeEntry['type'],
    description: '', requiresInduction: true, expiresAt: '',
  });

  // Stats
  const stats = {
    total: qrCodes.length,
    active: qrCodes.filter(q => q.isActive).length,
    totalScans: qrCodes.reduce((s, q) => s + q.scans, 0),
    todayScans: scanLogs.filter(l => new Date(l.scannedAt).toDateString() === new Date().toDateString()).length,
  };

  const generateShortCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  };

  const handleCreate = () => {
    const shortCode = generateShortCode();
    const qr: QRCodeEntry = {
      id: `qr-${Date.now()}`, ...newQR, shortCode,
      url: `https://pulse.farm/v/${shortCode.toLowerCase()}`,
      isActive: true, createdAt: new Date().toISOString(),
      createdBy: 'Current User', scans: 0,
    };
    setQRCodes([qr, ...qrCodes]);
    setIsCreateOpen(false);
    setNewQR({ name: '', location: '', type: 'visitor_signin', description: '', requiresInduction: true, expiresAt: '' });
    toast.success('QR Code created successfully');
  };

  const toggleActive = (id: string) => {
    setQRCodes(qrCodes.map(q => q.id === id ? { ...q, isActive: !q.isActive } : q));
    toast.success('QR Code status updated');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getTypeColor = (type: QRCodeEntry['type']) => {
    switch (type) {
      case 'visitor_signin': return 'bg-green-100 text-green-800';
      case 'equipment_checkout': return 'bg-blue-100 text-blue-800';
      case 'area_access': return 'bg-purple-100 text-purple-800';
      case 'safety_checkin': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: QRCodeEntry['type']) => {
    switch (type) {
      case 'visitor_signin': return 'Visitor Sign-In';
      case 'equipment_checkout': return 'Equipment Checkout';
      case 'area_access': return 'Area Access';
      case 'safety_checkin': return 'Safety Check-In';
      default: return 'Custom';
    }
  };

  const filteredQRCodes = qrCodes.filter(q => {
    const matchType = typeFilter === 'all' || q.type === typeFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? q.isActive : !q.isActive);
    return matchType && matchStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg"><QrCode className="h-6 w-6 text-purple-600" /></div>
              <div><h1 className="text-2xl font-bold text-gray-900">QR Code Management</h1><p className="text-sm text-gray-500">Create and manage access QR codes</p></div>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild><Button className="bg-purple-600 hover:bg-purple-700"><Plus className="h-4 w-4 mr-2" />Create QR Code</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create New QR Code</DialogTitle><DialogDescription>Generate a QR code for visitor access or equipment tracking</DialogDescription></DialogHeader>
                <div className="space-y-4 py-4">
                  <div><Label>Name *</Label><Input value={newQR.name} onChange={(e) => setNewQR({ ...newQR, name: e.target.value })} placeholder="e.g., Main Entrance Sign-In" /></div>
                  <div><Label>Location *</Label><Input value={newQR.location} onChange={(e) => setNewQR({ ...newQR, location: e.target.value })} placeholder="e.g., Main Gate" /></div>
                  <div><Label>Type</Label><Select value={newQR.type} onValueChange={(v: any) => setNewQR({ ...newQR, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="visitor_signin">Visitor Sign-In</SelectItem><SelectItem value="equipment_checkout">Equipment Checkout</SelectItem><SelectItem value="area_access">Area Access</SelectItem><SelectItem value="safety_checkin">Safety Check-In</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></div>
                  <div><Label>Description</Label><Textarea value={newQR.description} onChange={(e) => setNewQR({ ...newQR, description: e.target.value })} rows={2} /></div>
                  <div className="flex items-center justify-between"><Label>Requires Safety Induction</Label><Switch checked={newQR.requiresInduction} onCheckedChange={(c) => setNewQR({ ...newQR, requiresInduction: c })} /></div>
                  <div><Label>Expiry Date (optional)</Label><Input type="date" value={newQR.expiresAt} onChange={(e) => setNewQR({ ...newQR, expiresAt: e.target.value })} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={!newQR.name || !newQR.location}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Total QR Codes</p><p className="text-2xl font-bold">{stats.total}</p></div><QrCode className="h-8 w-8 text-gray-200" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Active</p><p className="text-2xl font-bold text-green-600">{stats.active}</p></div><CheckCircle className="h-8 w-8 text-green-200" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Total Scans</p><p className="text-2xl font-bold text-blue-600">{stats.totalScans}</p></div><BarChart3 className="h-8 w-8 text-blue-200" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Today's Scans</p><p className="text-2xl font-bold text-purple-600">{stats.todayScans}</p></div><Activity className="h-8 w-8 text-purple-200" /></div></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6"><TabsTrigger value="codes">QR Codes</TabsTrigger><TabsTrigger value="scans">Scan History</TabsTrigger><TabsTrigger value="analytics">Analytics</TabsTrigger></TabsList>

          {/* QR Codes Tab */}
          <TabsContent value="codes" className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="visitor_signin">Visitor Sign-In</SelectItem><SelectItem value="equipment_checkout">Equipment Checkout</SelectItem><SelectItem value="area_access">Area Access</SelectItem><SelectItem value="safety_checkin">Safety Check-In</SelectItem></SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQRCodes.map(qr => (
                <Card key={qr.id} className={`${qr.isActive ? '' : 'opacity-60'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                          <QrCode className="h-8 w-8 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{qr.name}</h3>
                          <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{qr.location}</p>
                        </div>
                      </div>
                      <Switch checked={qr.isActive} onCheckedChange={() => toggleActive(qr.id)} />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge className={getTypeColor(qr.type)}>{getTypeLabel(qr.type)}</Badge>
                        {qr.requiresInduction && <Badge variant="outline" className="text-orange-600 border-orange-200">Induction Required</Badge>}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Short Code:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded font-mono">{qr.shortCode}</code>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Total Scans:</span>
                        <span className="font-medium">{qr.scans}</span>
                      </div>

                      {qr.lastScanned && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Last Scanned:</span>
                          <span>{format(new Date(qr.lastScanned), 'MMM d, h:mm a')}</span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedQR(qr); setIsPreviewOpen(true); }}><Eye className="h-3 w-3 mr-1" />View</Button>
                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(qr.url)}><Copy className="h-3 w-3" /></Button>
                        <Button variant="outline" size="sm"><Download className="h-3 w-3" /></Button>
                        <Button variant="outline" size="sm"><Printer className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Scan History Tab */}
          <TabsContent value="scans">
            <Card><CardContent className="p-0"><table className="w-full"><thead className="bg-gray-50"><tr><th className="text-left p-4 text-sm font-medium">Time</th><th className="text-left p-4 text-sm font-medium">QR Code</th><th className="text-left p-4 text-sm font-medium">Scanned By</th><th className="text-left p-4 text-sm font-medium">Location</th><th className="text-left p-4 text-sm font-medium">Action</th></tr></thead><tbody className="divide-y">{scanLogs.map(log => (<tr key={log.id}><td className="p-4 text-sm">{format(new Date(log.scannedAt), 'MMM d, h:mm a')}</td><td className="p-4 text-sm font-medium">{log.qrCodeName}</td><td className="p-4 text-sm">{log.scannedBy}</td><td className="p-4 text-sm text-gray-500">{log.location}</td><td className="p-4"><Badge variant="outline">{log.action}</Badge></td></tr>))}</tbody></table></CardContent></Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle className="text-lg">Scans by QR Code</CardTitle></CardHeader><CardContent><div className="space-y-4">{qrCodes.sort((a, b) => b.scans - a.scans).slice(0, 5).map(qr => (<div key={qr.id} className="flex items-center gap-4"><div className="flex-1"><div className="flex justify-between mb-1"><span className="text-sm font-medium">{qr.name}</span><span className="text-sm text-gray-500">{qr.scans} scans</span></div><div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${(qr.scans / Math.max(...qrCodes.map(q => q.scans))) * 100}%` }} /></div></div></div>))}</div></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-lg">Scans by Type</CardTitle></CardHeader><CardContent><div className="space-y-4">{['visitor_signin', 'equipment_checkout', 'area_access', 'safety_checkin'].map(type => { const count = qrCodes.filter(q => q.type === type).reduce((s, q) => s + q.scans, 0); return (<div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><Badge className={getTypeColor(type as QRCodeEntry['type'])}>{getTypeLabel(type as QRCodeEntry['type'])}</Badge></div><span className="font-bold">{count}</span></div>); })}</div></CardContent></Card>
            </div>
            <Card><CardHeader><CardTitle className="text-lg">Recent Activity</CardTitle></CardHeader><CardContent><div className="space-y-3">{scanLogs.slice(0, 10).map(log => (<div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><QrCode className="h-4 w-4 text-purple-600" /><div><p className="font-medium text-sm">{log.scannedBy}</p><p className="text-xs text-gray-500">{log.qrCodeName}</p></div></div><div className="text-right"><p className="text-sm">{log.action}</p><p className="text-xs text-gray-500">{format(new Date(log.scannedAt), 'MMM d, h:mm a')}</p></div></div>))}</div></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{selectedQR?.name}</DialogTitle></DialogHeader>
          {selectedQR && (
            <div className="space-y-4 py-4">
              <div className="flex justify-center"><div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300"><QrCode className="h-24 w-24 text-gray-400" /></div></div>
              <div className="text-center"><p className="text-sm text-gray-500">Scan this QR code or visit:</p><code className="text-sm bg-gray-100 px-3 py-1 rounded block mt-2">{selectedQR.url}</code></div>
              <div className="grid grid-cols-2 gap-4 text-sm"><div><span className="text-gray-500">Location:</span><p className="font-medium">{selectedQR.location}</p></div><div><span className="text-gray-500">Type:</span><p><Badge className={getTypeColor(selectedQR.type)}>{getTypeLabel(selectedQR.type)}</Badge></p></div><div><span className="text-gray-500">Total Scans:</span><p className="font-medium">{selectedQR.scans}</p></div><div><span className="text-gray-500">Status:</span><p><Badge variant={selectedQR.isActive ? 'default' : 'secondary'}>{selectedQR.isActive ? 'Active' : 'Inactive'}</Badge></p></div></div>
              <div className="flex gap-2"><Button className="flex-1" onClick={() => copyToClipboard(selectedQR.url)}><Copy className="h-4 w-4 mr-2" />Copy Link</Button><Button variant="outline" className="flex-1"><Download className="h-4 w-4 mr-2" />Download</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
