import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Download, 
  Plus,
  Search,
  Filter,
  Calendar,
  User,
  Shield,
  Heart,
  Truck,
  Droplets,
  Microscope,
  BookOpen,
  ClipboardList,
  Users,
  Leaf,
  Tag,
  Milk,
  UserCheck,
  DoorOpen,
  FileCheck,
  Phone,
  AlertCircle,
  Key,
  FileText as FileText2,
  Users2,
  Radio,
  MapPin,
  UserX
} from 'lucide-react';

interface ComplianceDocument {
  id: string;
  title: string;
  type: DocumentType;
  category: DocumentCategory;
  region: 'NZ' | 'AU';
  status: DocumentStatus;
  expiryDate?: string;
  assignedTo?: string[];
  description: string;
  fileUrl?: string;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  complianceLevel: 'critical' | 'high' | 'medium' | 'low';
}

type DocumentType = 
  | 'risk_assessment'
  | 'safety_data_sheet'
  | 'training_record'
  | 'incident_report'
  | 'equipment_inspection'
  | 'emergency_procedure'
  | 'chemical_register'
  | 'biosecurity_plan'
  | 'animal_welfare_plan'
  | 'noise_assessment'
  | 'hazard_register'
  | 'contractor_safety'
  | 'environmental_management'
  | 'effluent_management'
  | 'livestock_traceability'
  | 'milking_hygiene'
  | 'visitor_sign_in_register'
  | 'site_induction_checklist'
  | 'contractor_pre_qualification'
  | 'emergency_contact_register'
  | 'hazard_acknowledgment'
  | 'site_access_permit'
  | 'contractor_method_statement'
  | 'people_on_site_log'
  | 'site_safety_briefing'
  | 'emergency_evacuation_plan'
  | 'lone_worker_procedure';

type DocumentCategory = 
  | 'health_safety'
  | 'chemical_management'
  | 'equipment_safety'
  | 'animal_health'
  | 'biosecurity'
  | 'training_competency'
  | 'emergency_response'
  | 'environmental';

type DocumentStatus = 'draft' | 'pending_review' | 'approved' | 'expired' | 'archived';

const documentTypes: { type: DocumentType; label: string; icon: any; description: string }[] = [
  {
    type: 'risk_assessment',
    label: 'Risk Assessment',
    icon: AlertTriangle,
    description: 'Workplace risk assessments and hazard identification'
  },
  {
    type: 'safety_data_sheet',
    label: 'Safety Data Sheet',
    icon: FileText,
    description: 'Chemical and substance safety documentation'
  },
  {
    type: 'training_record',
    label: 'Training Record',
    icon: BookOpen,
    description: 'Staff training and competency records'
  },
  {
    type: 'incident_report',
    label: 'Incident Report',
    icon: ClipboardList,
    description: 'Workplace incidents, accidents, and near misses'
  },
  {
    type: 'equipment_inspection',
    label: 'Equipment Inspection',
    icon: Truck,
    description: 'Machinery and equipment safety inspections'
  },
  {
    type: 'emergency_procedure',
    label: 'Emergency Procedure',
    icon: Shield,
    description: 'Emergency response and evacuation procedures'
  },
  {
    type: 'chemical_register',
    label: 'Chemical Register',
    icon: Droplets,
    description: 'Farm chemical inventory and usage records'
  },
  {
    type: 'biosecurity_plan',
    label: 'Biosecurity Plan',
    icon: Microscope,
    description: 'Biosecurity and disease prevention measures'
  },
  {
    type: 'animal_welfare_plan',
    label: 'Animal Welfare Plan',
    icon: Heart,
    description: 'Animal health and welfare documentation'
  },
  {
    type: 'hazard_register',
    label: 'Hazard Register',
    icon: AlertTriangle,
    description: 'Complete register of all workplace hazards'
  },
  {
    type: 'contractor_safety',
    label: 'Contractor Safety Management',
    icon: Users,
    description: 'Contractor induction, safety procedures, and compliance'
  },
  {
    type: 'environmental_management',
    label: 'Environmental Management Plan',
    icon: Leaf,
    description: 'Resource consent compliance and environmental protection'
  },
  {
    type: 'effluent_management',
    label: 'Effluent Management Plan',
    icon: Droplets,
    description: 'Dairy effluent treatment and environmental compliance'
  },
  {
    type: 'livestock_traceability',
    label: 'Livestock Traceability (NAIT/LPA)',
    icon: Tag,
    description: 'NAIT (NZ) and LPA (AU) livestock tracking records'
  },
  {
    type: 'milking_hygiene',
    label: 'Milking Shed Hygiene Records',
    icon: Milk,
    description: 'Dairy milking facility hygiene and safety documentation'
  },
  {
    type: 'visitor_sign_in_register',
    label: 'Visitor Sign-In Register',
    icon: DoorOpen,
    description: 'Digital visitor sign-in/out logs with emergency contact collection'
  },
  {
    type: 'site_induction_checklist',
    label: 'Site Induction Checklist',
    icon: UserCheck,
    description: 'Site-specific induction for visitors, contractors, and employees'
  },
  {
    type: 'contractor_pre_qualification',
    label: 'Contractor Pre-Qualification',
    icon: FileCheck,
    description: 'Contractor insurance, licenses, and competency verification'
  },
  {
    type: 'emergency_contact_register',
    label: 'Emergency Contact Register',
    icon: Phone,
    description: 'Emergency contacts for all personnel on site'
  },
  {
    type: 'hazard_acknowledgment',
    label: 'Hazard Acknowledgment Form',
    icon: AlertCircle,
    description: 'Site-specific hazard acknowledgment and sign-off'
  },
  {
    type: 'site_access_permit',
    label: 'Site Access Permit',
    icon: Key,
    description: 'Authorized access permits for restricted areas'
  },
  {
    type: 'contractor_method_statement',
    label: 'Contractor Method Statement',
    icon: FileText2,
    description: 'Contractor work methods and safety procedures'
  },
  {
    type: 'people_on_site_log',
    label: 'People on Site Log',
    icon: Users2,
    description: 'Real-time log of all personnel currently on site'
  },
  {
    type: 'site_safety_briefing',
    label: 'Site Safety Briefing',
    icon: Radio,
    description: 'Daily safety briefing records and acknowledgments'
  },
  {
    type: 'emergency_evacuation_plan',
    label: 'Emergency Evacuation Plan',
    icon: MapPin,
    description: 'Site evacuation procedures and assembly point maps'
  },
  {
    type: 'lone_worker_procedure',
    label: 'Lone Worker Procedure',
    icon: UserX,
    description: 'Lone worker safety procedures and check-in systems'
  }
];

