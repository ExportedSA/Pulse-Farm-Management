import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  SprayCan, 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Info,
  Save,
  Send,
  Shield
} from 'lucide-react';
import { format, addDays, addHours } from 'date-fns';

interface SprayRecord {
  // Basic Information
  applicationDate: string;
  applicationTime: string;
  operatorName: string;
  supervisorName: string;
  
  // Location Details
  paddockId: string;
  paddockName: string;
  area: number; // hectares
  cropType: string;
  
  // Chemical Details
  chemicalName: string;
  acvmNumber: string;
  activeIngredient: string;
  manufacturer: string;
  batchNumber: string;
  expiryDate: string;
  
  // Application Details
  applicationRate: number; // L/ha or kg/ha
  totalVolume: number; // L or kg
  applicationMethod: string;
  equipmentUsed: string;
  weatherConditions: string;
  temperature: number;
  windSpeed: number;
  windDirection: string;
  
  // Target Information
  targetPest: string;
  targetWeed: string;
  targetDisease: string;
  growthStage: string;
  
  // Compliance & Safety
  withholdingPeriod: number; // days
  reentryPeriod: number; // hours
  harvestDate: string;
  grazingDate: string;
  workerReentryDate: string;
  
  // PPE Requirements
  ppeRequired: string[];
  ppeWorn: string[];
  
  // Environmental Safety
  bufferZone: boolean;
  distanceToWaterway: number;
  soilMoisture: string;
  irrigationAfter: boolean;
  
  // Regulatory Compliance
  nzgapCompliance: boolean;
  asureQualityCompliance: boolean;
  fonterraCompliance: boolean;
  synlaitCompliance: boolean;
  
  // Documentation
  notes: string;
  photos: string[];
  witnessName: string;
}

