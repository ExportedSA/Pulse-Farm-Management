import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Droplets, 
  Calendar as CalendarIcon, 
  MapPin, 
  Cloud, 
  Thermometer, 
  Save, 
  Send,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { format, addDays } from 'date-fns';

interface EffluentRecord {
  // Basic Information
  applicationDate: string;
  operatorName: string;
  supervisorName: string;
  
  // Location Details
  paddockId: string;
  paddockName: string;
  area: number; // hectares
  soilType: string;
  
  // Weather Conditions
  temperature: number;
  rainfall: number;
  windSpeed: number;
  windDirection: string;
  soilMoisture: string;
  forecast: string;
  
  // Effluent Details
  source: string;
  volume: number; // cubic meters
  applicationRate: number; // L/ha
  applicationMethod: string;
  irrigationType: string;
  
  // Compliance Checks
  standDownPeriod: number;
  nextApplicationDate: string;
  pondLevel: string;
  overflowRisk: string;
  
  // Regulatory Compliance
  regionalCouncilPermit: string;
  fonterraCompliance: boolean;
  synlaitCompliance: boolean;
  asureQualityCompliance: boolean;
  
  // Documentation
  notes: string;
  photos: string[];
  witnessName: string;
}

export default function EffluentManagementForm() {
  const [formData, setFormData] = useState<Partial<EffluentRecord>>({
    applicationDate: new Date().toISOString().split('T')[0],
    operatorName: '',
    supervisorName: '',
    paddockId: '',
    paddockName: '',
    area: 0,
    soilType: '',
    temperature: 0,
    rainfall: 0,
    windSpeed: 0,
    windDirection: '',
    soilMoisture: '',
    forecast: '',
    source: '',
    volume: 0,
    applicationRate: 0,
    applicationMethod: '',
    irrigationType: '',
    standDownPeriod: 0,
    nextApplicationDate: '',
    pondLevel: '',
    overflowRisk: '',
    regionalCouncilPermit: '',
    fonterraCompliance: true,
    synlaitCompliance: true,
    asureQualityCompliance: true,
    notes: '',
    photos: [],
    witnessName: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCalculating, setIsCalculating] = useState(false);

  const soilTypes = [
    'Sandy Loam', 'Clay Loam', 'Silt Loam', 'Peat', 'Sandy', 'Clay', 'Loam'
  ];

  const windDirections = [
    'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'Calm'
  ];

  const soilMoistureLevels = [
    'Very Dry', 'Dry', 'Moist', 'Wet', 'Very Wet', 'Saturated'
  ];

  const effluentSources = [
    'Dairy Shed', 'Feedpad', 'Holding Pond 1', 'Holding Pond 2', 'Weeping Wall', 'Sediment Pond'
  ];

  const applicationMethods = [
    'Traveling Irrigator', 'Centre Pivot', 'K-Line', 'Hard Hose', 'Sludge Tank', 'Broadcast Spreader'
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const calculateApplicationRate = () => {
    setIsCalculating(true);
    if (formData.area && formData.volume) {
      const rate = (formData.volume * 1000) / formData.area; // Convert m³ to L, then L/ha
      setFormData(prev => ({ ...prev, applicationRate: Math.round(rate) }));
    }
    setIsCalculating(false);
  };

  const calculateNextApplicationDate = () => {
    if (formData.applicationDate && formData.standDownPeriod) {
      const nextDate = addDays(new Date(formData.applicationDate), formData.standDownPeriod);
      setFormData(prev => ({ 
        ...prev, 
        nextApplicationDate: nextDate.toISOString().split('T')[0] 
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Required fields validation
    if (!formData.applicationDate) newErrors.applicationDate = 'Application date is required';
    if (!formData.operatorName) newErrors.operatorName = 'Operator name is required';
    if (!formData.paddockId) newErrors.paddockId = 'Paddock ID is required';
    if (!formData.area || formData.area <= 0) newErrors.area = 'Valid area is required';
    if (!formData.soilType) newErrors.soilType = 'Soil type is required';
    if (!formData.source) newErrors.source = 'Effluent source is required';
    if (!formData.volume || formData.volume <= 0) newErrors.volume = 'Valid volume is required';
    if (!formData.applicationMethod) newErrors.applicationMethod = 'Application method is required';
    
    // Weather condition validations
    if (formData.windSpeed && formData.windSpeed > 20) {
      newErrors.windSpeed = 'Wind speed too high for application (>20 km/h)';
    }
    
    if (formData.rainfall && formData.rainfall > 10) {
      newErrors.rainfall = 'Rainfall too high for application (>10mm)';
    }
    
    // Application rate validation (typical range 10-50 L/ha)
    if (formData.applicationRate && (formData.applicationRate < 10 || formData.applicationRate > 50)) {
      newErrors.applicationRate = 'Application rate outside recommended range (10-50 L/ha)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (action: 'save' | 'submit') => {
    if (!validateForm()) {
      return;
    }
    
    console.log('Effluent record submitted:', { formData, action });
    
    if (action === 'submit') {
      alert('Effluent management record submitted successfully!');
    } else {
      alert('Effluent management record saved as draft!');
    }
  };

  const getComplianceStatus = () => {
    const issues = [];
    
    if (formData.windSpeed && formData.windSpeed > 15) issues.push('High wind speed');
    if (formData.rainfall && formData.rainfall > 5) issues.push('Recent rainfall');
    if (formData.soilMoisture === 'Saturated') issues.push('Saturated soil');
    if (formData.applicationRate && formData.applicationRate > 40) issues.push('High application rate');
    
    if (issues.length === 0) return { status: 'compliant', color: 'green', message: 'All compliance checks passed' };
    if (issues.length <= 2) return { status: 'warning', color: 'orange', message: `Warnings: ${issues.join(', ')}` };
    return { status: 'non-compliant', color: 'red', message: `Non-compliant: ${issues.join(', ')}` };
  };

  const compliance = getComplianceStatus();

  return (
    <div className="space-y-6">
      {/* Compliance Status Banner */}
      <Card className={`border-l-4 ${
        compliance.status === 'compliant' ? 'border-l-green-500' : 
        compliance.status === 'warning' ? 'border-l-orange-500' : 'border-l-red-500'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {compliance.status === 'compliant' ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            )}
            <div>
              <h3 className="font-semibold">Compliance Status: {compliance.status.toUpperCase()}</h3>
              <p className="text-sm text-gray-600">{compliance.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regulatory Compliance Badges */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">Regulatory Coverage:</h4>
              <Badge className="bg-blue-100 text-blue-800">Regional Council</Badge>
              <Badge className="bg-purple-100 text-purple-800">Fonterra</Badge>
              <Badge className="bg-green-100 text-green-800">Synlait</Badge>
              <Badge className="bg-orange-100 text-orange-800">AsureQuality</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Info className="h-4 w-4" />
              <span>This form satisfies multiple regulatory requirements</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-600" />
            Effluent Spreading Application Record
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="applicationDate">Application Date *</Label>
                <Input
                  id="applicationDate"
                  type="date"
                  value={formData.applicationDate}
                  onChange={(e) => handleInputChange('applicationDate', e.target.value)}
                  className={errors.applicationDate ? 'border-red-500' : ''}
                />
                {errors.applicationDate && <p className="text-sm text-red-500">{errors.applicationDate}</p>}
              </div>
              <div>
                <Label htmlFor="operatorName">Operator Name *</Label>
                <Input
                  id="operatorName"
                  value={formData.operatorName}
                  onChange={(e) => handleInputChange('operatorName', e.target.value)}
                  placeholder="Name of person applying effluent"
                  className={errors.operatorName ? 'border-red-500' : ''}
                />
                {errors.operatorName && <p className="text-sm text-red-500">{errors.operatorName}</p>}
              </div>
              <div>
                <Label htmlFor="supervisorName">Supervisor Name</Label>
                <Input
                  id="supervisorName"
                  value={formData.supervisorName}
                  onChange={(e) => handleInputChange('supervisorName', e.target.value)}
                  placeholder="Name of supervising person"
                />
              </div>
            </div>
          </div>

          {/* Location Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Location Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="paddockId">Paddock ID *</Label>
                <Input
                  id="paddockId"
                  value={formData.paddockId}
                  onChange={(e) => handleInputChange('paddockId', e.target.value)}
                  placeholder="e.g., P12, North Block"
                  className={errors.paddockId ? 'border-red-500' : ''}
                />
                {errors.paddockId && <p className="text-sm text-red-500">{errors.paddockId}</p>}
              </div>
              <div>
                <Label htmlFor="paddockName">Paddock Name</Label>
                <Input
                  id="paddockName"
                  value={formData.paddockName}
                  onChange={(e) => handleInputChange('paddockName', e.target.value)}
                  placeholder="e.g., River Flat, Hill Paddock"
                />
              </div>
              <div>
                <Label htmlFor="area">Area (hectares) *</Label>
                <Input
                  id="area"
                  type="number"
                  step="0.1"
                  value={formData.area}
                  onChange={(e) => handleInputChange('area', parseFloat(e.target.value))}
                  placeholder="e.g., 2.5"
                  className={errors.area ? 'border-red-500' : ''}
                />
                {errors.area && <p className="text-sm text-red-500">{errors.area}</p>}
              </div>
              <div>
                <Label htmlFor="soilType">Soil Type *</Label>
                <Select value={formData.soilType} onValueChange={(value) => handleInputChange('soilType', value)}>
                  <SelectTrigger className={errors.soilType ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select soil type" />
                  </SelectTrigger>
                  <SelectContent>
                    {soilTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.soilType && <p className="text-sm text-red-500">{errors.soilType}</p>}
              </div>
            </div>
          </div>

          {/* Weather Conditions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Weather Conditions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="temperature">Temperature (°C)</Label>
                <Input
                  id="temperature"
                  type="number"
                  value={formData.temperature}
                  onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                  placeholder="e.g., 15"
                />
              </div>
              <div>
                <Label htmlFor="rainfall">Rainfall (last 24h, mm)</Label>
                <Input
                  id="rainfall"
                  type="number"
                  step="0.1"
                  value={formData.rainfall}
                  onChange={(e) => handleInputChange('rainfall', parseFloat(e.target.value))}
                  placeholder="e.g., 2.5"
                  className={errors.rainfall ? 'border-red-500' : ''}
                />
                {errors.rainfall && <p className="text-sm text-red-500">{errors.rainfall}</p>}
              </div>
              <div>
                <Label htmlFor="windSpeed">Wind Speed (km/h)</Label>
                <Input
                  id="windSpeed"
                  type="number"
                  value={formData.windSpeed}
                  onChange={(e) => handleInputChange('windSpeed', parseFloat(e.target.value))}
                  placeholder="e.g., 10"
                  className={errors.windSpeed ? 'border-red-500' : ''}
                />
                {errors.windSpeed && <p className="text-sm text-red-500">{errors.windSpeed}</p>}
              </div>
              <div>
                <Label htmlFor="windDirection">Wind Direction</Label>
                <Select value={formData.windDirection} onValueChange={(value) => handleInputChange('windDirection', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    {windDirections.map(direction => (
                      <SelectItem key={direction} value={direction}>{direction}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="soilMoisture">Soil Moisture</Label>
                <Select value={formData.soilMoisture} onValueChange={(value) => handleInputChange('soilMoisture', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select moisture level" />
                  </SelectTrigger>
                  <SelectContent>
                    {soilMoistureLevels.map(level => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="forecast">Weather Forecast</Label>
                <Input
                  id="forecast"
                  value={formData.forecast}
                  onChange={(e) => handleInputChange('forecast', e.target.value)}
                  placeholder="e.g., Clear for 48 hours"
                />
              </div>
            </div>
          </div>

          {/* Effluent Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Effluent Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="source">Effluent Source *</Label>
                <Select value={formData.source} onValueChange={(value) => handleInputChange('source', value)}>
                  <SelectTrigger className={errors.source ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {effluentSources.map(source => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.source && <p className="text-sm text-red-500">{errors.source}</p>}
              </div>
              <div>
                <Label htmlFor="volume">Volume (m³) *</Label>
                <Input
                  id="volume"
                  type="number"
                  step="0.1"
                  value={formData.volume}
                  onChange={(e) => handleInputChange('volume', parseFloat(e.target.value))}
                  placeholder="e.g., 50"
                  className={errors.volume ? 'border-red-500' : ''}
                />
                {errors.volume && <p className="text-sm text-red-500">{errors.volume}</p>}
              </div>
              <div>
                <Label htmlFor="applicationRate">Application Rate (L/ha)</Label>
                <div className="flex gap-2">
                  <Input
                    id="applicationRate"
                    type="number"
                    value={formData.applicationRate}
                    readOnly
                    placeholder="Auto-calculated"
                    className="bg-gray-50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={calculateApplicationRate}
                    disabled={isCalculating || !formData.area || !formData.volume}
                  >
                    Calculate
                  </Button>
                </div>
                {errors.applicationRate && <p className="text-sm text-red-500">{errors.applicationRate}</p>}
              </div>
              <div>
                <Label htmlFor="applicationMethod">Application Method *</Label>
                <Select value={formData.applicationMethod} onValueChange={(value) => handleInputChange('applicationMethod', value)}>
                  <SelectTrigger className={errors.applicationMethod ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {applicationMethods.map(method => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.applicationMethod && <p className="text-sm text-red-500">{errors.applicationMethod}</p>}
              </div>
            </div>
          </div>

          {/* Compliance & Stand-down */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Compliance & Stand-down Period</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="standDownPeriod">Stand-down Period (days)</Label>
                <Input
                  id="standDownPeriod"
                  type="number"
                  value={formData.standDownPeriod}
                  onChange={(e) => handleInputChange('standDownPeriod', parseInt(e.target.value))}
                  placeholder="e.g., 21"
                />
              </div>
              <div>
                <Label htmlFor="nextApplicationDate">Next Application Date</Label>
                <div className="flex gap-2">
                  <Input
                    id="nextApplicationDate"
                    type="date"
                    value={formData.nextApplicationDate}
                    readOnly
                    className="bg-gray-50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={calculateNextApplicationDate}
                    disabled={!formData.applicationDate || !formData.standDownPeriod}
                  >
                    Calculate
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="pondLevel">Pond Level After Application</Label>
                <Select value={formData.pondLevel} onValueChange={(value) => handleInputChange('pondLevel', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Regulatory Compliance */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Regulatory Compliance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="regionalCouncilPermit">Regional Council Permit Number</Label>
                <Input
                  id="regionalCouncilPermit"
                  value={formData.regionalCouncilPermit}
                  onChange={(e) => handleInputChange('regionalCouncilPermit', e.target.value)}
                  placeholder="Permit reference number"
                />
              </div>
              <div className="space-y-2">
                <Label>Compliance Declarations</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fonterra"
                      checked={formData.fonterraCompliance}
                      onCheckedChange={(checked) => handleInputChange('fonterraCompliance', checked)}
                    />
                    <Label htmlFor="fonterra" className="text-sm">Fonterra Farm Source compliance</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="synlait"
                      checked={formData.synlaitCompliance}
                      onCheckedChange={(checked) => handleInputChange('synlaitCompliance', checked)}
                    />
                    <Label htmlFor="synlait" className="text-sm">Synlait Lead With Pride compliance</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="asureQuality"
                      checked={formData.asureQualityCompliance}
                      onCheckedChange={(checked) => handleInputChange('asureQualityCompliance', checked)}
                    />
                    <Label htmlFor="asureQuality" className="text-sm">AsureQuality standards compliance</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="witnessName">Witness Name</Label>
                <Input
                  id="witnessName"
                  value={formData.witnessName}
                  onChange={(e) => handleInputChange('witnessName', e.target.value)}
                  placeholder="Name of witness to application"
                />
              </div>
              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Any additional observations or notes"
                  rows={3}
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
              Submit Record
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
