import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Sprout, 
  Calculator, 
  MapPin, 
  Calendar as CalendarIcon, 
  Save, 
  Send,
  AlertTriangle,
  CheckCircle,
  Info,
  FileText
} from 'lucide-react';

interface FertilizerRecord {
  // Basic Information
  applicationDate: string;
  operatorName: string;
  supervisorName: string;
  
  // Location Details
  paddockId: string;
  paddockName: string;
  area: number; // hectares
  soilType: string;
  
  // Fertilizer Details
  productName: string;
  brand: string;
  nkp: string; // N-P-K values
  nitrogenRate: number; // kg N/ha
  phosphorusRate: number; // kg P/ha
  potassiumRate: number; // kg K/ha
  sulfurRate: number; // kg S/ha
  totalApplicationRate: number; // kg/ha
  
  // Application Details
  applicationMethod: string;
  equipmentUsed: string;
  weatherConditions: string;
  soilMoisture: string;
  incorporationMethod: string;
  
  // Compliance & Documentation
  nutrientBudgetReference: string;
  overseerReportId: string;
  regionalCouncilPermit: string;
  withholdingPeriod: number;
  nextGrazingDate: string;
  
  // Environmental Considerations
  distanceToWaterway: number;
  bufferZone: boolean;
  soilTestDate: string;
  soilTestResults: string;
  
  // Regulatory Compliance
  fonterraCompliance: boolean;
  synlaitCompliance: boolean;
  asureQualityCompliance: boolean;
  nzgapCompliance: boolean;
  
  // Documentation
  notes: string;
  photos: string[];
  witnessName: string;
}

