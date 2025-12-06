import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Building, 
  Phone, 
  Shield, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  MapPin,
  FileText,
  Camera,
  Upload
} from 'lucide-react';
import { format } from 'date-fns';

interface VisitorData {
  name: string;
  company: string;
  email: string;
  phone: string;
  purpose: string;
  emergencyContact: string;
  emergencyPhone: string;
  safetyAcknowledged: boolean;
  hostPerson: string;
  vehicleRegistration: string;
  biosecurityAcknowledged: boolean;
  photoConsent: boolean;
  signatureData: string;
}

interface SafetyRequirement {
  id: string;
  title: string;
  description: string;
  required: boolean;
  category: 'safety' | 'biosecurity' | 'emergency';
}

export default function VisitorPortal({ farmName, locationCode, onComplete }: { 
  farmName: string;
  locationCode: string;
  onComplete: (visitorData: VisitorData) => void;
}) {
  const [step, setStep] = useState<'welcome' | 'details' | 'safety' | 'biosecurity' | 'emergency' | 'confirmation' | 'signature'>('welcome');
  const [visitorData, setVisitorData] = useState<VisitorData>({
    name: '',
    company: '',
    email: '',
    phone: '',
    purpose: '',
    emergencyContact: '',
    emergencyPhone: '',
    safetyAcknowledged: false,
    hostPerson: '',
    vehicleRegistration: '',
    biosecurityAcknowledged: false,
    photoConsent: false,
    signatureData: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signaturePad, setSignaturePad] = useState<any>(null);

  const safetyRequirements: SafetyRequirement[] = [
    // Safety Requirements
    {
      id: '1',
      title: 'Personal Protective Equipment (PPE)',
      description: 'Wear appropriate footwear and any provided safety equipment at all times',
      required: true,
      category: 'safety'
    },
    {
      id: '2',
      title: 'Vehicle Safety',
      description: 'Drive at walking speed (10km/h max), follow designated routes, park in designated areas only',
      required: true,
      category: 'safety'
    },
    {
      id: '3',
      title: 'Animal Safety',
      description: 'Do not approach animals without staff supervision. Maintain safe distance at all times',
      required: true,
      category: 'safety'
    },
    {
      id: '4',
      title: 'Hazard Awareness',
      description: 'Be aware of moving machinery, wet surfaces, uneven ground, and other farm hazards',
      required: true,
      category: 'safety'
    },
    // Biosecurity Requirements
    {
      id: '5',
      title: 'Footwear Cleaning',
      description: 'Clean footwear before entering and leaving farm areas. Use provided cleaning stations',
      required: true,
      category: 'biosecurity'
    },
    {
      id: '6',
      title: 'No External Food',
      description: 'Do not bring external food or animal products onto the farm without prior approval',
      required: true,
      category: 'biosecurity'
    },
    {
      id: '7',
      title: 'Disease Declaration',
      description: 'Declare if you have been on another farm or had contact with livestock in the last 48 hours',
      required: true,
      category: 'biosecurity'
    },
    // Emergency Requirements
    {
      id: '8',
      title: 'Emergency Procedures',
      description: 'Know evacuation routes and emergency assembly points. Follow staff instructions during emergencies',
      required: true,
      category: 'emergency'
    },
    {
      id: '9',
      title: 'First Aid Location',
      description: 'First aid kits are located at the main shed. Know the location and how to call for help',
      required: true,
      category: 'emergency'
    },
    {
      id: '10',
      title: 'Emergency Contacts',
      description: 'Emergency services: 111. Farm emergency: [Farm Phone Number]. Know who to contact',
      required: true,
      category: 'emergency'
    }
  ];

  const visitPurposes = [
    'Delivery',
    'Maintenance/Repair',
    'Contractor Work',
    'Audit/Inspection',
    'Meeting',
    'Training',
    'Veterinary Services',
    'Consulting',
    'Other'
  ];

  const validateStep = (currentStep: string) => {
    const newErrors: Record<string, string> = {};
    
    switch (currentStep) {
      case 'details':
        if (!visitorData.name.trim()) newErrors.name = 'Full name is required';
        if (!visitorData.company.trim()) newErrors.company = 'Company is required';
        if (!visitorData.phone.trim()) newErrors.phone = 'Phone number is required';
        if (!visitorData.hostPerson.trim()) newErrors.hostPerson = 'Host person is required';
        if (!visitorData.purpose) newErrors.purpose = 'Purpose of visit is required';
        break;
      case 'emergency':
        if (!visitorData.emergencyContact.trim()) newErrors.emergencyContact = 'Emergency contact is required';
        if (!visitorData.emergencyPhone.trim()) newErrors.emergencyPhone = 'Emergency phone is required';
        break;
      case 'signature':
        if (!visitorData.signatureData) newErrors.signature = 'Digital signature is required';
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      switch (step) {
        case 'welcome':
          setStep('details');
          break;
        case 'details':
          setStep('safety');
          break;
        case 'safety':
          setStep('biosecurity');
          break;
        case 'biosecurity':
          setStep('emergency');
          break;
        case 'emergency':
          setStep('confirmation');
          break;
        case 'confirmation':
          setStep('signature');
          break;
      }
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'details':
        setStep('welcome');
        break;
      case 'safety':
        setStep('details');
        break;
      case 'biosecurity':
        setStep('safety');
        break;
      case 'emergency':
        setStep('biosecurity');
        break;
      case 'confirmation':
        setStep('emergency');
        break;
      case 'signature':
        setStep('confirmation');
        break;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep('signature')) return;
    
    setIsSubmitting(true);
    try {
      const completeVisitorData = {
        ...visitorData,
        signInTime: new Date().toISOString(),
        farmLocation: farmName,
        locationCode: locationCode,
        complianceVersion: '1.0'
      };
      
      await onComplete(completeVisitorData);
    } catch (error) {
      console.error('Error submitting visitor data:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignatureComplete = (signatureData: string) => {
    setVisitorData(prev => ({ ...prev, signatureData }));
    setErrors(prev => ({ ...prev, signature: '' }));
  };

  const renderWelcomeStep = () => (
    <div className="text-center space-y-6">
      <div className="space-y-2">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <MapPin className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome to {farmName}</h1>
        <p className="text-gray-600 text-lg">Digital Visitor Sign-In System</p>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-4">
          <AlertTriangle className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-left">
            <h3 className="font-semibold text-blue-900 text-lg">Health & Safety Compliance</h3>
            <p className="text-blue-800 mt-2">
              This is a working farm with potential hazards. For your safety and regulatory compliance, 
              you must complete this digital induction before entering farm areas.
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Clock className="h-5 w-5 text-gray-600" />
            <span className="font-medium">Time Required</span>
          </div>
          <span className="text-gray-600 font-semibold">~5 minutes</span>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <FileText className="h-5 w-5 text-gray-600" />
            <span className="font-medium">Information Needed</span>
          </div>
          <span className="text-gray-600">Contact details</span>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-gray-600" />
            <span className="font-medium">Compliance Coverage</span>
          </div>
          <span className="text-gray-600">WorkSafe NZ</span>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
          <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">
            WorkSafe NZ Compliant
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
            Biosecurity Protocol
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
            Emergency Procedures
          </Badge>
        </div>
      </div>
      
      <Button 
        onClick={handleNext}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold"
        size="lg"
      >
        Begin Digital Sign In
      </Button>
      
      <p className="text-xs text-gray-500 mt-4">
        Location Code: {locationCode} | {format(new Date(), 'PPP')}
      </p>
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Visitor Details</h2>
        <p className="text-gray-600">Please provide your contact information</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-base font-semibold">Full Name *</Label>
          <Input
            id="name"
            type="text"
            value={visitorData.name}
            onChange={(e) => setVisitorData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter your full name"
            className={`mt-2 h-12 text-lg ${errors.name ? 'border-red-500' : ''}`}
          />
          {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
        </div>
        
        <div>
          <Label htmlFor="company" className="text-base font-semibold">Company/Organization *</Label>
          <Input
            id="company"
            type="text"
            value={visitorData.company}
            onChange={(e) => setVisitorData(prev => ({ ...prev, company: e.target.value }))}
            placeholder="Enter your company name"
            className={`mt-2 h-12 text-lg ${errors.company ? 'border-red-500' : ''}`}
          />
          {errors.company && <p className="text-sm text-red-500 mt-1">{errors.company}</p>}
        </div>
        
        <div>
          <Label htmlFor="email" className="text-base font-semibold">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={visitorData.email}
            onChange={(e) => setVisitorData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="your.email@company.com"
            className="mt-2 h-12 text-lg"
          />
        </div>
        
        <div>
          <Label htmlFor="phone" className="text-base font-semibold">Phone Number *</Label>
          <Input
            id="phone"
            type="tel"
            value={visitorData.phone}
            onChange={(e) => setVisitorData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+64 21 123 4567"
            className={`mt-2 h-12 text-lg ${errors.phone ? 'border-red-500' : ''}`}
          />
          {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
        </div>
        
        <div>
          <Label htmlFor="purpose" className="text-base font-semibold">Purpose of Visit *</Label>
          <Select value={visitorData.purpose} onValueChange={(value) => setVisitorData(prev => ({ ...prev, purpose: value }))}>
            <SelectTrigger className={`mt-2 h-12 text-lg ${errors.purpose ? 'border-red-500' : ''}`}>
              <SelectValue placeholder="Select purpose of visit" />
            </SelectTrigger>
            <SelectContent>
              {visitPurposes.map(purpose => (
                <SelectItem key={purpose} value={purpose}>{purpose}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.purpose && <p className="text-sm text-red-500 mt-1">{errors.purpose}</p>}
        </div>
        
        <div>
          <Label htmlFor="hostPerson" className="text-base font-semibold">Host Person *</Label>
          <Input
            id="hostPerson"
            type="text"
            value={visitorData.hostPerson}
            onChange={(e) => setVisitorData(prev => ({ ...prev, hostPerson: e.target.value }))}
            placeholder="Name of person you're visiting"
            className={`mt-2 h-12 text-lg ${errors.hostPerson ? 'border-red-500' : ''}`}
          />
          {errors.hostPerson && <p className="text-sm text-red-500 mt-1">{errors.hostPerson}</p>}
        </div>
        
        <div>
          <Label htmlFor="vehicleRegistration" className="text-base font-semibold">Vehicle Registration</Label>
          <Input
            id="vehicleRegistration"
            type="text"
            value={visitorData.vehicleRegistration}
            onChange={(e) => setVisitorData(prev => ({ ...prev, vehicleRegistration: e.target.value }))}
            placeholder="ABC123"
            className="mt-2 h-12 text-lg"
          />
        </div>
      </div>
      
      <div className="flex space-x-3">
        <Button 
          variant="outline" 
          onClick={handleBack}
          className="flex-1 h-12 text-lg"
        >
          Back
        </Button>
        <Button 
          onClick={handleNext}
          className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-lg"
        >
          Next
        </Button>
      </div>
    </div>
  );

  const renderSafetyStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
          <Shield className="h-8 w-8 text-orange-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Safety Requirements</h2>
        <p className="text-gray-600">Please acknowledge these important safety requirements</p>
      </div>
      
      <div className="space-y-3">
        {safetyRequirements.filter(req => req.category === 'safety').map((requirement) => (
          <Card key={requirement.id} className="border-l-4 border-l-orange-400">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="pt-1">
                  <div className="w-5 h-5 rounded-full border-2 border-orange-400 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{requirement.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{requirement.description}</p>
                  {requirement.required && (
                    <Badge variant="secondary" className="mt-2 text-xs bg-orange-50 text-orange-800">Required</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          By proceeding, you confirm that you have read and understood all safety requirements 
          and will comply with them during your visit to {farmName}.
        </AlertDescription>
      </Alert>
      
      <div className="flex space-x-3">
        <Button 
          variant="outline" 
          onClick={handleBack}
          className="flex-1 h-12 text-lg"
        >
          Back
        </Button>
        <Button 
          onClick={handleNext}
          className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-lg"
        >
          I Understand
        </Button>
      </div>
    </div>
  );

  const renderBiosecurityStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Shield className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Biosecurity Protocols</h2>
        <p className="text-gray-600">Protect our farm - please follow biosecurity requirements</p>
      </div>
      
      <div className="space-y-3">
        {safetyRequirements.filter(req => req.category === 'biosecurity').map((requirement) => (
          <Card key={requirement.id} className="border-l-4 border-l-green-400">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="pt-1">
                  <div className="w-5 h-5 rounded-full border-2 border-green-400 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{requirement.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{requirement.description}</p>
                  {requirement.required && (
                    <Badge variant="secondary" className="mt-2 text-xs bg-green-50 text-green-800">Required</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900">Biosecurity Declaration</h3>
            <p className="text-sm text-green-800 mt-1">
              I declare that I have not been on another farm or had contact with livestock 
              in the last 48 hours, and I will follow all biosecurity protocols.
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex space-x-3">
        <Button 
          variant="outline" 
          onClick={handleBack}
          className="flex-1 h-12 text-lg"
        >
          Back
        </Button>
        <Button 
          onClick={() => {
            setVisitorData(prev => ({ ...prev, biosecurityAcknowledged: true }));
            handleNext();
          }}
          className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-lg"
        >
          I Agree
        </Button>
      </div>
    </div>
  );

  const renderEmergencyStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <Phone className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Emergency Information</h2>
        <p className="text-gray-600">Provide emergency contact and acknowledge emergency procedures</p>
      </div>
      
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Emergency Contacts</h3>
              <p className="text-sm text-red-800 mt-2">
                <strong>Emergency Services:</strong> 111<br/>
                <strong>Farm Emergency:</strong> [Farm Phone Number]<br/>
                <strong>Location:</strong> {farmName}
              </p>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          {safetyRequirements.filter(req => req.category === 'emergency').map((requirement) => (
            <Card key={requirement.id} className="border-l-4 border-l-red-400">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="pt-1">
                    <div className="w-5 h-5 rounded-full border-2 border-red-400 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{requirement.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{requirement.description}</p>
                    {requirement.required && (
                      <Badge variant="secondary" className="mt-2 text-xs bg-red-50 text-red-800">Required</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="space-y-4 border-t pt-4">
          <div>
            <Label htmlFor="emergencyContact" className="text-base font-semibold">Emergency Contact Name *</Label>
            <Input
              id="emergencyContact"
              type="text"
              value={visitorData.emergencyContact}
              onChange={(e) => setVisitorData(prev => ({ ...prev, emergencyContact: e.target.value }))}
              placeholder="Full name of emergency contact"
              className={`mt-2 h-12 text-lg ${errors.emergencyContact ? 'border-red-500' : ''}`}
            />
            {errors.emergencyContact && <p className="text-sm text-red-500 mt-1">{errors.emergencyContact}</p>}
          </div>
          
          <div>
            <Label htmlFor="emergencyPhone" className="text-base font-semibold">Emergency Contact Phone *</Label>
            <Input
              id="emergencyPhone"
              type="tel"
              value={visitorData.emergencyPhone}
              onChange={(e) => setVisitorData(prev => ({ ...prev, emergencyPhone: e.target.value }))}
              placeholder="+64 21 123 4567"
              className={`mt-2 h-12 text-lg ${errors.emergencyPhone ? 'border-red-500' : ''}`}
            />
            {errors.emergencyPhone && <p className="text-sm text-red-500 mt-1">{errors.emergencyPhone}</p>}
          </div>
        </div>
      </div>
      
      <div className="flex space-x-3">
        <Button 
          variant="outline" 
          onClick={handleBack}
          className="flex-1 h-12 text-lg"
        >
          Back
        </Button>
        <Button 
          onClick={() => {
            setVisitorData(prev => ({ ...prev, safetyAcknowledged: true }));
            handleNext();
          }}
          className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-lg"
        >
          Next
        </Button>
      </div>
    </div>
  );

  const renderConfirmationStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Confirm Your Details</h2>
        <p className="text-gray-600">Please review your information before signing in</p>
      </div>
      
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start space-x-3">
            <User className="h-4 w-4 text-gray-600 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">{visitorData.name}</p>
              <p className="text-sm text-gray-600">{visitorData.company}</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <Building className="h-4 w-4 text-gray-600 mt-0.5" />
            <div>
              <p className="text-sm text-gray-900">Purpose: {visitorData.purpose}</p>
              <p className="text-sm text-gray-600">Host: {visitorData.hostPerson}</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <Phone className="h-4 w-4 text-gray-600 mt-0.5" />
            <div>
              <p className="text-sm text-gray-900">Phone: {visitorData.phone}</p>
              <p className="text-sm text-gray-600">Emergency: {visitorData.emergencyContact} ({visitorData.emergencyPhone})</p>
            </div>
          </div>
          
          {visitorData.vehicleRegistration && (
            <div className="text-sm text-gray-600">
              Vehicle: {visitorData.vehicleRegistration}
            </div>
          )}
          
          <div className="pt-3 border-t">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-green-50 text-green-800 border-green-200">
                ✓ Safety Acknowledged
              </Badge>
              <Badge className="bg-blue-50 text-blue-800 border-blue-200">
                ✓ Biosecurity Protocol
              </Badge>
              <Badge className="bg-orange-50 text-orange-800 border-orange-200">
                ✓ Emergency Procedures
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900">Compliance Confirmation</h3>
            <p className="text-sm text-green-800 mt-1">
              You have acknowledged all farm safety requirements, biosecurity protocols, 
              and emergency procedures as required by WorkSafe NZ regulations.
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex space-x-3">
        <Button 
          variant="outline" 
          onClick={handleBack}
          className="flex-1 h-12 text-lg"
        >
          Back
        </Button>
        <Button 
          onClick={handleNext}
          className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-lg"
        >
          Confirm & Sign
        </Button>
      </div>
    </div>
  );

  const renderSignatureStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
          <FileText className="h-8 w-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Digital Signature</h2>
        <p className="text-gray-600">Please sign to confirm your compliance agreement</p>
      </div>
      
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="text-center">
          <p className="text-sm text-purple-800 font-medium">
            By signing, I confirm that I have read and understood all safety requirements, 
            biosecurity protocols, and emergency procedures for {farmName}.
          </p>
          <p className="text-xs text-purple-600 mt-2">
            This digital signature serves as legal acknowledgment of compliance.
          </p>
        </div>
      </div>
      
      <Card>
        <CardContent className="p-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
            <div className="text-center text-gray-500 py-8">
              <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Digital signature pad will appear here</p>
              <p className="text-sm">Sign with your finger or mouse</p>
            </div>
          </div>
          {errors.signature && <p className="text-sm text-red-500 mt-2">{errors.signature}</p>}
        </CardContent>
      </Card>
      
      <div className="flex items-center space-x-3">
        <Checkbox
          id="photoConsent"
          checked={visitorData.photoConsent}
          onCheckedChange={(checked) => setVisitorData(prev => ({ ...prev, photoConsent: checked as boolean }))}
        />
        <Label htmlFor="photoConsent" className="text-sm">
          I consent to having my photo taken for identification purposes during my visit.
        </Label>
      </div>
      
      <div className="flex space-x-3">
        <Button 
          variant="outline" 
          onClick={handleBack}
          className="flex-1 h-12 text-lg"
        >
          Back
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 text-lg"
        >
          {isSubmitting ? 'Signing In...' : 'Complete Sign In'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-4 px-4">
      <div className="max-w-md mx-auto">
        <Card className="shadow-xl border-0">
          <CardContent className="p-6">
            {step === 'welcome' && renderWelcomeStep()}
            {step === 'details' && renderDetailsStep()}
            {step === 'safety' && renderSafetyStep()}
            {step === 'biosecurity' && renderBiosecurityStep()}
            {step === 'emergency' && renderEmergencyStep()}
            {step === 'confirmation' && renderConfirmationStep()}
            {step === 'signature' && renderSignatureStep()}
          </CardContent>
        </Card>
        
        <div className="text-center mt-4 text-xs text-gray-500 space-y-1">
          <p>WorkSafe NZ Compliant Visitor Management System</p>
          <p>Location: {farmName} | Code: {locationCode}</p>
          <p>{format(new Date(), 'PPP')}</p>
        </div>
      </div>
    </div>
  );
}
