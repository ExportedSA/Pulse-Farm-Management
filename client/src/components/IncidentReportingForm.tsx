import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, User, MapPin, Phone, Clock, Save, Send, FileText } from 'lucide-react';

interface IncidentFormData {
  // Basic Information
  incidentNumber: string;
  title: string;
  incidentType: string;
  category: string;
  severity: string;
  dateOccurred: string;
  timeOccurred: string;
  dateReported: string;
  location: string;
  department: string;
  
  // People Involved
  injuredPersons: PersonDetails[];
  witnesses: WitnessDetails[];
  reporterDetails: ReporterDetails;
  
  // Incident Details
  description: string;
  sequenceOfEvents: string;
  immediateCause: string;
  underlyingCause: string;
  
  // Injury Details (if applicable)
  injuryType: string[];
  bodyPartsAffected: string[];
  treatmentProvided: string;
  medicalAttention: string;
  hospitalizationRequired: boolean;
  timeOffWork: string;
  
  // Property Damage
  propertyDamage: boolean;
  damageDescription: string;
  estimatedCost: string;
  
  // Environmental Impact
  environmentalImpact: boolean;
  environmentalDescription: string;
  
  // Immediate Actions
  immediateActions: string;
  emergencyServicesCalled: boolean;
  emergencyServicesDetails: string;
  
  // Investigation
  investigationRequired: boolean;
  investigationTeam: string[];
  investigationFindings: string;
  
  // Corrective Actions
  correctiveActions: string[];
  preventionMeasures: string[];
  responsiblePerson: string;
  targetCompletionDate: string;
  
  // WorkSafe NZ Notification
  notifiableIncident: boolean;
  workSafeNotified: boolean;
  workSafeNotificationDate: string;
  referenceNumber: string;
  
  // Documentation
  photos: string[];
  documents: string[];
  witnessStatements: string[];
}

interface PersonDetails {
  name: string;
  role: string;
  contact: string;
  injuryDescription: string;
  treatmentReceived: string;
}

interface WitnessDetails {
  name: string;
  contact: string;
  statement: string;
}

interface ReporterDetails {
  name: string;
  role: string;
  contact: string;
  relationship: string;
}

const incidentTypes = [
  'Personal Injury', 'Near Miss', 'Property Damage', 'Environmental Incident', 
  'Vehicle Incident', 'Fire', 'Chemical Spill', 'Animal Related', 'Equipment Failure', 'Other'
];

const incidentCategories = [
  'Struck By', 'Struck Against', 'Caught In/Between', 'Fall to Lower Level', 'Fall on Same Level',
  'Overexertion', 'Exposure to Harmful Substance', 'Contact with Temperature', 'Contact with Electricity',
  'Contact with Radiation', 'Air Pressure Incident', 'Drowning', 'Vehicle Incident', 'Other'
];

const severityLevels = [
  { value: 'Fatal', label: 'Fatal', description: 'Death resulting from incident' },
  { value: 'Critical', label: 'Critical', description: 'Life-threatening injury, permanent disability' },
  { value: 'Major', label: 'Major', description: 'Serious injury requiring hospitalization' },
  { value: 'Moderate', label: 'Moderate', description: 'Medical treatment required, some time off work' },
  { value: 'Minor', label: 'Minor', description: 'First aid treatment only' },
  { value: 'Near Miss', label: 'Near Miss', description: 'No injury but potential for serious harm' }
];

const injuryTypes = [
  'Fracture', 'Sprain/Strain', 'Cut/Laceration', 'Bruise/Contusion', 'Burn', 
  'Concussion', 'Dislocation', 'Amputation', 'Crush Injury', 'Electrical Shock',
  'Chemical Burn', 'Heat Stress', 'Hearing Loss', 'Eye Injury', 'Multiple Injuries'
];

const bodyParts = [
  'Head', 'Eye(s)', 'Face', 'Neck', 'Shoulder', 'Arm', 'Elbow', 'Wrist', 'Hand', 'Finger(s)',
  'Chest', 'Abdomen', 'Back', 'Hip', 'Leg', 'Knee', 'Ankle', 'Foot', 'Toe(s)', 'Multiple'
];