export default function FertilizerApplicationForm() {
  const [formData, setFormData] = useState<Partial<FertilizerRecord>>({
    applicationDate: new Date().toISOString().split('T')[0],
    operatorName: '',
    supervisorName: '',
    paddockId: '',
    paddockName: '',
    area: 0,
    soilType: '',
    productName: '',
    brand: '',
    nkp: '',
    nitrogenRate: 0,
    phosphorusRate: 0,
    potassiumRate: 0,
    sulfurRate: 0,
    totalApplicationRate: 0,
    applicationMethod: '',
    equipmentUsed: '',
    weatherConditions: '',
    soilMoisture: '',
    incorporationMethod: '',
    nutrientBudgetReference: '',
    overseerReportId: '',
    regionalCouncilPermit: '',
    withholdingPeriod: 0,
    nextGrazingDate: '',
    distanceToWaterway: 0,
    bufferZone: false,
    soilTestDate: '',
    soilTestResults: '',
    fonterraCompliance: true,
    synlaitCompliance: true,
    asureQualityCompliance: true,
    nzgapCompliance: true,
    notes: '',
    photos: [],
    witnessName: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const soilTypes = [
    'Sandy Loam', 'Clay Loam', 'Silt Loam', 'Peat', 'Sandy', 'Clay', 'Loam'
  ];

  const applicationMethods = [
    'Broadcast Spreader', 'Air Spreader', 'Drop Spreader', 'Liquid Applicator', 'Side Dress', 'Band Application'
  ];

  const weatherConditions = [
    'Clear', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Windy', 'Calm'
  ];

  const soilMoistureLevels = [
    'Very Dry', 'Dry', 'Moist', 'Wet', 'Very Wet'
  ];

  const incorporationMethods = [
    'No Incorporation', 'Light Harrow', 'Deep Cultivation', 'Roller', 'Irrigation'
  ];

  // Predefined fertilizer products with NKP values
  const fertilizerProducts = [
    { name: 'Urea', brand: 'Various', nkp: '46-0-0', nitrogen: 46, phosphorus: 0, potassium: 0 },
    { name: 'Superphosphate', brand: 'Various', nkp: '0-8-0', nitrogen: 0, phosphorus: 8, potassium: 0 },
    { name: 'Muriate of Potash', brand: 'Various', nkp: '0-0-60', nitrogen: 0, phosphorus: 0, potassium: 60 },
    { name: 'DAP', brand: 'Various', nkp: '18-46-0', nitrogen: 18, phosphorus: 46, potassium: 0 },
    { name: 'NPK Blend', brand: 'Various', nkp: '20-10-10', nitrogen: 20, phosphorus: 10, potassium: 10 },
    { name: 'Calcium Ammonium Nitrate', brand: 'Various', nkp: '27-0-0', nitrogen: 27, phosphorus: 0, potassium: 0 },
    { name: 'Sulphate of Ammonia', brand: 'Various', nkp: '21-0-0-24', nitrogen: 21, phosphorus: 0, potassium: 0, sulfur: 24 },
    { name: 'Gypsum', brand: 'Various', nkp: '0-0-0-18', nitrogen: 0, phosphorus: 0, potassium: 0, sulfur: 18 }
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleProductSelect = (productName: string) => {
    const product = fertilizerProducts.find(p => p.name === productName);
    if (product) {
      setFormData(prev => ({
        ...prev,
        productName: product.name,
        nkp: product.nkp,
        nitrogenRate: product.nitrogen,
        phosphorusRate: product.phosphorus,
        potassiumRate: product.potassium,
        sulfurRate: product.sulfur || 0
      }));
      calculateTotalApplicationRate(product.nitrogen, product.phosphorus, product.potassium, product.sulfur || 0);
    }
  };

  const calculateTotalApplicationRate = (n: number, p: number, k: number, s: number = 0) => {
    const total = n + p + k + s;
    setFormData(prev => ({ ...prev, totalApplicationRate: total }));
  };

  const calculateNextGrazingDate = () => {
    if (formData.applicationDate && formData.withholdingPeriod) {
      const nextDate = new Date(formData.applicationDate);
      nextDate.setDate(nextDate.getDate() + formData.withholdingPeriod);
      setFormData(prev => ({ 
        ...prev, 
        nextGrazingDate: nextDate.toISOString().split('T')[0] 
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
    if (!formData.productName) newErrors.productName = 'Fertilizer product is required';
    if (!formData.applicationMethod) newErrors.applicationMethod = 'Application method is required';
    
    // Compliance validations
    if (formData.distanceToWaterway && formData.distanceToWaterway < 50) {
      newErrors.distanceToWaterway = 'Distance to waterway must be at least 50m';
    }
    
    if (!formData.bufferZone) {
      newErrors.bufferZone = 'Buffer zone must be established near waterways';
    }
    
    // Nutrient rate validations (typical ranges)
    if (formData.nitrogenRate && (formData.nitrogenRate < 0 || formData.nitrogenRate > 300)) {
      newErrors.nitrogenRate = 'Nitrogen rate outside recommended range (0-300 kg/ha)';
    }
    
    if (formData.totalApplicationRate && formData.totalApplicationRate > 500) {
      newErrors.totalApplicationRate = 'Total application rate exceeds recommended limit (500 kg/ha)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (action: 'save' | 'submit') => {
    if (!validateForm()) {
      return;
    }
    
    console.log('Fertilizer record submitted:', { formData, action });
    
    if (action === 'submit') {
      alert('Fertilizer application record submitted successfully!');
    } else {
      alert('Fertilizer application record saved as draft!');
    }
  };

  const getComplianceStatus = () => {
    const issues = [];
    
    if (formData.distanceToWaterway && formData.distanceToWaterway < 100) issues.push('Close to waterway');
    if (!formData.bufferZone) issues.push('No buffer zone established');
    if (formData.totalApplicationRate && formData.totalApplicationRate > 400) issues.push('High application rate');
    if (!formData.soilTestDate) issues.push('No recent soil test');
    if (!formData.nutrientBudgetReference) issues.push('No nutrient budget reference');
    
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
              <Badge className="bg-orange-100 text-orange-800">Regional Council</Badge>
              <Badge className="bg-purple-100 text-purple-800">Fonterra</Badge>
              <Badge className="bg-green-100 text-green-800">Synlait</Badge>
              <Badge className="bg-blue-100 text-blue-800">AsureQuality</Badge>
              <Badge className="bg-teal-100 text-teal-800">NZGAP</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Info className="h-4 w-4" />
              <span>Nutrient budget compliance for all major processors</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-green-600" />
            Fertilizer Application Record
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
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
                  placeholder="Name of person applying fertilizer"
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

          {/* Fertilizer Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Fertilizer Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="productName">Fertilizer Product *</Label>
                <Select value={formData.productName} onValueChange={handleProductSelect}>
                  <SelectTrigger className={errors.productName ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {fertilizerProducts.map(product => (
                      <SelectItem key={product.name} value={product.name}>
                        {product.name} ({product.nkp})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.productName && <p className="text-sm text-red-500">{errors.productName}</p>}
              </div>
              <div>
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => handleInputChange('brand', e.target.value)}
                  placeholder="e.g., Ballance, Ravensdown"
                />
              </div>
              <div>
                <Label htmlFor="totalApplicationRate">Total Rate (kg/ha)</Label>
                <Input
                  id="totalApplicationRate"
                  type="number"
                  value={formData.totalApplicationRate}
                  readOnly
                  placeholder="Auto-calculated"
                  className="bg-gray-50"
                />
              </div>
            </div>
            
            {/* Nutrient Rates */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="nitrogenRate">Nitrogen (kg N/ha)</Label>
                <Input
                  id="nitrogenRate"
                  type="number"
                  value={formData.nitrogenRate}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="phosphorusRate">Phosphorus (kg P/ha)</Label>
                <Input
                  id="phosphorusRate"
                  type="number"
                  value={formData.phosphorusRate}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="potassiumRate">Potassium (kg K/ha)</Label>
                <Input
                  id="potassiumRate"
                  type="number"
                  value={formData.potassiumRate}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="sulfurRate">Sulfur (kg S/ha)</Label>
                <Input
                  id="sulfurRate"
                  type="number"
                  value={formData.sulfurRate}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Application Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Application Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div>
                <Label htmlFor="equipmentUsed">Equipment Used</Label>
                <Input
                  id="equipmentUsed"
                  value={formData.equipmentUsed}
                  onChange={(e) => handleInputChange('equipmentUsed', e.target.value)}
                  placeholder="e.g., John Deere Spreader, Truck-mounted"
                />
              </div>
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
                <Label htmlFor="incorporationMethod">Incorporation Method</Label>
                <Select value={formData.incorporationMethod} onValueChange={(value) => handleInputChange('incorporationMethod', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {incorporationMethods.map(method => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Environmental Compliance */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Environmental Compliance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="distanceToWaterway">Distance to Waterway (m)</Label>
                <Input
                  id="distanceToWaterway"
                  type="number"
                  value={formData.distanceToWaterway}
                  onChange={(e) => handleInputChange('distanceToWaterway', parseFloat(e.target.value))}
                  placeholder="e.g., 100"
                  className={errors.distanceToWaterway ? 'border-red-500' : ''}
                />
                {errors.distanceToWaterway && <p className="text-sm text-red-500">{errors.distanceToWaterway}</p>}
              </div>
              <div>
                <Label htmlFor="soilTestDate">Last Soil Test Date</Label>
                <Input
                  id="soilTestDate"
                  type="date"
                  value={formData.soilTestDate}
                  onChange={(e) => handleInputChange('soilTestDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="withholdingPeriod">Grazing Withholding (days)</Label>
                <Input
                  id="withholdingPeriod"
                  type="number"
                  value={formData.withholdingPeriod}
                  onChange={(e) => handleInputChange('withholdingPeriod', parseInt(e.target.value))}
                  placeholder="e.g., 21"
                />
              </div>
              <div>
                <Label htmlFor="nextGrazingDate">Next Grazing Date</Label>
                <div className="flex gap-2">
                  <Input
                    id="nextGrazingDate"
                    type="date"
                    value={formData.nextGrazingDate}
                    readOnly
                    className="bg-gray-50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={calculateNextGrazingDate}
                    disabled={!formData.applicationDate || !formData.withholdingPeriod}
                  >
                    Calculate
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bufferZone"
                  checked={formData.bufferZone}
                  onCheckedChange={(checked) => handleInputChange('bufferZone', checked)}
                />
                <Label htmlFor="bufferZone" className="text-sm">Buffer zone established around waterways</Label>
              </div>
              {errors.bufferZone && <p className="text-sm text-red-500 ml-6">{errors.bufferZone}</p>}
            </div>
          </div>

          {/* Compliance Documentation */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Compliance Documentation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nutrientBudgetReference">Nutrient Budget Reference</Label>
                <Input
                  id="nutrientBudgetReference"
                  value={formData.nutrientBudgetReference}
                  onChange={(e) => handleInputChange('nutrientBudgetReference', e.target.value)}
                  placeholder="e.g., Overseer Report #2024-001"
                />
              </div>
              <div>
                <Label htmlFor="overseerReportId">Overseer Report ID</Label>
                <Input
                  id="overseerReportId"
                  value={formData.overseerReportId}
                  onChange={(e) => handleInputChange('overseerReportId', e.target.value)}
                  placeholder="Overseer report reference"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Regulatory Compliance Declarations</Label>
              <div className="grid grid-cols-2 gap-2">
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
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="nzgap"
                    checked={formData.nzgapCompliance}
                    onCheckedChange={(checked) => handleInputChange('nzgapCompliance', checked)}
                  />
                  <Label htmlFor="nzgap" className="text-sm">NZGAP compliance</Label>
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
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