const complianceRequirements = {
  NZ: {
    critical: [
      'Health and Safety at Work Act 2015 compliance',
      'Hazard register (all identified hazards)',
      'Emergency procedures and evacuation plans',
      'Worker training records and competency',
      'Incident notification and reporting',
      'Contractor safety management and induction',
      'Visitor sign-in/out register with emergency contacts',
      'People on site log for emergency roll-call',
      'Site-specific induction checklists',
      'Digital signature audit trails for compliance'
    ],
    high: [
      'Chemical register and SDSs',
      'Equipment inspection records',
      'Risk assessments for high-risk work',
      'Noise assessments where required',
      'Environmental management plans',
      'Contractor pre-qualification and method statements',
      'Hazard acknowledgment forms',
      'Site access permits for restricted areas'
    ],
    medium: [
      'Animal welfare documentation',
      'Biosecurity plans',
      'Effluent management (dairy operations)',
      'NAIT livestock traceability records',
      'Milking shed hygiene records',
      'Lone worker procedures and check-in systems',
      'Daily safety briefing records',
      'Emergency contact registers'
    ]
  },
  AU: {
    critical: [
      'Work Health and Safety Act compliance',
      'Hazard identification and risk assessment',
      'Emergency response plans and evacuation procedures',
      'Worker training and induction records',
      'Incident reporting to Safe Work Australia',
      'Contractor safety management and procedures',
      'Visitor management with digital sign-in/out',
      'Real-time site presence tracking',
      'Site induction and safety briefings',
      'Digital audit trails with timestamped sign-offs'
    ],
    high: [
      'Chemical manifest and SDSs',
      'Plant and equipment maintenance',
      'High risk work licenses',
      'Workplace monitoring records',
      'Environmental protection plans',
      'Contractor pre-qualification and method statements',
      'Hazard acknowledgment and sign-off forms',
      'Site access control and permits'
    ],
    medium: [
      'Animal handling procedures',
      'LPA livestock traceability',
      'Effluent and environmental management',
      'Contractor management documentation',
      'Safety data management systems',
      'Lone worker safety procedures',
      'Site safety briefing records',
      'Emergency contact and communication registers'
    ]
  }
};

