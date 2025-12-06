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
import { AlertTriangle, MapPin, Calendar, User, Shield, Save, Send, Camera, Download, Signature } from 'lucide-react';

interface HazardFormData {
  // Basic Information
  title: string;
  description: string;
  location: string;
  department: string;
  reportedBy: string;
  dateReported: string;
  
  // Hazard Classification
  hazardType: string;
  hazardCategory: string;
  
  // Risk Assessment (WorkSafe NZ 5x5 Matrix)
  likelihood: string;
  consequence: string;
  riskLevel: string;
  
  // People at Risk
  peopleAffected: string[];
  numberOfPeople: string;
  
  // Control Measures
  existingControls: string;
  requiredControls: string;
  controlHierarchy: string[];
  
  // Action Plan
  responsiblePerson: string;
  priorityLevel: string;
  targetDate: string;
  reviewDate: string;
  
  // Additional Information
  photos: string[];
  witnesses: string[];
  immediateActions: string;
}

const hazardTypes = [
  'Physical', 'Chemical', 'Biological', 'Ergonomic', 'Psychosocial', 'Safety', 'Environmental'
];

const hazardCategories = [
  'Machinery', 'Electricity', 'Height', 'Confined Space', 'Chemicals', 'Animals', 
  'Vehicles', 'Noise', 'Temperature', 'Manual Handling', 'Slips/Trips/Falls', 'Other'
];

const likelihoodLevels = [
  { value: '5', label: 'Almost Certain', description: 'Expected to occur in most circumstances' },
  { value: '4', label: 'Likely', description: 'Will probably occur in most circumstances' },
  { value: '3', label: 'Possible', description: 'Could occur at some time' },
  { value: '2', label: 'Unlikely', description: 'Unlikely to occur but possible' },
  { value: '1', label: 'Rare', description: 'May occur only in exceptional circumstances' }
];

const consequenceLevels = [
  { value: '5', label: 'Catastrophic', description: 'Death or permanent disability' },
  { value: '4', label: 'Critical', description: 'Serious injury requiring medical treatment' },
  { value: '3', label: 'Moderate', description: 'Medical treatment and time off work' },
  { value: '2', label: 'Minor', description: 'First aid treatment only' },
  { value: '1', label: 'Insignificant', description: 'No injury or health effects' }
];

const controlHierarchy = [
  'Elimination', 'Substitution', 'Isolation', 'Engineering', 'Administration', 'PPE'
];

const peopleAffectedOptions = [
  'Employees', 'Contractors', 'Visitors', 'Public', 'Animals', 'Environment'
];

