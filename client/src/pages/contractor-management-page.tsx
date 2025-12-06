import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Building2, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  MapPin,
  Calendar, 
  FileCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Star,
  StarHalf,
  Shield,
  Clock,
  DollarSign,
  ExternalLink,
  Upload
} from 'lucide-react';
import { pulseGet, pulsePost, pulsePut } from '@/lib/pulseApi';
import { toast } from 'sonner';

interface Contractor {
  id: string;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  serviceType?: string;
  taxNumber?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceExpiryDate?: string;
  healthSafetyPlanUrl?: string;
  preQualificationStatus?: string;
  preQualificationDate?: string;
  preQualificationExpiryDate?: string;
  rating?: number;
  notes?: string;
  isActive: boolean;
  documents?: ContractorDocument[];
  recentWork?: WorkRecord[];
}

interface ContractorDocument {
  id: string;
  contractorId: string;
  documentType: string;
  documentName: string;
  documentUrl?: string;
  expiryDate?: string;
  isVerified: boolean;
  verifiedAt?: string;
}

interface WorkRecord {
  id: string;
  contractorId: string;
  date: string;
  description: string;
  location?: string;
  hoursWorked?: string;
  cost?: string;
  invoiceNumber?: string;
  status: string;
}

const SERVICE_TYPES = [
  { value: 'fencing', label: 'Fencing' },
  { value: 'shearing', label: 'Shearing' },
  { value: 'veterinary', label: 'Veterinary' },
  { value: 'transport', label: 'Transport' },
  { value: 'earthworks', label: 'Earthworks' },
  { value: 'spraying', label: 'Spraying' },
  { value: 'fertilizer', label: 'Fertilizer Application' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'building', label: 'Building/Construction' },
  { value: 'other', label: 'Other' },
];

