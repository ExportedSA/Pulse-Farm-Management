import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  QrCode, 
  Download, 
  Copy, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff,
  Calendar,
  MapPin,
  Building,
  Users,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';

interface QRCodeData {
  id: string;
  code: string;
  locationName: string;
  farmName: string;
  description: string | null;
  maxUsage: number | null;
  expiresAt: string | null;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
}

interface QRCodeGeneratorProps {
  onQRCodeCreated?: (qrCode: QRCodeData) => void;
  farmName?: string;
}

export default function QRCodeGenerator({ onQRCodeCreated, farmName = "Pulse Farm" }: QRCodeGeneratorProps) {
  const [qrCodes, setQRCodes] = useState<QRCodeData[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    locationName: '',
    description: '',
    maxUsage: '',
    expiresAt: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch existing QR codes
  const fetchQRCodes = async () => {
    try {
      const response = await fetch('/api/visitor/admin/qrcodes');
      if (response.ok) {
        const data = await response.json();
        setQRCodes(data.qrCodes || []);
      }
    } catch (error) {
      console.error('Error fetching QR codes:', error);
    }
  };

  useEffect(() => {
    fetchQRCodes();
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.locationName.trim()) {
      newErrors.locationName = 'Location name is required';
    }
    
    if (formData.maxUsage && (isNaN(Number(formData.maxUsage)) || Number(formData.maxUsage) <= 0)) {
      newErrors.maxUsage = 'Max usage must be a positive number';
    }
    
    if (formData.expiresAt && new Date(formData.expiresAt) <= new Date()) {
      newErrors.expiresAt = 'Expiry date must be in the future';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateQRCode = async () => {
    if (!validateForm()) return;
    
    setIsCreating(true);
    try {
      const payload = {
        locationName: formData.locationName,
        farmName: farmName,
        description: formData.description || undefined,
        maxUsage: formData.maxUsage ? Number(formData.maxUsage) : undefined,
        expiresAt: formData.expiresAt || undefined,
      };
      
      const response = await fetch('/api/visitor/admin/qrcodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        const data = await response.json();
        const newQRCode = data.qrCode;
        setQRCodes(prev => [newQRCode, ...prev]);
        setFormData({ locationName: '', description: '', maxUsage: '', expiresAt: '' });
        setShowCreateForm(false);
        onQRCodeCreated?.(newQRCode);
      } else {
        const errorData = await response.json();
        setErrors({ submit: errorData.error || 'Failed to create QR code' });
      }
    } catch (error) {
      console.error('Error creating QR code:', error);
      setErrors({ submit: 'Failed to create QR code' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeactivateQRCode = async (id: string) => {
    try {
      const response = await fetch(`/api/visitor/admin/qrcodes/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setQRCodes(prev => prev.map(qr => 
          qr.id === id ? { ...qr, isActive: false } : qr
        ));
      }
    } catch (error) {
      console.error('Error deactivating QR code:', error);
    }
  };

  const copyToClipboard = async (text: string, code: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const downloadQRCode = (qrCode: QRCodeData) => {
    const svgElement = document.getElementById(`qr-${qrCode.id}`);
    if (!svgElement) return;
    
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `qr-${qrCode.code}-${qrCode.locationName}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const getVisitorPortalURL = (code: string) => {
    return `${window.location.origin}/visitor-signin/${code}`;
  };

  const getQRCodeStatus = (qrCode: QRCodeData) => {
    if (!qrCode.isActive) return { status: 'inactive', color: 'gray', text: 'Inactive' };
    if (qrCode.expiresAt && new Date(qrCode.expiresAt) < new Date()) {
      return { status: 'expired', color: 'red', text: 'Expired' };
    }
    if (qrCode.maxUsage && qrCode.usageCount >= qrCode.maxUsage) {
      return { status: 'limit-reached', color: 'orange', text: 'Limit Reached' };
    }
    return { status: 'active', color: 'green', text: 'Active' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Visitor QR Codes</h2>
          <p className="text-gray-600">Generate QR codes for visitor sign-in access points</p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create QR Code
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="locationName">Location Name *</Label>
                <Input
                  id="locationName"
                  value={formData.locationName}
                  onChange={(e) => setFormData(prev => ({ ...prev, locationName: e.target.value }))}
                  placeholder="e.g., Main Entrance, Shed 1, Office"
                  className={errors.locationName ? 'border-red-500' : ''}
                />
                {errors.locationName && <p className="text-sm text-red-500 mt-1">{errors.locationName}</p>}
              </div>
              
              <div>
                <Label htmlFor="maxUsage">Max Usage (optional)</Label>
                <Input
                  id="maxUsage"
                  type="number"
                  value={formData.maxUsage}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxUsage: e.target.value }))}
                  placeholder="e.g., 100"
                  className={errors.maxUsage ? 'border-red-500' : ''}
                />
                {errors.maxUsage && <p className="text-sm text-red-500 mt-1">{errors.maxUsage}</p>}
              </div>
            </div>
            
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional information about this location"
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="expiresAt">Expires At (optional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                className={errors.expiresAt ? 'border-red-500' : ''}
              />
              {errors.expiresAt && <p className="text-sm text-red-500 mt-1">{errors.expiresAt}</p>}
            </div>
            
            {errors.submit && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{errors.submit}</AlertDescription>
              </Alert>
            )}
            
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateForm(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateQRCode}
                disabled={isCreating}
                className="bg-green-600 hover:bg-green-700"
              >
                {isCreating ? 'Creating...' : 'Create QR Code'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Codes List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {qrCodes.map((qrCode) => {
          const status = getQRCodeStatus(qrCode);
          const visitorURL = getVisitorPortalURL(qrCode.code);
          
          return (
            <Card key={qrCode.id} className={`${!qrCode.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-lg border">
                      <QRCodeSVG
                        id={`qr-${qrCode.id}`}
                        value={visitorURL}
                        size={150}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                  </div>
                  
                  {/* Info */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{qrCode.locationName}</h3>
                      <Badge 
                        variant="outline" 
                        className={`bg-${status.color}-50 text-${status.color}-800 border-${status.color}-200`}
                      >
                        {status.text}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <Building className="h-4 w-4 mr-1" />
                      {qrCode.farmName}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <QrCode className="h-4 w-4 mr-1" />
                      Code: {qrCode.code}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="h-4 w-4 mr-1" />
                      Usage: {qrCode.usageCount}
                      {qrCode.maxUsage && ` / ${qrCode.maxUsage}`}
                    </div>
                    
                    {qrCode.expiresAt && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-1" />
                        Expires: {format(new Date(qrCode.expiresAt), 'PPp')}
                      </div>
                    )}
                    
                    {qrCode.description && (
                      <p className="text-sm text-gray-600 italic">{qrCode.description}</p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(visitorURL, qrCode.code)}
                        className="flex-1"
                      >
                        {copiedCode === qrCode.code ? (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        {copiedCode === qrCode.code ? 'Copied!' : 'Copy URL'}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadQRCode(qrCode)}
                        disabled={!qrCode.isActive}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {qrCode.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeactivateQRCode(qrCode.id)}
                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <EyeOff className="h-4 w-4 mr-1" />
                        Deactivate
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {qrCodes.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No QR Codes Yet</h3>
            <p className="text-gray-600 mb-4">
              Create your first QR code to enable visitor sign-in at your farm locations.
            </p>
            <Button 
              onClick={() => setShowCreateForm(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First QR Code
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