export default function ComplianceDocsPage() {
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<'NZ' | 'AU'>('NZ');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Mock data for demonstration
  useEffect(() => {
    const mockDocuments: ComplianceDocument[] = [
      {
        id: '1',
        title: 'Farm Hazard Register 2024',
        type: 'hazard_register',
        category: 'health_safety',
        region: 'NZ',
        status: 'approved',
        expiryDate: '2025-01-31',
        description: 'Complete register of all identified farm hazards and control measures',
        createdAt: '2024-01-15',
        updatedAt: '2024-01-15',
        reviewedBy: 'Farm Manager',
        reviewedAt: '2024-01-16',
        complianceLevel: 'critical'
      },
      {
        id: '2',
        title: 'Chemical Safety Data Sheets',
        type: 'safety_data_sheet',
        category: 'chemical_management',
        region: 'NZ',
        status: 'approved',
        description: 'Safety data sheets for all farm chemicals and substances',
        createdAt: '2024-01-10',
        updatedAt: '2024-01-10',
        reviewedBy: 'Health & Safety Officer',
        reviewedAt: '2024-01-12',
        complianceLevel: 'high'
      },
      {
        id: '3',
        title: 'Staff Training Records',
        type: 'training_record',
        category: 'training_competency',
        region: 'NZ',
        status: 'pending_review',
        description: 'Records of all staff training and competency assessments',
        createdAt: '2024-02-01',
        updatedAt: '2024-02-01',
        complianceLevel: 'critical'
      },
      {
        id: '4',
        title: 'Tractor Inspection Log',
        type: 'equipment_inspection',
        category: 'equipment_safety',
        region: 'NZ',
        status: 'approved',
        expiryDate: '2024-12-31',
        description: 'Monthly inspection and maintenance records for all tractors',
        createdAt: '2024-01-01',
        updatedAt: '2024-11-01',
        reviewedBy: 'Mechanic',
        reviewedAt: '2024-11-02',
        complianceLevel: 'high'
      },
      {
        id: '5',
        title: 'Emergency Response Plan',
        type: 'emergency_procedure',
        category: 'emergency_response',
        region: 'NZ',
        status: 'approved',
        description: 'Farm emergency procedures including fire, medical, and chemical spills',
        createdAt: '2024-01-05',
        updatedAt: '2024-01-05',
        reviewedBy: 'Farm Manager',
        reviewedAt: '2024-01-06',
        complianceLevel: 'critical'
      }
    ];
    
    setDocuments(mockDocuments);
    setLoading(false);
  }, []);

  const filteredDocuments = documents.filter(doc => {
    const matchesRegion = doc.region === selectedRegion;
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesType = selectedType === 'all' || doc.type === selectedType;
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesRegion && matchesCategory && matchesType && matchesSearch;
  });

  const getStatusColor = (status: DocumentStatus) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending_review': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'expired': return 'bg-red-100 text-red-800 border-red-200';
      case 'archived': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getComplianceColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: DocumentType) => {
    const docType = documentTypes.find(dt => dt.type === type);
    return docType ? docType.icon : FileText;
  };

  if (loading) {
    return <div className="p-8">Loading compliance documents...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="h-8 w-8 text-pulse-forest" />
              Compliance Documentation
            </h1>
            <p className="text-gray-600 mt-2">
              Manage health and safety compliance for {selectedRegion === 'NZ' ? 'New Zealand' : 'Australia'} farming operations
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                <Plus className="h-4 w-4 mr-2" />
                New Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Compliance Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Region</label>
                    <Select value={selectedRegion} onValueChange={(value: 'NZ' | 'AU') => setSelectedRegion(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NZ">New Zealand</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Document Type</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map(type => (
                          <SelectItem key={type.type} value={type.type}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Document Title</label>
                  <Input placeholder="Enter document title" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea placeholder="Describe the document purpose and content" rows={3} />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                    Create Document
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Region Toggle */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={selectedRegion === 'NZ' ? 'default' : 'outline'}
            onClick={() => setSelectedRegion('NZ')}
            className={selectedRegion === 'NZ' ? 'bg-pulse-forest hover:bg-pulse-forest-dark' : ''}
          >
            New Zealand
          </Button>
          <Button
            variant={selectedRegion === 'AU' ? 'default' : 'outline'}
            onClick={() => setSelectedRegion('AU')}
            className={selectedRegion === 'AU' ? 'bg-pulse-forest hover:bg-pulse-forest-dark' : ''}
          >
            Australia
          </Button>
        </div>
      </div>

      {/* Compliance Requirements Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Critical Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {complianceRequirements[selectedRegion].critical.map((req, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="text-gray-700">{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              High Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {complianceRequirements[selectedRegion].high.map((req, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="text-gray-700">{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Medium Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {complianceRequirements[selectedRegion].medium.map((req, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="text-gray-700">{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="health_safety">Health & Safety</SelectItem>
              <SelectItem value="chemical_management">Chemical Management</SelectItem>
              <SelectItem value="equipment_safety">Equipment Safety</SelectItem>
              <SelectItem value="animal_health">Animal Health</SelectItem>
              <SelectItem value="biosecurity">Biosecurity</SelectItem>
              <SelectItem value="training_competency">Training & Competency</SelectItem>
              <SelectItem value="emergency_response">Emergency Response</SelectItem>
              <SelectItem value="environmental">Environmental</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Document Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {documentTypes.map(type => (
                <SelectItem key={type.type} value={type.type}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Documents List */}
      <div className="grid gap-4">
        {filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No compliance documents found</p>
              <p className="text-sm text-gray-400 mt-2">Create your first document to get started</p>
            </CardContent>
          </Card>
        ) : (
          filteredDocuments.map(doc => {
            const Icon = getTypeIcon(doc.type);
            return (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-3 bg-pulse-50 rounded-lg">
                        <Icon className="h-6 w-6 text-pulse-forest" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{doc.title}</h3>
                          <Badge className={getComplianceColor(doc.complianceLevel)}>
                            {doc.complianceLevel}
                          </Badge>
                          <Badge className={getStatusColor(doc.status)}>
                            {doc.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">{doc.description}</p>
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Created: {new Date(doc.createdAt).toLocaleDateString()}
                          </div>
                          {doc.expiryDate && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                            </div>
                          )}
                          {doc.reviewedBy && (
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              Reviewed by: {doc.reviewedBy}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <FileText className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
