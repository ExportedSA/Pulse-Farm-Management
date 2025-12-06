import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pen, RotateCcw, Download, Check } from 'lucide-react';

interface SignatureData {
  id: string;
  personName: string;
  signature: string;
  timestamp: string;
  ipAddress: string;
}

interface DigitalSignaturePadProps {
  title: string;
  signerName: string;
  onSignatureComplete: (signatureData: SignatureData) => void;
  onSave?: (signatureData: SignatureData) => void;
  required?: boolean;
}

export default function DigitalSignaturePad({ 
  title, 
  signerName, 
  onSignatureComplete, 
  onSave,
  required = false 
}: DigitalSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Set drawing style
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasSignature(true);
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    // Save signature data
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setSignatureData(dataUrl);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setHasSignature(false);
    setSignatureData('');
    setIsCompleted(false);
  };

  const completeSignature = () => {
    if (!hasSignature) return;

    const signatureInfo: SignatureData = {
      id: Date.now().toString(),
      personName: signerName,
      signature: signatureData,
      timestamp: new Date().toISOString(),
      ipAddress: '192.168.1.1' // In production, get actual IP
    };

    setSignatureData(signatureData);
    setIsCompleted(true);
    onSignatureComplete(signatureInfo);
    
    if (onSave) {
      onSave(signatureInfo);
    }
  };

  const downloadSignature = () => {
    if (!signatureData) return;

    const link = document.createElement('a');
    link.download = `signature_${signerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
    link.href = signatureData;
    link.click();
  };

  return (
    <Card className={`w-full ${isCompleted ? 'border-green-500 bg-green-50' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Pen className="h-5 w-5" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {required && <Badge variant="outline" className="text-red-600">Required</Badge>}
            {isCompleted && (
              <Badge className="bg-green-100 text-green-800">
                <Check className="h-3 w-3 mr-1" />
                Signed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Signatory: {signerName}</span>
            {hasSignature && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearSignature}
                className="text-red-600 hover:text-red-700"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
          
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-32 cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          
          {!hasSignature && (
            <p className="text-sm text-gray-500 text-center">
              Sign above using your mouse or touch screen
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {hasSignature && !isCompleted && (
            <Button
              onClick={completeSignature}
              className="bg-green-600 hover:bg-green-700 text-white flex-1"
            >
              <Check className="h-4 w-4 mr-2" />
              Complete Signature
            </Button>
          )}
          
          {isCompleted && (
            <Button
              variant="outline"
              onClick={downloadSignature}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Signature
            </Button>
          )}
        </div>

        {isCompleted && (
          <div className="text-sm text-green-700 bg-green-100 p-3 rounded">
            <strong>Digital Signature Recorded</strong><br />
            Signed by: {signerName}<br />
            Date: {new Date().toLocaleString()}<br />
            IP Address: 192.168.1.1
          </div>
        )}
      </CardContent>
    </Card>
  );
}