export default function ContractorManagementPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [isAddContractorOpen, setIsAddContractorOpen] = useState(false);
  const [isAddWorkOpen, setIsAddWorkOpen] = useState(false);

  // Fetch contractors
  const { data: contractors = [], isLoading } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => pulseGet<Contractor[]>('/contractors'),
  });

  // Filter contractors
  const filteredContractors = contractors.filter(c => {
    const matchesSearch = !searchQuery || 
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesService = serviceFilter === 'all' || c.serviceType === serviceFilter;
    const matchesStatus = statusFilter === 'all' || c.preQualificationStatus === statusFilter;
    
    return matchesSearch && matchesService && matchesStatus;
  });

  // Stats
  const approvedContractors = contractors.filter(c => c.preQualificationStatus === 'approved').length;
  const pendingContractors = contractors.filter(c => c.preQualificationStatus === 'pending').length;
  const expiredContractors = contractors.filter(c => c.preQualificationStatus === 'expired').length;

  const getStatusBadge = (status?: string) => {
    const styles: Record<string, string> = {
      approved: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={styles[status || 'pending'] || 'bg-gray-100 text-gray-800'}>
        {status?.charAt(0).toUpperCase() + (status?.slice(1) || '')}
      </Badge>
    );
  };

  const getServiceLabel = (type?: string) => {
    return SERVICE_TYPES.find(s => s.value === type)?.label || type || 'Unknown';
  };

  const renderStars = (rating?: number) => {
    if (!rating) return <span className="text-gray-400 text-sm">No rating</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star 
            key={i} 
            className={`h-4 w-4 ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
          />
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contractor Management</h1>
          <p className="text-gray-500 mt-1">Manage contractors, pre-qualification, and work records</p>
        </div>
        <Button onClick={() => setIsAddContractorOpen(true)} className="bg-pulse-forest hover:bg-pulse-forest-dark">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Contractor
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Contractors</p>
                <p className="text-2xl font-bold">{contractors.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-pulse-forest" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Approved</p>
                <p className="text-2xl font-bold text-green-600">{approvedContractors}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingContractors}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Expired/Rejected</p>
                <p className="text-2xl font-bold text-red-600">{expiredContractors}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contractors..."
            className="pl-10"
          />
        </div>
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Service Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {SERVICE_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contractors Grid */}
      {isLoading ? (
        <div className="text-center py-8">Loading contractors...</div>
      ) : filteredContractors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No contractors found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContractors.map(contractor => (
            <Card 
              key={contractor.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedContractor(contractor)}
            >
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{contractor.companyName}</h3>
                      <p className="text-sm text-gray-500">{contractor.contactName}</p>
                    </div>
                    {getStatusBadge(contractor.preQualificationStatus)}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{getServiceLabel(contractor.serviceType)}</Badge>
                    {renderStars(contractor.rating)}
                  </div>

                  <div className="space-y-2 text-sm text-gray-500">
                    {contractor.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {contractor.phone}
                      </div>
                    )}
                    {contractor.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {contractor.email}
                      </div>
                    )}
                  </div>

                  {contractor.insuranceExpiryDate && (
                    <div className="flex items-center gap-2 text-xs">
                      <Shield className="h-3 w-3" />
                      <span className={
                        new Date(contractor.insuranceExpiryDate) < new Date() 
                          ? 'text-red-600' 
                          : 'text-gray-500'
                      }>
                        Insurance expires: {new Date(contractor.insuranceExpiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Contractor Detail Dialog */}
      <Dialog open={!!selectedContractor} onOpenChange={() => setSelectedContractor(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contractor Details</DialogTitle>
          </DialogHeader>
          {selectedContractor && (
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="work">Work History</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6 mt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedContractor.companyName}</h2>
                    <p className="text-gray-500">{selectedContractor.contactName}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {getStatusBadge(selectedContractor.preQualificationStatus)}
                      <Badge variant="outline">{getServiceLabel(selectedContractor.serviceType)}</Badge>
                    </div>
                  </div>
                  {renderStars(selectedContractor.rating)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Email</Label>
                    <p>{selectedContractor.email || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Phone</Label>
                    <p>{selectedContractor.phone || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-gray-500">Address</Label>
                    <p>{selectedContractor.address || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Tax Number (IRD/GST)</Label>
                    <p>{selectedContractor.taxNumber || '-'}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Insurance Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-500">Provider</Label>
                      <p>{selectedContractor.insuranceProvider || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Policy Number</Label>
                      <p>{selectedContractor.insurancePolicyNumber || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Expiry Date</Label>
                      <p className={
                        selectedContractor.insuranceExpiryDate && new Date(selectedContractor.insuranceExpiryDate) < new Date()
                          ? 'text-red-600 font-medium'
                          : ''
                      }>
                        {selectedContractor.insuranceExpiryDate 
                          ? new Date(selectedContractor.insuranceExpiryDate).toLocaleDateString()
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Pre-Qualification</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-500">Status</Label>
                      <div className="mt-1">{getStatusBadge(selectedContractor.preQualificationStatus)}</div>
                    </div>
                    <div>
                      <Label className="text-gray-500">Approved Date</Label>
                      <p>{selectedContractor.preQualificationDate 
                        ? new Date(selectedContractor.preQualificationDate).toLocaleDateString()
                        : '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Expiry Date</Label>
                      <p>{selectedContractor.preQualificationExpiryDate 
                        ? new Date(selectedContractor.preQualificationExpiryDate).toLocaleDateString()
                        : '-'}</p>
                    </div>
                  </div>
                </div>

                {selectedContractor.preQualificationStatus === 'pending' && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => {
                      toast.success('Contractor approved');
                      setSelectedContractor(null);
                    }}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button variant="destructive" onClick={() => {
                      toast.error('Contractor rejected');
                      setSelectedContractor(null);
                    }}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Required Documents</h3>
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {['Insurance Certificate', 'Health & Safety Plan', 'Business License'].map((doc, i) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{doc}</p>
                            <p className="text-xs text-gray-500">Not uploaded</p>
                          </div>
                        </div>
                        <Badge variant="outline">Required</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="work" className="mt-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Work History</h3>
                    <Button size="sm" onClick={() => setIsAddWorkOpen(true)}>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Add Work Record
                    </Button>
                  </div>
                  
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p>No work records yet</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Contractor Dialog */}
      <Dialog open={isAddContractorOpen} onOpenChange={setIsAddContractorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contractor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Company Name *</Label>
              <Input placeholder="Company name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Name</Label>
                <Input placeholder="Contact person" />
              </div>
              <div>
                <Label>Service Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" placeholder="email@company.com" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input placeholder="027 123 4567" />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea placeholder="Full address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tax Number (IRD/GST)</Label>
                <Input placeholder="123-456-789" />
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Insurance Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Insurance Provider</Label>
                  <Input placeholder="Provider name" />
                </div>
                <div>
                  <Label>Policy Number</Label>
                  <Input placeholder="Policy number" />
                </div>
                <div>
                  <Label>Expiry Date</Label>
                  <Input type="date" />
                </div>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddContractorOpen(false)}>Cancel</Button>
            <Button className="bg-pulse-forest" onClick={() => {
              toast.success('Contractor added');
              setIsAddContractorOpen(false);
            }}>Add Contractor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