export default function SprayRecordsForm() {
  const [formData, setFormData] = useState<Partial<SprayRecord>>({
    applicationDate: new Date().toISOString().split('T')[0],
    applicationTime: new Date().toTimeString().slice(0, 5),
    operatorName: '',
    supervisorName: '',
    paddockId: '',
    paddockName: '',
    area: 0,
    cropType: '',
    chemicalName: '',
    acvmNumber: '',
    activeIngredient: '',
    manufacturer: '',
    batchNumber: '',
    expiryDate: '',
    applicationRate: 0,
    totalVolume: 0,
    applicationMethod: '',
    equipmentUsed: '',
    weatherConditions: '',
    temperature: 0,
    windSpeed: 0,
    windDirection: '',
    targetPest: '',
    targetWeed: '',
    targetDisease: '',
    growthStage: '',
    withholdingPeriod: 0,
    reentryPeriod: 0,
    harvestDate: '',
    grazingDate: '',
    workerReentryDate: '',
    ppeRequired: [],
    ppeWorn: [],
    bufferZone: false,
    distanceToWaterway: 0,
    soilMoisture: '',
    irrigationAfter: false,
    nzgapCompliance: true,
    asureQualityCompliance: true,
    fonterraCompliance: true,
    synlaitCompliance: true,
    notes: '',
    photos: [],
    witnessName: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const cropTypes = [
    'Dairy Pasture', 'Beef Pasture', 'Maize', 'Silage', 'Kale', 'Turnips', 'Barley', 'Wheat', 'Other'
  ];

  const applicationMethods = [
    'Boom Spray', 'Airblast Sprayer', 'Knapsack Sprayer', 'Granular Spreader', 'Aerial Application', 'Hand Application'
  ];

  const weatherConditions = [
    'Clear', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Windy', 'Calm', 'Foggy'
  ];

  const windDirections = [
    'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'Calm'
  ];

  const soilMoistureLevels = [
    'Very Dry', 'Dry', 'Moist', 'Wet', 'Very Wet'
  ];

  const growthStages = [
    'Seedling', 'Vegetative', 'Early Flowering', 'Full Flowering', 'Fruiting', 'Mature', 'Dormant'
  ];

  const ppeOptions = [
    'Chemical Resistant Gloves', 'Safety Goggles', 'Face Shield', 'Respirator', 'Chemical Suit', 
    'Boots', 'Hat', 'Long Sleeves', 'Long Pants', 'Apron'
  ];

  // Predefined chemicals with ACVM numbers and withholding periods
  const chemicalProducts = [
    { name: 'Glyphosate 360', acvm: 'P12345', activeIngredient: 'Glyphosate', withholding: 7, reentry: 4 },
    { name: '2,4-D Amine', acvm: 'P23456', activeIngredient: '2,4-D', withholding: 14, reentry: 8 },
    { name: 'MCPA', acvm: 'P34567', activeIngredient: 'MCPA', withholding: 7, reentry: 4 },
    { name: 'Dicamba', acvm: 'P45678', activeIngredient: 'Dicamba', withholding: 21, reentry: 12 },
    { name: 'Paraquat', acvm: 'P56789', activeIngredient: 'Paraquat', withholding: 14, reentry: 24 },
    { name: 'Captan', acvm: 'P67890', activeIngredient: 'Captan', withholding: 3, reentry: 24 },
    { name: 'Chlorothalonil', acvm: 'P78901', activeIngredient: 'Chlorothalonil', withholding: 7, reentry: 48 },
    { name: 'Mancozeb', acvm: 'P89012', activeIngredient: 'Mancozeb', withholding: 14, reentry: 24 }
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleProductSelect = (productName: string) => {
    const product = chemicalProducts.find(p => p.name === productName);
    if (product) {
      setFormData(prev => ({
        ...prev,
        chemicalName: product.name,
        acvmNumber: product.acvm,
        activeIngredient: product.activeIngredient,
        withholdingPeriod: product.withholding,
        reentryPeriod: product.reentry
      }));
      calculateComplianceDates(product.withholding, product.reentry);
    }
  };

  const calculateComplianceDates = (withholdingDays: number, reentryHours: number) => {
    if (formData.applicationDate) {
      const harvestDate = addDays(new Date(formData.applicationDate), withholdingDays);
      const grazingDate = addDays(new Date(formData.applicationDate), withholdingDays);
      const reentryDate = addHours(new Date(formData.applicationDate + 'T' + formData.applicationTime), reentryHours);
      
      setFormData(prev => ({
        ...prev,
        harvestDate: harvestDate.toISOString().split('T')[0],
        grazingDate: grazingDate.toISOString().split('T')[0],
        workerReentryDate: reentryDate.toISOString().slice(0, 16)
      }));
    }
  };

  const calculateTotalVolume = () => {
    if (formData.area && formData.applicationRate) {
      const total = formData.area * formData.applicationRate;
      setFormData(prev => ({ ...prev, totalVolume: Math.round(total * 10) / 10 }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Required fields validation
    if (!formData.applicationDate) newErrors.applicationDate = 'Application date is required';
    if (!formData.applicationTime) newErrors.applicationTime = 'Application time is required';
    if (!formData.operatorName) newErrors.operatorName = 'Operator name is required';
    if (!formData.paddockId) newErrors.paddockId = 'Paddock ID is required';
    if (!formData.area || formData.area <= 0) newErrors.area = 'Valid area is required';
    if (!formData.chemicalName) newErrors.chemicalName = 'Chemical name is required';
    if (!formData.acvmNumber) newErrors.acvmNumber = 'ACVM number is required';
    
    // ACVM number validation (P followed by 5 digits)
    if (formData.acvmNumber && !/^P\d{5}$/.test(formData.acvmNumber)) {
      newErrors.acvmNumber = 'ACVM number must be in format P12345';
    }
    
    // Weather condition validations
    if (formData.windSpeed && formData.windSpeed > 15) {
      newErrors.windSpeed = 'Wind speed too high for spraying (>15 km/h)';
    }
    
    if (formData.temperature && (formData.temperature < 5 || formData.temperature > 30)) {
      newErrors.temperature = 'Temperature outside recommended range (5-30°C)';
    }
    
    // Environmental validations
    if (formData.distanceToWaterway && formData.distanceToWaterway < 50) {
      newErrors.distanceToWaterway = 'Distance to waterway must be at least 50m';
    }
    
    if (!formData.bufferZone) {
      newErrors.bufferZone = 'Buffer zone required near waterways';
    }
    
    // PPE validation
    if (formData.ppeWorn && formData.ppeRequired && 
        formData.ppeWorn.length < formData.ppeRequired.length) {
      newErrors.ppeWorn = 'All required PPE must be worn';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (action: 'save' | 'submit') => {
    if (!validateForm()) {
      return;
    }
    
    console.log('Spray record submitted:', { formData, action });
    
    if (action === 'submit') {
      alert('Spray application record submitted successfully!');
    } else {
      alert('Spray application record saved as draft!');
    }
  };

  const getComplianceStatus = () => {
    const issues = [];
    
    if (formData.windSpeed && formData.windSpeed > 12) issues.push('High wind speed');
    if (formData.temperature && (formData.temperature < 8 || formData.temperature > 28)) issues.push('Temperature concerns');
    if (formData.distanceToWaterway && formData.distanceToWaterway < 100) issues.push('Close to waterway');
    if (!formData.bufferZone) issues.push('No buffer zone');
    if (formData.ppeWorn && formData.ppeRequired && 
        formData.ppeWorn.length < formData.ppeRequired.length) issues.push('PPE incomplete');
    
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
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold">Regulatory Coverage:</h4>
              <Badge className="bg-blue-100 text-blue-800">ACVM Act</Badge>
              <Badge className="bg-teal-100 text-teal-800">NZGAP</Badge>
              <Badge className="bg-orange-100 text-orange-800">AsureQuality</Badge>
              <Badge className="bg-purple-100 text-purple-800">Fonterra</Badge>
              <Badge className="bg-green-100 text-green-800">Synlait</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Info className="h-4 w-4" />
              <span>Withholding period compliance for milk/meat safety</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SprayCan className="h-5 w-5 text-purple-600" />
            Spray Application Record
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <Label htmlFor="applicationTime">Application Time *</Label>
                <Input
                  id="applicationTime"
                  type="time"
                  value={formData.applicationTime}
                  onChange={(e) => handleInputChange('applicationTime', e.target.value)}
                  className={errors.applicationTime ? 'border-red-500' : ''}
                />
                {errors.applicationTime && <p className="text-sm text-red-500">{errors.applicationTime}</p>}
              </div>
              <div>
                <Label htmlFor="operatorName">Operator Name *</Label>
                <Input
                  id="operatorName"
                  value={formData.operatorName}
                  onChange={(e) => handleInputChange('operatorName', e.target.value)}
                  placeholder="Name of person applying spray"
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
                <Label htmlFor="cropType">Crop Type</Label>
                <Select value={formData.cropType} onValueChange={(value) => handleInputChange('cropType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select crop type" />
                  </SelectTrigger>
                  <SelectContent>
                    {cropTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Chemical Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Chemical Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="chemicalName">Chemical Product *</Label>
                <Select value={formData.chemicalName} onValueChange={handleProductSelect}>
                  <SelectTrigger className={errors.chemicalName ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select chemical" />
                  </SelectTrigger>
                  <SelectContent>
                    {chemicalProducts.map(product => (
                      <SelectItem key={product.name} value={product.name}>
                        {product.name} ({product.acvm})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.chemicalName && <p className="text-sm text-red-500">{errors.chemicalName}</p>}
              </div>
              <div>
                <Label htmlFor="acvmNumber">ACVM Number *</Label>
                <Input
                  id="acvmNumber"
                  value={formData.acvmNumber}
                  onChange={(e) => handleInputChange('acvmNumber', e.target.value)}
                  placeholder="e.g., P12345"
                  className={errors.acvmNumber ? 'border-red-500' : ''}
                />
                {errors.acvmNumber && <p className="text-sm text-red-500">{errors.acvmNumber}</p>}
              </div>
              <div>
                <Label htmlFor="activeIngredient">Active Ingredient</Label>
                <Input
                  id="activeIngredient"
                  value={formData.activeIngredient}
                  readOnly
                  placeholder="Auto-populated"
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                  placeholder="e.g., Bayer, Syngenta"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="batchNumber">Batch Number</Label>
                <Input
                  id="batchNumber"
                  value={formData.batchNumber}
                  onChange={(e) => handleInputChange('batchNumber', e.target.value)}
                  placeholder="e.g., B123456"
                />
              </div>
              <div>
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="applicationRate">Application Rate (L/ha or kg/ha)</Label>
                <div className="flex gap-2">
                  <Input
                    id="applicationRate"
                    type="number"
                    step="0.1"
                    value={formData.applicationRate}
                    onChange={(e) => handleInputChange('applicationRate', parseFloat(e.target.value))}
                    placeholder="e.g., 2.5"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={calculateTotalVolume}
                    disabled={!formData.area || !formData.applicationRate}
                  >
                    Calculate Total
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="totalVolume">Total Volume (L or kg)</Label>
                <Input
                  id="totalVolume"
                  type="number"
                  step="0.1"
                  value={formData.totalVolume}
                  readOnly
                  placeholder="Auto-calculated"
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="applicationMethod">Application Method</Label>
                <Select value={formData.applicationMethod} onValueChange={(value) => handleInputChange('applicationMethod', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {applicationMethods.map(method => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Weather Conditions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Weather Conditions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="weatherConditions">Weather Conditions</Label>
                <Select value={formData.weatherConditions} onValueChange={(value) => handleInputChange('weatherConditions', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select conditions" />
                  </SelectTrigger>
                  <SelectContent>
                    {weatherConditions.map(condition => (
                      <SelectItem key={condition} value={condition}>{condition}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="temperature">Temperature (°C)</Label>
                <Input
                  id="temperature"
                  type="number"
                  value={formData.temperature}
                  onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                  placeholder="e.g., 18"
                  className={errors.temperature ? 'border-red-500' : ''}
                />
                {errors.temperature && <p className="text-sm text-red-500">{errors.temperature}</p>}
              </div>
              <div>
                <Label htmlFor="windSpeed">Wind Speed (km/h)</Label>
                <Input
                  id="windSpeed"
                  type="number"
                  value={formData.windSpeed}
                  onChange={(e) => handleInputChange('windSpeed', parseFloat(e.target.value))}
                  placeholder="e.g., 8"
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
          </div>

          {/* Compliance & Safety */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Compliance & Safety</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="withholdingPeriod">Withholding Period (days)</Label>
                <Input
                  id="withholdingPeriod"
                  type="number"
                  value={formData.withholdingPeriod}
                  readOnly
                  placeholder="Auto-populated"
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="reentryPeriod">Re-entry Period (hours)</Label>
                <Input
                  id="reentryPeriod"
                  type="number"
                  value={formData.reentryPeriod}
                  readOnly
                  placeholder="Auto-populated"
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="harvestDate">Safe Harvest Date</Label>
                <Input
                  id="harvestDate"
                  type="date"
                  value={formData.harvestDate}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="grazingDate">Safe Grazing Date</Label>
                <Input
                  id="grazingDate"
                  type="date"
                  value={formData.grazingDate}
                  readOnly
                  className="bg-gray-50"
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