export default function IncidentReportingForm() {
  const [formData, setFormData] = useState<IncidentFormData>({
    incidentNumber: `INC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    title: '',
    incidentType: '',
    category: '',
    severity: '',
    dateOccurred: new Date().toISOString().split('T')[0],
    timeOccurred: new Date().toTimeString().split(' ')[0].substring(0, 5),
    dateReported: new Date().toISOString().split('T')[0],
    location: '',
    department: '',
    injuredPersons: [],
    witnesses: [],
    reporterDetails: {
      name: '',
      role: '',
      contact: '',
      relationship: ''
    },
    description: '',
    sequenceOfEvents: '',
    immediateCause: '',
    underlyingCause: '',
    injuryType: [],
    bodyPartsAffected: [],
    treatmentProvided: '',
    medicalAttention: '',
    hospitalizationRequired: false,
    timeOffWork: '',
    propertyDamage: false,
    damageDescription: '',
    estimatedCost: '',
    environmentalImpact: false,
    environmentalDescription: '',
    immediateActions: '',
    emergencyServicesCalled: false,
    emergencyServicesDetails: '',
    investigationRequired: false,
    investigationTeam: [],
    investigationFindings: '',
    correctiveActions: [],
    preventionMeasures: [],
    responsiblePerson: '',
    targetCompletionDate: '',
    notifiableIncident: false,
    workSafeNotified: false,
    workSafeNotificationDate: '',
    referenceNumber: '',
    photos: [],
    documents: [],
    witnessStatements: []
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Fatal': return 'bg-black text-white';
      case 'Critical': return 'bg-red-600 text-white';
      case 'Major': return 'bg-red-500 text-white';
      case 'Moderate': return 'bg-orange-500 text-white';
      case 'Minor': return 'bg-yellow-500 text-black';
      case 'Near Miss': return 'bg-blue-500 text-white';
      default: return 'bg-gray-200 text-black';
    }
  };

  const handleInputChange = (field: keyof IncidentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleReporterChange = (field: keyof ReporterDetails, value: string) => {
    setFormData(prev => ({
      ...prev,
      reporterDetails: { ...prev.reporterDetails, [field]: value }
    }));
  };

  const handleInjuryTypeChange = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      injuryType: checked 
        ? [...prev.injuryType, value]
        : prev.injuryType.filter(item => item !== value)
    }));
  };

  const handleBodyPartChange = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      bodyPartsAffected: checked 
        ? [...prev.bodyPartsAffected, value]
        : prev.bodyPartsAffected.filter(item => item !== value)
    }));
  };

  const checkNotifiableIncident = () => {
    const notifiableConditions = [
      formData.severity === 'Fatal',
      formData.severity === 'Critical',
      formData.hospitalizationRequired,
      formData.environmentalImpact
    ];
    
    const isNotifiable = notifiableConditions.some(condition => condition);
    setFormData(prev => ({ ...prev, notifiableIncident: isNotifiable }));
  };

  const handleSubmit = async (action: 'save' | 'submit') => {
    // Validate required fields
    const requiredFields = ['title', 'incidentType', 'severity', 'dateOccurred', 'location', 'description'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof IncidentFormData]);
    
    if (missingFields.length > 0) {
      alert(`Please complete all required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Check if WorkSafe NZ notification is required
    if (formData.notifiableIncident && !formData.workSafeNotified) {
      alert('This is a notifiable incident. WorkSafe NZ must be notified before submitting.');
      return;
    }

    // Here you would typically save to your backend
    console.log('Incident form data:', formData);
    console.log('Action:', action);
    
    if (action === 'submit') {
      alert('Incident report submitted successfully!');
    } else {
      alert('Incident report saved as draft!');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-500" />
            Incident Report Form - WorkSafe NZ Compliant
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Incident Number:</span>
            <Badge variant="outline">{formData.incidentNumber}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Incident Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Brief description of the incident"
                />
              </div>
              <div>
                <Label htmlFor="incidentType">Incident Type *</Label>
                <Select value={formData.incidentType} onValueChange={(value) => handleInputChange('incidentType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select incident type" />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Incident Category</Label>
                <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentCategories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="severity">Severity Level *</Label>
                <Select value={formData.severity} onValueChange={(value) => {
                  handleInputChange('severity', value);
                  checkNotifiableIncident();
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {severityLevels.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label} - {level.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.severity && (
                  <Badge className={`mt-2 ${getSeverityColor(formData.severity)}`}>
                    {formData.severity}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="dateOccurred">Date Occurred *</Label>
                <Input
                  id="dateOccurred"
                  type="date"
                  value={formData.dateOccurred}
                  onChange={(e) => handleInputChange('dateOccurred', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="timeOccurred">Time Occurred</Label>
                <Input
                  id="timeOccurred"
                  type="time"
                  value={formData.timeOccurred}
                  onChange={(e) => handleInputChange('timeOccurred', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dateReported">Date Reported</Label>
                <Input
                  id="dateReported"
                  type="date"
                  value={formData.dateReported}
                  onChange={(e) => handleInputChange('dateReported', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Specific location"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="department">Department/Area</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  placeholder="e.g., Dairy Shed, Workshop"
                />
              </div>
            </div>
          </div>

          {/* Reporter Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Reporter Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reporterName">Reporter Name *</Label>
                <Input
                  id="reporterName"
                  value={formData.reporterDetails.name}
                  onChange={(e) => handleReporterChange('name', e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label htmlFor="reporterRole">Role</Label>
                <Input
                  id="reporterRole"
                  value={formData.reporterDetails.role}
                  onChange={(e) => handleReporterChange('role', e.target.value)}
                  placeholder="Your role"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reporterContact">Contact Number *</Label>
                <Input
                  id="reporterContact"
                  value={formData.reporterDetails.contact}
                  onChange={(e) => handleReporterChange('contact', e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <div>
                <Label htmlFor="relationship">Relationship to Incident</Label>
                <Input
                  id="relationship"
                  value={formData.reporterDetails.relationship}
                  onChange={(e) => handleReporterChange('relationship', e.target.value)}
                  placeholder="e.g., Injured person, Witness, Supervisor"
                />
              </div>
            </div>
          </div>

          {/* Incident Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Incident Details</h3>
            
            <div>
              <Label htmlFor="description">Incident Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Detailed description of what happened"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="sequenceOfEvents">Sequence of Events</Label>
              <Textarea
                id="sequenceOfEvents"
                value={formData.sequenceOfEvents}
                onChange={(e) => handleInputChange('sequenceOfEvents', e.target.value)}
                placeholder="Step-by-step description of events leading to the incident"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="immediateCause">Immediate Cause</Label>
                <Textarea
                  id="immediateCause"
                  value={formData.immediateCause}
                  onChange={(e) => handleInputChange('immediateCause', e.target.value)}
                  placeholder="What directly caused the incident?"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="underlyingCause">Underlying Cause</Label>
                <Textarea
                  id="underlyingCause"
                  value={formData.underlyingCause}
                  onChange={(e) => handleInputChange('underlyingCause', e.target.value)}
                  placeholder="What were the root causes?"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Injury Details (if applicable) */}
          {(formData.incidentType === 'Personal Injury' || formData.severity !== 'Near Miss') && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Injury Details</h3>
              
              <div>
                <Label>Type of Injury</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                  {injuryTypes.map(type => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={type}
                        checked={formData.injuryType.includes(type)}
                        onCheckedChange={(checked) => handleInjuryTypeChange(type, checked as boolean)}
                      />
                      <Label htmlFor={type} className="text-sm">{type}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Body Parts Affected</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                  {bodyParts.map(part => (
                    <div key={part} className="flex items-center space-x-2">
                      <Checkbox
                        id={part}
                        checked={formData.bodyPartsAffected.includes(part)}
                        onCheckedChange={(checked) => handleBodyPartChange(part, checked as boolean)}
                      />
                      <Label htmlFor={part} className="text-sm">{part}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="treatmentProvided">Treatment Provided</Label>
                  <Textarea
                    id="treatmentProvided"
                    value={formData.treatmentProvided}
                    onChange={(e) => handleInputChange('treatmentProvided', e.target.value)}
                    placeholder="First aid or medical treatment provided"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="medicalAttention">Medical Attention Details</Label>
                  <Textarea
                    id="medicalAttention"
                    value={formData.medicalAttention}
                    onChange={(e) => handleInputChange('medicalAttention', e.target.value)}
                    placeholder="Doctor, hospital, medical facility details"
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hospitalizationRequired"
                    checked={formData.hospitalizationRequired}
                    onCheckedChange={(checked) => {
                      handleInputChange('hospitalizationRequired', checked);
                      checkNotifiableIncident();
                    }}
                  />
                  <Label htmlFor="hospitalizationRequired">Hospitalization Required</Label>
                </div>
                <div>
                  <Label htmlFor="timeOffWork">Estimated Time Off Work</Label>
                  <Input
                    id="timeOffWork"
                    value={formData.timeOffWork}
                    onChange={(e) => handleInputChange('timeOffWork', e.target.value)}
                    placeholder="e.g., 2 days, 1 week, indefinite"
                  />
                </div>
              </div>
            </div>
          )}

          {/* WorkSafe NZ Notification */}
          {formData.notifiableIncident && (
            <div className="space-y-4 border-2 border-red-200 p-4 rounded-lg bg-red-50">
              <h3 className="text-lg font-semibold border-b pb-2 text-red-700">
                ⚠️ WorkSafe NZ Notification Required
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="workSafeNotified"
                    checked={formData.workSafeNotified}
                    onCheckedChange={(checked) => handleInputChange('workSafeNotified', checked)}
                  />
                  <Label htmlFor="workSafeNotified" className="text-red-700">WorkSafe NZ has been notified</Label>
                </div>
                <div>
                  <Label htmlFor="workSafeNotificationDate">Notification Date</Label>
                  <Input
                    id="workSafeNotificationDate"
                    type="date"
                    value={formData.workSafeNotificationDate}
                    onChange={(e) => handleInputChange('workSafeNotificationDate', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="referenceNumber">WorkSafe NZ Reference Number</Label>
                <Input
                  id="referenceNumber"
                  value={formData.referenceNumber}
                  onChange={(e) => handleInputChange('referenceNumber', e.target.value)}
                  placeholder="Reference number from WorkSafe NZ"
                />
              </div>
            </div>
          )}

          {/* Immediate Actions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Immediate Actions</h3>
            
            <div>
              <Label htmlFor="immediateActions">Immediate Actions Taken</Label>
              <Textarea
                id="immediateActions"
                value={formData.immediateActions}
                onChange={(e) => handleInputChange('immediateActions', e.target.value)}
                placeholder="What immediate actions were taken at the scene?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="emergencyServicesCalled"
                  checked={formData.emergencyServicesCalled}
                  onCheckedChange={(checked) => handleInputChange('emergencyServicesCalled', checked)}
                />
                <Label htmlFor="emergencyServicesCalled">Emergency Services Called</Label>
              </div>
              <div>
                <Label htmlFor="emergencyServicesDetails">Emergency Services Details</Label>
                <Input
                  id="emergencyServicesDetails"
                  value={formData.emergencyServicesDetails}
                  onChange={(e) => handleInputChange('emergencyServicesDetails', e.target.value)}
                  placeholder="e.g., Ambulance, Fire, Police"
                />
              </div>
            </div>
          </div>

          {/* Corrective Actions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Corrective Actions & Prevention</h3>
            
            <div>
              <Label htmlFor="correctiveActions">Corrective Actions Required</Label>
              <Textarea
                id="correctiveActions"
                value={formData.correctiveActions.join('\n')}
                onChange={(e) => handleInputChange('correctiveActions', e.target.value.split('\n').filter(a => a.trim()))}
                placeholder="List corrective actions (one per line)"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="preventionMeasures">Prevention Measures</Label>
              <Textarea
                id="preventionMeasures"
                value={formData.preventionMeasures.join('\n')}
                onChange={(e) => handleInputChange('preventionMeasures', e.target.value.split('\n').filter(a => a.trim()))}
                placeholder="List prevention measures (one per line)"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="responsiblePerson">Responsible Person</Label>
                <Input
                  id="responsiblePerson"
                  value={formData.responsiblePerson}
                  onChange={(e) => handleInputChange('responsiblePerson', e.target.value)}
                  placeholder="Person responsible for follow-up"
                />
              </div>
              <div>
                <Label htmlFor="targetCompletionDate">Target Completion Date</Label>
                <Input
                  id="targetCompletionDate"
                  type="date"
                  value={formData.targetCompletionDate}
                  onChange={(e) => handleInputChange('targetCompletionDate', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 pt-4 border-t">
            <Button 
              onClick={() => handleSubmit('save')} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save as Draft
            </Button>
            <Button 
              onClick={() => handleSubmit('submit')} 
              className="bg-pulse-forest hover:bg-pulse-forest-dark text-white flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Submit Incident Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