export default function HazardIdentificationForm() {
  const [formData, setFormData] = useState<HazardFormData>({
    title: '',
    description: '',
    location: '',
    department: '',
    reportedBy: '',
    dateReported: new Date().toISOString().split('T')[0],
    hazardType: '',
    hazardCategory: '',
    likelihood: '',
    consequence: '',
    riskLevel: '',
    peopleAffected: [],
    numberOfPeople: '',
    existingControls: '',
    requiredControls: '',
    controlHierarchy: [],
    responsiblePerson: '',
    priorityLevel: '',
    targetDate: '',
    reviewDate: '',
    photos: [],
    witnesses: [],
    immediateActions: ''
  });

  const [isCalculatingRisk, setIsCalculatingRisk] = useState(false);

  // Calculate risk level based on WorkSafe NZ 5x5 matrix
  const calculateRiskLevel = (likelihood: string, consequence: string) => {
    if (!likelihood || !consequence) return '';
    
    const likelihoodNum = parseInt(likelihood);
    const consequenceNum = parseInt(consequence);
    const riskScore = likelihoodNum * consequenceNum;
    
    if (riskScore >= 15) return 'Extreme';
    if (riskScore >= 10) return 'High';
    if (riskScore >= 5) return 'Moderate';
    if (riskScore >= 3) return 'Low';
    return 'Insignificant';
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Extreme': return 'bg-red-600 text-white';
      case 'High': return 'bg-red-500 text-white';
      case 'Moderate': return 'bg-orange-500 text-white';
      case 'Low': return 'bg-yellow-500 text-black';
      case 'Insignificant': return 'bg-green-500 text-white';
      default: return 'bg-gray-200 text-black';
    }
  };

  // Update risk level when likelihood or consequence changes
  const updateRiskAssessment = (field: 'likelihood' | 'consequence', value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      updated.riskLevel = calculateRiskLevel(updated.likelihood, updated.consequence);
      
      // Auto-set priority based on risk level
      if (updated.riskLevel === 'Extreme' || updated.riskLevel === 'High') {
        updated.priorityLevel = 'Critical';
      } else if (updated.riskLevel === 'Moderate') {
        updated.priorityLevel = 'High';
      } else if (updated.riskLevel === 'Low') {
        updated.priorityLevel = 'Medium';
      } else {
        updated.priorityLevel = 'Low';
      }
      
      return updated;
    });
  };

  const handleInputChange = (field: keyof HazardFormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      peopleAffected: checked 
        ? [...prev.peopleAffected, value]
        : prev.peopleAffected.filter(item => item !== value)
    }));
  };

  const handleSubmit = async (action: 'save' | 'submit') => {
    // Validate required fields
    const requiredFields = ['title', 'description', 'location', 'hazardType', 'likelihood', 'consequence'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof HazardFormData]);
    
    if (missingFields.length > 0) {
      alert(`Please complete all required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Here you would typically save to your backend
    console.log('Hazard form data:', formData);
    console.log('Action:', action);
    
    if (action === 'submit') {
      alert('Hazard identification submitted successfully!');
    } else {
      alert('Hazard identification saved as draft!');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Hazard Identification Form - WorkSafe NZ Compliant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Hazard Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Brief description of the hazard"
                />
              </div>
              <div>
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Specific location on farm"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Hazard Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Detailed description of the hazard, including what it is and how it could cause harm"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="department">Department/Area</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  placeholder="e.g., Dairy Shed, Workshop"
                />
              </div>
              <div>
                <Label htmlFor="reportedBy">Reported By</Label>
                <Input
                  id="reportedBy"
                  value={formData.reportedBy}
                  onChange={(e) => handleInputChange('reportedBy', e.target.value)}
                  placeholder="Your name"
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
            </div>
          </div>

          {/* Hazard Classification Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Hazard Classification</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hazardType">Hazard Type *</Label>
                <Select value={formData.hazardType} onValueChange={(value) => handleInputChange('hazardType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hazard type" />
                  </SelectTrigger>
                  <SelectContent>
                    {hazardTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="hazardCategory">Hazard Category</Label>
                <Select value={formData.hazardCategory} onValueChange={(value) => handleInputChange('hazardCategory', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {hazardCategories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Risk Assessment Section - WorkSafe NZ 5x5 Matrix */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Risk Assessment (WorkSafe NZ 5x5 Matrix)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="likelihood">Likelihood *</Label>
                <Select value={formData.likelihood} onValueChange={(value) => updateRiskAssessment('likelihood', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select likelihood" />
                  </SelectTrigger>
                  <SelectContent>
                    {likelihoodLevels.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label} ({level.value}) - {level.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="consequence">Consequence *</Label>
                <Select value={formData.consequence} onValueChange={(value) => updateRiskAssessment('consequence', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select consequence" />
                  </SelectTrigger>
                  <SelectContent>
                    {consequenceLevels.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label} ({level.value}) - {level.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.riskLevel && (
              <div className="flex items-center gap-2">
                <Label>Risk Level:</Label>
                <Badge className={getRiskColor(formData.riskLevel)}>
                  {formData.riskLevel} ({parseInt(formData.likelihood) * parseInt(formData.consequence)})
                </Badge>
              </div>
            )}
          </div>

          {/* People at Risk Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">People at Risk</h3>
            
            <div>
              <Label>Who could be affected?</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                {peopleAffectedOptions.map(option => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={option}
                      checked={formData.peopleAffected.includes(option)}
                      onCheckedChange={(checked) => handleCheckboxChange(option, checked as boolean)}
                    />
                    <Label htmlFor={option} className="text-sm">{option}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="numberOfPeople">Number of people potentially affected</Label>
              <Input
                id="numberOfPeople"
                value={formData.numberOfPeople}
                onChange={(e) => handleInputChange('numberOfPeople', e.target.value)}
                placeholder="e.g., 1-2, 3-5, 6+"
              />
            </div>
          </div>

          {/* Control Measures Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Control Measures</h3>
            
            <div>
              <Label htmlFor="existingControls">Existing Control Measures</Label>
              <Textarea
                id="existingControls"
                value={formData.existingControls}
                onChange={(e) => handleInputChange('existingControls', e.target.value)}
                placeholder="What controls are already in place?"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="requiredControls">Required Control Measures</Label>
              <Textarea
                id="requiredControls"
                value={formData.requiredControls}
                onChange={(e) => handleInputChange('requiredControls', e.target.value)}
                placeholder="What additional controls are needed?"
                rows={2}
              />
            </div>

            <div>
              <Label>Control Hierarchy (Select all that apply)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                {controlHierarchy.map(control => (
                  <div key={control} className="flex items-center space-x-2">
                    <Checkbox
                      id={control}
                      checked={formData.controlHierarchy.includes(control)}
                      onCheckedChange={(checked) => {
                        setFormData(prev => ({
                          ...prev,
                          controlHierarchy: checked 
                            ? [...prev.controlHierarchy, control]
                            : prev.controlHierarchy.filter(item => item !== control)
                        }));
                      }}
                    />
                    <Label htmlFor={control} className="text-sm">{control}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Plan Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Action Plan</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="responsiblePerson">Responsible Person</Label>
                <Input
                  id="responsiblePerson"
                  value={formData.responsiblePerson}
                  onChange={(e) => handleInputChange('responsiblePerson', e.target.value)}
                  placeholder="Person responsible for actions"
                />
              </div>
              <div>
                <Label htmlFor="priorityLevel">Priority Level</Label>
                <Select value={formData.priorityLevel} onValueChange={(value) => handleInputChange('priorityLevel', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="targetDate">Target Completion Date</Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => handleInputChange('targetDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="reviewDate">Review Date</Label>
                <Input
                  id="reviewDate"
                  type="date"
                  value={formData.reviewDate}
                  onChange={(e) => handleInputChange('reviewDate', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Additional Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Additional Information</h3>
            
            <div>
              <Label htmlFor="witnesses">Witnesses</Label>
              <Input
                id="witnesses"
                value={formData.witnesses}
                onChange={(e) => handleInputChange('witnesses', e.target.value)}
                placeholder="Names of any witnesses"
              />
            </div>

            <div>
              <Label htmlFor="immediateActions">Immediate Actions Taken</Label>
              <Textarea
                id="immediateActions"
                value={formData.immediateActions}
                onChange={(e) => handleInputChange('immediateActions', e.target.value)}
                placeholder="What immediate actions have been taken?"
                rows={2}
              />
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
              Submit Hazard Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
