import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, AlertTriangle, CheckCircle, Clock, FileText, Plus, Bell, Shield } from 'lucide-react';
import { format, addDays, isBefore, isAfter } from 'date-fns';

interface ContractorDocument {
  id: string;
  contractorId: string;
  contractorName: string;
  documentType: 'insurance' | 'license' | 'certification' | 'induction' | 'method_statement' | 'health_safety_policy';
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'missing';
  alertSent: boolean;
  documentUrl?: string;
  notes: string;
}

interface Contractor {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  documents: ContractorDocument[];
}

const documentTypes = [
  { value: 'insurance', label: 'Public Liability Insurance', required: true },
  { value: 'license', label: 'Trade License', required: true },
  { value: 'certification', label: 'Professional Certification', required: false },
  { value: 'induction', label: 'Site Induction Certificate', required: true },
  { value: 'method_statement', label: 'Method Statement', required: true },
  { value: 'health_safety_policy', label: 'Health & Safety Policy', required: true }
];

export default function ContractorDocumentTracker() {
  const [contractors, setContractors] = useState<Contractor[]>([
    {
      id: '1',
      name: 'John Smith',
      company: 'Farm Maintenance Ltd',
      phone: '+64 21 123 4567',
      email: 'john@farmmaintenance.co.nz',
      status: 'active',
      documents: [
        {
          id: '1',
          contractorId: '1',
          contractorName: 'John Smith',
          documentType: 'insurance',
          documentNumber: 'POL-123456',
          issueDate: '2024-01-01',
          expiryDate: '2024-12-31',
          status: 'expiring_soon',
          alertSent: false,
          notes: 'Public liability insurance for farm work'
        },
        {
          id: '2',
          contractorId: '1',
          contractorName: 'John Smith',
          documentType: 'license',
          documentNumber: 'LIC-789012',
          issueDate: '2023-06-01',
          expiryDate: '2025-06-01',
          status: 'valid',
          alertSent: false,
          notes: 'Electrical trade license'
        }
      ]
    },
    {
      id: '2',
      name: 'Sarah Wilson',
      company: 'AgriTech Solutions',
      phone: '+64 21 234 5678',
      email: 'sarah@agritech.co.nz',
      status: 'active',
      documents: [
        {
          id: '3',
          contractorId: '2',
          contractorName: 'Sarah Wilson',
          documentType: 'insurance',
          documentNumber: 'POL-345678',
          issueDate: '2023-12-01',
          expiryDate: '2024-11-30',
          status: 'expired',
          alertSent: true,
          notes: 'Insurance expired - urgent renewal required'
        }
      ]
    }
  ]);

  const [isDocumentOpen, setIsDocumentOpen] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState<string>('');
  const [newDocument, setNewDocument] = useState({
    documentType: '',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    notes: ''
  });

  // Check document statuses and update alerts
  useEffect(() => {
    const checkDocumentStatuses = () => {
      setContractors(prev => prev.map(contractor => ({
        ...contractor,
        documents: contractor.documents.map(doc => {
          const today = new Date();
          const expiry = new Date(doc.expiryDate);
          const thirtyDaysFromNow = addDays(today, 30);
          
          let status: 'valid' | 'expiring_soon' | 'expired' | 'missing' = 'valid';
          
          if (isBefore(expiry, today)) {
            status = 'expired';
          } else if (isBefore(expiry, thirtyDaysFromNow)) {
            status = 'expiring_soon';
          }
          
          return { ...doc, status };
        })
      })));
    };

    checkDocumentStatuses();
    const interval = setInterval(checkDocumentStatuses, 24 * 60 * 60 * 1000); // Check daily
    return () => clearInterval(interval);
  }, []);

  const handleAddDocument = () => {
    if (!selectedContractor || !newDocument.documentType || !newDocument.expiryDate) {
      alert('Please fill in all required fields');
      return;
    }

    const contractor = contractors.find(c => c.id === selectedContractor);
    if (!contractor) return;

    const document: ContractorDocument = {
      id: Date.now().toString(),
      contractorId: selectedContractor,
      contractorName: contractor.name,
      documentType: newDocument.documentType as any,
      documentNumber: newDocument.documentNumber,
      issueDate: newDocument.issueDate,
      expiryDate: newDocument.expiryDate,
      status: 'valid',
      alertSent: false,
      notes: newDocument.notes
    };

    setContractors(prev => prev.map(c => 
      c.id === selectedContractor 
        ? { ...c, documents: [...c.documents, document] }
        : c
    ));

    // Reset form
    setNewDocument({
      documentType: '',
      documentNumber: '',
      issueDate: '',
      expiryDate: '',
      notes: ''
    });
    setIsDocumentOpen(false);
  };

  const sendExpiryAlert = (document: ContractorDocument) => {
    // In a real system, this would send email/SMS
    console.log('Sending expiry alert for:', document);
    
    setContractors(prev => prev.map(contractor => ({
      ...contractor,
      documents: contractor.documents.map(doc => 
        doc.id === document.id ? { ...doc, alertSent: true } : doc
      )
    })));

    alert(`Expiry alert sent to ${document.contractorName} for ${document.documentType}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'bg-green-100 text-green-800 border-green-200';
      case 'expiring_soon': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'expired': return 'bg-red-100 text-red-800 border-red-200';
      case 'missing': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    return documentTypes.find(dt => dt.value === type)?.label || type;
  };

  const expiredCount = contractors.flatMap(c => c.documents).filter(d => d.status === 'expired').length;
  const expiringSoonCount = contractors.flatMap(c => c.documents).filter(d => d.status === 'expiring_soon').length;
  const validCount = contractors.flatMap(c => c.documents).filter(d => d.status === 'valid').length;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{expiredCount}</div>
            <div className="text-sm text-gray-600">Expired Documents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{expiringSoonCount}</div>
            <div className="text-sm text-gray-600">Expiring Soon</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{validCount}</div>
            <div className="text-sm text-gray-600">Valid Documents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{contractors.length}</div>
            <div className="text-sm text-gray-600">Active Contractors</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-pulse-forest" />
              Contractor Document Tracking & Expiry Alerts
            </CardTitle>
            <Dialog open={isDocumentOpen} onOpenChange={setIsDocumentOpen}>
              <DialogTrigger asChild>
                <Button className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Contractor Document</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="contractor">Contractor *</Label>
                    <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select contractor" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractors.map(contractor => (
                          <SelectItem key={contractor.id} value={contractor.id}>
                            {contractor.name} - {contractor.company}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="documentType">Document Type *</Label>
                    <Select value={newDocument.documentType} onValueChange={(value) => 
                      setNewDocument(prev => ({ ...prev, documentType: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label} {type.required && <span className="text-red-500">*</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="documentNumber">Document Number</Label>
                      <Input
                        id="documentNumber"
                        value={newDocument.documentNumber}
                        onChange={(e) => setNewDocument(prev => ({ ...prev, documentNumber: e.target.value }))}
                        placeholder="Policy/License number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="issueDate">Issue Date</Label>
                      <Input
                        id="issueDate"
                        type="date"
                        value={newDocument.issueDate}
                        onChange={(e) => setNewDocument(prev => ({ ...prev, issueDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="expiryDate">Expiry Date *</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={newDocument.expiryDate}
                      onChange={(e) => setNewDocument(prev => ({ ...prev, expiryDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={newDocument.notes}
                      onChange={(e) => setNewDocument(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes or details"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-pulse-forest hover:bg-pulse-forest-dark text-white"
                      onClick={handleAddDocument}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Add Document
                    </Button>
                    <Button variant="outline" onClick={() => setIsDocumentOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {contractors.map(contractor => (
              <Card key={contractor.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{contractor.name}</h3>
                      <p className="text-sm text-gray-600">{contractor.company}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={contractor.status === 'active' ? 'default' : 'outline'}>
                          {contractor.status}
                        </Badge>
                        <span className="text-sm text-gray-500">{contractor.phone}</span>
                        <span className="text-sm text-gray-500">{contractor.email}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Documents</div>
                      <div className="font-semibold">{contractor.documents.length}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {contractor.documents.length === 0 ? (
                      <p className="text-sm text-gray-500">No documents on record</p>
                    ) : (
                      contractor.documents.map(document => (
                        <div key={document.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{getDocumentTypeLabel(document.documentType)}</span>
                              <Badge className={getStatusColor(document.status)}>
                                {document.status.replace('_', ' ')}
                              </Badge>
                              {document.alertSent && (
                                <Badge variant="outline" className="text-blue-600">
                                  <Bell className="h-3 w-3 mr-1" />
                                  Alert Sent
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              <span>#{document.documentNumber}</span>
                              <span className="mx-2">•</span>
                              <span>Expires: {format(new Date(document.expiryDate), 'dd MMM yyyy')}</span>
                              {document.notes && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span>{document.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {(document.status === 'expiring_soon' || document.status === 'expired') && !document.alertSent && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendExpiryAlert(document)}
                                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                              >
                                <Bell className="h-4 w-4 mr-2" />
                                Send Alert
                              </Button>
                            )}
                            <Button size="sm" variant="outline">
                              <FileText className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
