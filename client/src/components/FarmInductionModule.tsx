import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DigitalSignaturePad from '@/components/DigitalSignaturePad';
import InductionCertificate from '@/components/InductionCertificate';
import SkillsMatrix from '@/components/SkillsMatrix';
import { 
  Users, 
  ClipboardCheck, 
  Map, 
  AlertTriangle, 
  BookOpen, 
  CheckCircle,
  Clock,
  Shield,
  Truck,
  UserCheck,
  FileText,
  Save,
  Send,
  Download,
  Eye,
  Calendar,
  Award,
  Target,
  Pen
} from 'lucide-react';

interface InductionRecord {
  id: string;
  type: 'new_worker' | 'contractor' | 'visitor';
  personName: string;
  role: string;
  company?: string;
  inductionDate: string;
  inductorName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'expired';
  expiryDate?: string;
  sections: {
    trainingRegister: boolean;
    contractorOrientation: boolean;
    hazardMap: boolean;
    emergencyProcedures: boolean;
    competencyAssessment: boolean;
  };
}

interface TrainingRecord {
  id: string;
  personId: string;
  skill: string;
  equipment: string;
  trainingDate: string;
  trainingProvider: string;
  competencyLevel: 'beginner' | 'competent' | 'expert';
  assessmentMethod: 'formal' | 'observation' | 'practical_test';
  nextAssessmentDate?: string;
  certificateExpiry?: string;
  notes: string;
  signature?: string;
}

interface CompetencyChecklist {
  id: string;
  category: string;
  items: {
    id: string;
    task: string;
    required: boolean;
    observed: boolean;
    notes: string;
    evidence: string;
  }[];
}

