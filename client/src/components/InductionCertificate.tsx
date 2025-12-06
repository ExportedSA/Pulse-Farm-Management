import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Award, 
  Download, 
  Mail, 
  Calendar,
  User,
  Shield,
  CheckCircle,
  FileText,
  Clock
} from 'lucide-react';

interface CertificateData {
  id: string;
  certificateNumber: string;
  personName: string;
  role: string;
  inductionType: 'new_worker' | 'contractor';
  completionDate: string;
  expiryDate: string;
  inductorName: string;
  farmName: string;
  sectionsCompleted: string[];
  signatureData: {
    inductee: string;
    inductor: string;
    timestamp: string;
  };
}

interface InductionCertificateProps {
  certificateData: CertificateData;
  onDownload?: () => void;
  onEmail?: () => void;
  showActions?: boolean;
}

export default function InductionCertificate({ 
  certificateData, 
  onDownload, 
  onEmail,
  showActions = true 
}: InductionCertificateProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateCertificatePDF = async () => {
    setIsGenerating(true);
    // In production, this would generate an actual PDF
    // For now, we'll simulate the download
    setTimeout(() => {
      setIsGenerating(false);
      if (onDownload) onDownload();
    }, 2000);
  };

  const sendCertificateEmail = async () => {
    setIsGenerating(true);
    // In production, this would send an email with the certificate
    setTimeout(() => {
      setIsGenerating(false);
      if (onEmail) onEmail();
    }, 1500);
  };

  const getDaysUntilExpiry = () => {
    const today = new Date();
    const expiry = new Date(certificateData.expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryStatus = () => {
    const daysUntilExpiry = getDaysUntilExpiry();
    if (daysUntilExpiry < 0) return { status: 'expired', color: 'red', text: 'Expired' };
    if (daysUntilExpiry <= 30) return { status: 'expiring', color: 'orange', text: `${daysUntilExpiry} days` };
    return { status: 'valid', color: 'green', text: `${daysUntilExpiry} days` };
  };

  const expiryStatus = getExpiryStatus();

  return (
    <div className="space-y-6">
      {/* Certificate Header */}
      <Card className="border-2 border-gray-300 bg-card">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center mb-4">
            <Award className="h-12 w-12 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            Farm Safety Induction Certificate
          </CardTitle>
          <p className="text-gray-600">
            WorkSafe NZ Compliant • {certificateData.farmName}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Certificate Number */}
          <div className="text-center">
            <Badge variant="outline" className="text-sm font-mono">
              Certificate No: {certificateData.certificateNumber}
            </Badge>
          </div>

          {/* Recipient Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-600" />
                <span className="font-semibold">Recipient:</span>
              </div>
              <p className="text-lg">{certificateData.personName}</p>
              <p className="text-gray-600">{certificateData.role}</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <span className="font-semibold">Dates:</span>
              </div>
              <p className="text-sm">
                <strong>Completed:</strong> {new Date(certificateData.completionDate).toLocaleDateString()}
              </p>
              <p className="text-sm">
                <strong>Expires:</strong> {new Date(certificateData.expiryDate).toLocaleDateString()}
              </p>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <Badge className={
                  expiryStatus.status === 'expired' ? 'bg-red-100 text-red-800' :
                  expiryStatus.status === 'expiring' ? 'bg-orange-100 text-orange-800' :
                  'bg-green-100 text-green-800'
                }>
                  {expiryStatus.text}
                </Badge>
              </div>
            </div>
          </div>

          {/* Induction Type and Sections */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-gray-600" />
              <span className="font-semibold">Induction Completed:</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Badge className={
                certificateData.inductionType === 'new_worker' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
              }>
                {certificateData.inductionType === 'new_worker' ? 'New Worker Induction' : 'Contractor Orientation'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {certificateData.sectionsCompleted.map((section, index) => (
                <div key={index} className="flex items-center gap-1 text-sm">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span>{section}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Signatures */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className="border-b-2 border-gray-400 mb-2 pb-8">
                  <img 
                    src={certificateData.signatureData.inductee} 
                    alt="Inductee Signature"
                    className="h-12 mx-auto"
                  />
                </div>
                <p className="text-sm font-medium">Inductee Signature</p>
                <p className="text-xs text-gray-600">{certificateData.personName}</p>
              </div>
              
              <div className="text-center">
                <div className="border-b-2 border-gray-400 mb-2 pb-8">
                  <img 
                    src={certificateData.signatureData.inductor} 
                    alt="Inductor Signature"
                    className="h-12 mx-auto"
                  />
                </div>
                <p className="text-sm font-medium">Inductor Signature</p>
                <p className="text-xs text-gray-600">{certificateData.inductorName}</p>
              </div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-4">
              Signed on {new Date(certificateData.signatureData.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Compliance Statement */}
          <div className="border-t pt-4">
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-700 text-center italic">
                "This certifies that the named individual has successfully completed all required 
                farm safety induction procedures in accordance with WorkSafe New Zealand guidelines 
                and is authorized to work on the premises."
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex gap-4 justify-center">
          <Button
            onClick={generateCertificatePDF}
            disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button
            variant="outline"
            onClick={sendCertificateEmail}
            disabled={isGenerating}
          >
            <Mail className="h-4 w-4 mr-2" />
            {isGenerating ? 'Sending...' : 'Email Certificate'}
          </Button>
        </div>
      )}

      {/* Certificate Footer */}
      <div className="text-center text-xs text-gray-500 border-t pt-4">
        <p>This certificate is valid for 12 months from the date of issue.</p>
        <p>For verification purposes, contact: {certificateData.farmName} • Certificate ID: {certificateData.certificateNumber}</p>
      </div>
    </div>
  );
}
