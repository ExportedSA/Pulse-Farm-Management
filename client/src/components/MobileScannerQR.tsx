import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { QrCode, Smartphone, Wifi, WifiOff, Package, ChevronDown, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

interface MobileScannerQRProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeReceived: (barcode: string) => void;
}

export default function MobileScannerQR({ isOpen, onClose, onBarcodeReceived }: MobileScannerQRProps) {
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15));
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [receivedBarcodes, setReceivedBarcodes] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Generate QR code
  useEffect(() => {
    if (!isOpen) return;

    const baseUrl = window.location.origin;
    const scannerUrl = `${baseUrl}/app/mobile-scanner?session=${sessionId}`;
    
    QRCode.toDataURL(scannerUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrDataUrl).catch(console.error);
  }, [isOpen, sessionId]);

  // Connect to WebSocket as host
  useEffect(() => {
    if (!isOpen) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/scanner?session=${sessionId}&role=host`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Scanner WebSocket connected as host');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'client_connected') {
          setConnected(true);
          toast.success('Phone connected!');
        } else if (data.type === 'client_disconnected') {
          setConnected(false);
          toast.info('Phone disconnected');
        } else if (data.type === 'barcode') {
          const barcode = data.barcode;
          setReceivedBarcodes(prev => [barcode, ...prev.slice(0, 9)]);
          onBarcodeReceived(barcode);
          toast.success(`Received: ${barcode}`);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [isOpen, sessionId, onBarcodeReceived]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      setConnected(false);
      setReceivedBarcodes([]);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile Barcode Scanner
          </DialogTitle>
          <DialogDescription>
            Scan this QR code with your phone to use it as a barcode scanner
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-4">
          {/* Connection Status */}
          <Badge variant={connected ? "default" : "secondary"} className="flex items-center gap-1">
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? "Phone Connected" : "Waiting for phone..."}
          </Badge>

          {/* QR Code */}
          {qrDataUrl ? (
            <div className="p-4 bg-white rounded-lg shadow-inner">
              <img src={qrDataUrl} alt="Scan with phone" className="w-64 h-64" />
            </div>
          ) : (
            <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
              <QrCode className="h-16 w-16 text-gray-400 animate-pulse" />
            </div>
          )}

          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Open your phone's camera and point it at this QR code, or scan it with any QR reader app
          </p>

          {/* Collapsible Instructions */}
          <Collapsible className="w-full">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
                <HelpCircle className="h-4 w-4" />
                How to use
                <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
                <div>
                  <p className="font-medium mb-1">1. Scan the QR Code</p>
                  <p className="text-muted-foreground">Use your phone's camera app or any QR scanner to scan the code above. This will open a scanner page on your phone.</p>
                </div>
                <div>
                  <p className="font-medium mb-1">2. Connect Your Phone</p>
                  <p className="text-muted-foreground">Once the page loads, your phone will automatically connect. You'll see "Phone Connected" above when ready.</p>
                </div>
                <div>
                  <p className="font-medium mb-1">3. Scan Medicine Barcodes</p>
                  <p className="text-muted-foreground">Use your phone's camera to scan product barcodes. They'll appear here instantly and you can add them to inventory.</p>
                </div>
                <div>
                  <p className="font-medium mb-1">4. Manual Entry</p>
                  <p className="text-muted-foreground">If the camera won't scan, you can also type barcodes manually on your phone.</p>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    <strong>Note:</strong> Both devices must be on the same network. The connection is secure and temporary - it ends when you close this dialog.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Received Barcodes */}
          {receivedBarcodes.length > 0 && (
            <div className="w-full">
              <p className="text-sm font-medium mb-2">Recently Received:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {receivedBarcodes.map((barcode, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-green-50 rounded text-sm">
                    <Package className="h-4 w-4 text-green-600" />
                    <span className="font-mono">{barcode}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