export default function FarmInductionModule() {
  const [activeTab, setActiveTab] = useState<'overview' | 'new_worker' | 'contractor' | 'training' | 'skills_matrix' | 'hazard_map' | 'emergency'>('overview');
  const [inductionType, setInductionType] = useState<'new_worker' | 'contractor'>('new_worker');
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPerson, setSelectedPerson] = useState<InductionRecord | null>(null);
  
  // Signature states
  const [inducteeSignature, setInducteeSignature] = useState<any>(null);
  const [inductorSignature, setInductorSignature] = useState<any>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [currentInductionData, setCurrentInductionData] = useState<any>(null);

  const [inductionRecords, setInductionRecords] = useState<InductionRecord[]>([
    {
      id: '1',
      type: 'new_worker',
      personName: 'Sarah Wilson',
      role: 'Farm Worker',
      inductionDate: '2024-11-15',
      inductorName: 'Tom Brown',
      status: 'completed',
      expiryDate: '2025-11-15',
      sections: {
        trainingRegister: true,
        contractorOrientation: false,
        hazardMap: true,
        emergencyProcedures: true,
        competencyAssessment: true
      }
    },
    {
      id: '2',
      type: 'contractor',
      personName: 'Mike Johnson',
      role: 'Electrician',
      company: 'AgriElectrical Ltd',
      inductionDate: '2024-11-28',
      inductorName: 'Tom Brown',
      status: 'in_progress',
      sections: {
        trainingRegister: false,
        contractorOrientation: true,
        hazardMap: false,
        emergencyProcedures: false,
        competencyAssessment: false
      }
    }
  ]);

  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([
    {
      id: '1',
      personId: '1',
      skill: 'ATV Operation',
      equipment: 'Honda FourTrax ATV',
      trainingDate: '2024-11-15',
      trainingProvider: 'Tom Brown',
      competencyLevel: 'competent',
      assessmentMethod: 'observation',
      nextAssessmentDate: '2025-05-15',
      notes: 'Demonstrated active riding techniques, proper helmet use'
    },
    {
      id: '2',
      personId: '1',
      skill: 'Animal Handling',
      equipment: 'Cattle Yard',
      trainingDate: '2024-11-16',
      trainingProvider: 'Tom Brown',
      competencyLevel: 'beginner',
      assessmentMethod: 'practical_test',
      nextAssessmentDate: '2024-12-16',
      notes: 'Needs more practice with difficult cattle'
    }
  ]);

  const competencyChecklists: CompetencyChecklist[] = [
    {
      id: 'atv_safety',
      category: 'ATV/Quad Bike Safety',
      items: [
        { id: 'atv1', task: 'Pre-ride safety check', required: true, observed: false, notes: '', evidence: 'Checklist completed' },
        { id: 'atv2', task: 'Active riding technique', required: true, observed: false, notes: '', evidence: 'Practical demonstration' },
        { id: 'atv3', task: 'Helmet usage', required: true, observed: false, notes: '', evidence: 'Observed wearing helmet' },
        { id: 'atv4', task: 'Load capacity awareness', required: true, observed: false, notes: '', evidence: 'Verbal confirmation' },
        { id: 'atv5', task: 'Hill riding techniques', required: true, observed: false, notes: '', evidence: 'Practical assessment' }
      ]
    },
    {
      id: 'animal_handling',
      category: 'Animal Handling',
      items: [
        { id: 'animal1', task: 'Cattle yard safety', required: true, observed: false, notes: '', evidence: 'Observed in yards' },
        { id: 'animal2', task: 'Animal behavior reading', required: true, observed: false, notes: '', evidence: 'Practical assessment' },
        { id: 'animal3', task: 'Safe livestock movement', required: true, observed: false, notes: '', evidence: 'Demonstration' },
        { id: 'animal4', task: 'Dog handling (if applicable)', required: false, observed: false, notes: '', evidence: 'Observation' }
      ]
    },
    {
      id: 'machinery_safety',
      category: 'Machinery Operation',
      items: [
        { id: 'mach1', task: 'PTO guard usage', required: true, observed: false, notes: '', evidence: 'Visual check' },
        { id: 'mach2', task: 'Tractor operation', required: true, observed: false, notes: '', evidence: 'Practical test' },
        { id: 'mach3', task: 'Safety stop procedures', required: true, observed: false, notes: '', evidence: 'Demonstration' },
        { id: 'mach4', task: 'Daily machinery checks', required: true, observed: false, notes: '', evidence: 'Checklist review' }
      ]
    },
    {
      id: 'chemical_safety',
      category: 'Chemical Safety',
      items: [
        { id: 'chem1', task: 'PPE usage', required: true, observed: false, notes: '', evidence: 'Visual check' },
        { id: 'chem2', task: 'Chemical mixing procedures', required: true, observed: false, notes: '', evidence: 'Observation' },
        { id: 'chem3', task: 'Spill response knowledge', required: true, observed: false, notes: '', evidence: 'Verbal test' },
        { id: 'chem4', task: 'Withholding period understanding', required: true, observed: false, notes: '', evidence: 'Questionnaire' }
      ]
    },
    {
      id: 'dairy_safety',
      category: 'Dairy Shed Safety',
      items: [
        { id: 'dairy1', task: 'Slip hazard awareness', required: true, observed: false, notes: '', evidence: 'Observation' },
        { id: 'dairy2', task: 'Animal entry/exit procedures', required: true, observed: false, notes: '', evidence: 'Demonstration' },
        { id: 'dairy3', task: 'Chemical handling in shed', required: true, observed: false, notes: '', evidence: 'Observation' },
        { id: 'dairy4', task: 'Emergency stop usage', required: true, observed: false, notes: '', evidence: 'Practical test' }
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'expired': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStepIcon = (step: number) => {
    switch (step) {
      case 1: return <Users className="h-4 w-4" />;
      case 2: return <ClipboardCheck className="h-4 w-4" />;
      case 3: return <Map className="h-4 w-4" />;
      case 4: return <AlertTriangle className="h-4 w-4" />;
      case 5: return <Award className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1: return 'Person Details';
      case 2: return 'Training Register';
      case 3: return 'Hazard Map Review';
      case 4: return 'Emergency Procedures';
      case 5: return 'Competency Assessment';
      case 6: return 'Digital Signatures';
      case 7: return 'Complete';
      default: return 'Complete';
    }
  };

  const completedCount = inductionRecords.filter(r => r.status === 'completed').length;
  const inProgressCount = inductionRecords.filter(r => r.status === 'in_progress').length;
  const pendingCount = inductionRecords.filter(r => r.status === 'pending').length;

  const NewWorkerInduction = () => (
    <div className="space-y-6">
      {/* Progress Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            New Worker Induction Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  step <= currentStep 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}>
                  {step < 7 ? getStepIcon(step) : <CheckCircle className="h-4 w-4" />}
                </div>
                {step < 7 && (
                  <div className={`w-full h-1 mx-2 ${
                    step < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 text-xs text-center">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <div key={step} className={step <= currentStep ? 'text-blue-600 font-semibold' : 'text-gray-500'}>
                {getStepTitle(step)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Person Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="workerName">Worker Name *</Label>
                <Input id="workerName" placeholder="Enter full name" />
              </div>
              <div>
                <Label htmlFor="workerRole">Role *</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="farm_worker">Farm Worker</SelectItem>
                    <SelectItem value="farm_manager">Farm Manager</SelectItem>
                    <SelectItem value="milker">Milker</SelectItem>
                    <SelectItem value="shepherd">Shepherd</SelectItem>
                    <SelectItem value="general_hand">General Hand</SelectItem>
                    <SelectItem value="mechanic">Mechanic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" type="date" />
              </div>
              <div>
                <Label htmlFor="inductorName">Inductor Name *</Label>
                <Input id="inductorName" placeholder="Name of person conducting induction" />
              </div>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setCurrentStep(2)} className="bg-blue-600 text-white">
                Next Step
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Training Register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Skills & Equipment Training</h3>
              {competencyChecklists.map((checklist) => (
                <Card key={checklist.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-3">{checklist.category}</h4>
                    <div className="space-y-2">
                      {checklist.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-3">
                            <Checkbox id={item.id} />
                            <Label htmlFor={item.id} className="text-sm">
                              {item.task}
                              {item.required && <span className="text-red-500 ml-1">*</span>}
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {item.evidence}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Previous
              </Button>
              <Button onClick={() => setCurrentStep(3)} className="bg-blue-600 text-white">
                Next Step
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Farm Hazard Map Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <Map className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">Interactive Farm Hazard Map</p>
              <p className="text-sm text-gray-500 mb-4">Upload or create a visual map of farm hazards</p>
              <Button variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                View Hazard Map
              </Button>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Key Hazards to Review:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Badge variant="outline">Cattle Yards</Badge>
                <Badge variant="outline">Chemical Storage</Badge>
                <Badge variant="outline">Effluent Pond</Badge>
                <Badge variant="outline">Waterways</Badge>
                <Badge variant="outline">Steep Terrain</Badge>
                <Badge variant="outline">Machinery Shed</Badge>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Previous
              </Button>
              <Button onClick={() => setCurrentStep(4)} className="bg-blue-600 text-white">
                Next Step
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Emergency Procedures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Emergency Response Training</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-l-4 border-l-red-500">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      Emergency Contacts
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p>• Emergency Services: 111</p>
                      <p>• Farm Manager: [Number]</p>
                      <p>• Nearest Neighbor: [Number]</p>
                      <p>• Vet: [Number]</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-orange-600" />
                      Assembly Points
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p>• Primary: Near Farm House</p>
                      <p>• Secondary: Top Paddock</p>
                      <p>• Emergency: Road Entrance</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Emergency Procedures Covered:</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-red-100 text-red-800">Fire Evacuation</Badge>
                  <Badge className="bg-orange-100 text-orange-800">Medical Emergency</Badge>
                  <Badge className="bg-yellow-100 text-yellow-800">Chemical Spill</Badge>
                  <Badge className="bg-blue-100 text-blue-800">Animal Injury</Badge>
                  <Badge className="bg-purple-100 text-purple-800">Severe Weather</Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                Previous
              </Button>
              <Button onClick={() => setCurrentStep(5)} className="bg-blue-600 text-white">
                Next Step
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 5: Competency Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Practical Assessment</h3>
              <p className="text-gray-600">Observe and assess the worker's ability to perform tasks safely</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <h4 className="font-semibold">ATV Operation</h4>
                    <p className="text-sm text-gray-600">Active riding, helmet use, hill techniques</p>
                  </div>
                  <Select defaultValue="pending">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="competent">Competent</SelectItem>
                      <SelectItem value="needs_training">Needs Training</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <h4 className="font-semibold">Animal Handling</h4>
                    <p className="text-sm text-gray-600">Cattle yard safety, livestock movement</p>
                  </div>
                  <Select defaultValue="pending">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="competent">Competent</SelectItem>
                      <SelectItem value="needs_training">Needs Training</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <h4 className="font-semibold">Chemical Safety</h4>
                    <p className="text-sm text-gray-600">PPE usage, mixing procedures, spill response</p>
                  </div>
                  <Select defaultValue="pending">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="competent">Competent</SelectItem>
                      <SelectItem value="needs_training">Needs Training</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assessmentNotes">Assessment Notes</Label>
                <Textarea 
                  id="assessmentNotes" 
                  placeholder="Record observations, strengths, areas for improvement..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep(4)}>
                Previous
              </Button>
              <Button onClick={() => setCurrentStep(6)} className="bg-blue-600 text-white">
                Complete Induction
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pen className="h-5 w-5 text-purple-600" />
              Step 6: Digital Signatures
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Legal Signatures Required</h3>
              <p className="text-gray-600">
                Both the inductee and inductor must sign to complete the induction process.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DigitalSignaturePad
                  title="Inductee Signature"
                  signerName="New Worker Name"
                  onSignatureComplete={(signature) => setInducteeSignature(signature)}
                  required={true}
                />
                
                <DigitalSignaturePad
                  title="Inductor Signature"
                  signerName="Tom Brown"
                  onSignatureComplete={(signature) => setInductorSignature(signature)}
                  required={true}
                />
              </div>
            </div>
            
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep(5)}>
                Previous
              </Button>
              <Button 
                onClick={() => {
                  // Generate certificate data
                  const certificateData = {
                    id: Date.now().toString(),
                    certificateNumber: `IND-${Date.now()}`,
                    personName: "New Worker Name",
                    role: "Farm Worker",
                    inductionType: "new_worker",
                    completionDate: new Date().toISOString().split('T')[0],
                    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    inductorName: "Tom Brown",
                    farmName: "Your Farm Name",
                    sectionsCompleted: [
                      "Person Details",
                      "Training Register", 
                      "Hazard Map Review",
                      "Emergency Procedures",
                      "Competency Assessment"
                    ],
                    signatureData: {
                      inductee: inducteeSignature?.signature || '',
                      inductor: inductorSignature?.signature || '',
                      timestamp: new Date().toISOString()
                    }
                  };
                  setCurrentInductionData(certificateData);
                  setCurrentStep(7);
                }} 
                className="bg-blue-600 text-white"
                disabled={!inducteeSignature || !inductorSignature}
              >
                Generate Certificate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 7 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Induction Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentInductionData ? (
              <InductionCertificate
                certificateData={currentInductionData}
                onDownload={() => alert('Certificate downloaded!')}
                onEmail={() => alert('Certificate emailed!')}
                showActions={true}
              />
            ) : (
              <div className="text-center py-6">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600" />
                <h3 className="text-xl font-semibold mb-2">Induction Successfully Completed</h3>
                <p className="text-gray-600 mb-4">All required sections have been completed and signed off</p>
              </div>
            )}
            
            <div className="flex gap-4 mt-6">
              <Button variant="outline" onClick={() => {
                setCurrentStep(1);
                setInducteeSignature(null);
                setInductorSignature(null);
                setShowCertificate(false);
                setCurrentInductionData(null);
              }}>
                Start New Induction
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const ContractorOrientation = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-orange-600" />
            Contractor Orientation Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contractorName">Contractor Name *</Label>
              <Input id="contractorName" placeholder="Enter contractor name" />
            </div>
            <div>
              <Label htmlFor="companyName">Company Name *</Label>
              <Input id="companyName" placeholder="Enter company name" />
            </div>
            <div>
              <Label htmlFor="workType">Type of Work *</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select work type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="mechanical">Mechanical</SelectItem>
                  <SelectItem value="building">Building/Construction</SelectItem>
                  <SelectItem value="fencing">Fencing</SelectItem>
                  <SelectItem value="grazing">Grazing Management</SelectItem>
                  <SelectItem value="veterinary">Veterinary Services</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="orientationDate">Orientation Date *</Label>
              <Input id="orientationDate" type="date" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Orientation Checklist</h3>
            <div className="space-y-3">
              {[
                'Farm rules and policies explained',
                'Emergency procedures reviewed',
                'Hazard map provided and explained',
                'Specific work area hazards identified',
                'PPE requirements discussed',
                'Communication procedures established',
                'Chemical storage locations identified (if applicable)',
                'Animal handling procedures reviewed (if applicable)',
                'Machinery access rules explained (if applicable)',
                'Waste disposal procedures discussed'
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded">
                  <Checkbox id={`contractor-${index}`} />
                  <Label htmlFor={`contractor-${index}`} className="flex-1">
                    {item}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="orientationNotes">Additional Notes</Label>
            <Textarea 
              id="orientationNotes" 
              placeholder="Record any specific discussions, concerns, or additional information..."
              rows={3}
            />
          </div>

          <div className="flex gap-4">
            <Button variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save as Draft
            </Button>
            <Button className="bg-orange-600 text-white">
              <Send className="h-4 w-4 mr-2" />
              Complete Orientation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const TrainingRegister = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-green-600" />
            Training Register
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Staff Training Records</h3>
              <Button>
                <Users className="h-4 w-4 mr-2" />
                Add Training Record
              </Button>
            </div>
            
            {trainingRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No training records yet</p>
                <p className="text-sm mt-2">Add your first training record to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {trainingRecords.map((record) => (
                  <Card key={record.id} className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{record.skill}</h4>
                            <Badge className={
                              record.competencyLevel === 'expert' ? 'bg-green-100 text-green-800' :
                              record.competencyLevel === 'competent' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {record.competencyLevel}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Equipment: {record.equipment} • Provider: {record.trainingProvider}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            Date: {record.trainingDate} • Assessment: {record.assessmentMethod}
                          </p>
                          {record.notes && (
                            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                              Notes: {record.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Farm Induction Management</h1>
        <p className="text-muted-foreground mt-2">
          WorkSafe NZ compliant induction system for new workers and contractors
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{trainingRecords.length}</div>
            <div className="text-sm text-gray-600">Training Records</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">
            <FileText className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="new_worker">
            <UserCheck className="h-4 w-4 mr-2" />
            New Worker
          </TabsTrigger>
          <TabsTrigger value="contractor">
            <Truck className="h-4 w-4 mr-2" />
            Contractor
          </TabsTrigger>
          <TabsTrigger value="training">
            <BookOpen className="h-4 w-4 mr-2" />
            Training
          </TabsTrigger>
          <TabsTrigger value="skills_matrix">
            <Target className="h-4 w-4 mr-2" />
            Skills Matrix
          </TabsTrigger>
          <TabsTrigger value="hazard_map">
            <Map className="h-4 w-4 mr-2" />
            Hazard Map
          </TabsTrigger>
          <TabsTrigger value="emergency">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Emergency
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Induction Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inductionRecords.map(record => (
                  <Card key={record.id} className="border-l-4 border-l-gray-300">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{record.personName}</h3>
                            <Badge className={getStatusColor(record.status)}>
                              {record.status}
                            </Badge>
                            <Badge variant="outline">
                              {record.type === 'new_worker' ? 'New Worker' : 'Contractor'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {record.role} {record.company && `• ${record.company}`}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            Induction Date: {record.inductionDate} • Inductor: {record.inductorName}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(record.sections).map(([key, completed]) => (
                              <Badge key={key} variant={completed ? "default" : "outline"} className="text-xs">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Worker Tab */}
        <TabsContent value="new_worker" className="mt-6">
          <NewWorkerInduction />
        </TabsContent>

        {/* Contractor Tab */}
        <TabsContent value="contractor" className="mt-6">
          <ContractorOrientation />
        </TabsContent>

        {/* Training Tab */}
        <TabsContent value="training" className="mt-6">
          <TrainingRegister />
        </TabsContent>

        {/* Skills Matrix Tab */}
        <TabsContent value="skills_matrix" className="mt-6">
          <SkillsMatrix />
        </TabsContent>

        {/* Hazard Map Tab */}
        <TabsContent value="hazard_map" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5 text-purple-600" />
                Farm Hazard Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <Map className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">Interactive Farm Hazard Map</h3>
                <p className="text-gray-600 mb-4">Upload or create a visual map of farm hazards</p>
                <div className="flex gap-4 justify-center">
                  <Button>
                    <Target className="h-4 w-4 mr-2" />
                    Create Map
                  </Button>
                  <Button variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    View Existing
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emergency Tab */}
        <TabsContent value="emergency" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Emergency Procedures
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-l-4 border-l-red-500">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-3">Emergency Contacts</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Emergency Services:</span>
                        <span className="font-mono font-bold">111</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Farm Manager:</span>
                        <span className="font-mono">[Number]</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Nearest Neighbor:</span>
                        <span className="font-mono">[Number]</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Veterinarian:</span>
                        <span className="font-mono">[Number]</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-orange-500">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-3">Assembly Points</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Primary:</span>
                        <p className="text-sm text-gray-600">Near Farm House</p>
                      </div>
                      <div>
                        <span className="font-medium">Secondary:</span>
                        <p className="text-sm text-gray-600">Top Paddock</p>
                      </div>
                      <div>
                        <span className="font-medium">Emergency:</span>
                        <p className="text-sm text-gray-600">Road Entrance</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
