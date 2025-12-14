import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Scan, Send, CheckCircle2, Wifi, WifiOff, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ScannedItem {
  barcode: string;
  timestamp: Date;
  sent: boolean;
}

export default function MobileScanner() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [manualBarcode, setManualBarcode] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Get session ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');
    if (sid) {
      setSessionId(sid);
    }
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/scanner?session=${sessionId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      toast.success('Connected to desktop');
    };

    ws.onclose = () => {
      setConnected(false);
      toast.error('Disconnected from desktop');
    };

    ws.onerror = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  // Send barcode to desktop
  const sendBarcode = (barcode: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to desktop');
      return;
    }

    wsRef.current.send(JSON.stringify({ type: 'barcode', barcode }));
    
    setScannedItems(prev => [
      { barcode, timestamp: new Date(), sent: true },
      ...prev
    ]);
    
    toast.success(`Sent: ${barcode}`);
  };

  // Start camera scanning
  const startScanning = async () => {
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const codeReader = new BrowserMultiFormatReader();
      
      setScanning(true);
      
      await codeReader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result, err) => {
          if (result) {
            const barcode = result.getText();
            sendBarcode(barcode);
            // Brief pause after successful scan
            setTimeout(() => {}, 500);
          }
        }
      );
    } catch (e) {
      console.error(e);
      toast.error('Camera not available');
      setScanning(false);
    }
  };

  // Handle manual entry
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      sendBarcode(manualBarcode.trim());
      setManualBarcode("");
    }
  };

  // No session ID - show error
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Invalid Scanner Link</h2>
            <p className="text-muted-foreground">
              Please scan the QR code from the Pulse desktop app to connect.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Scan className="h-5 w-5" />
                Mobile Scanner
              </CardTitle>
              <Badge variant={connected ? "default" : "destructive"} className="flex items-center gap-1">
                {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Camera Scanner */}
        <Card>
          <CardContent className="p-4">
            {scanning ? (
              <div className="space-y-3">
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Point camera at barcode
                </p>
              </div>
            ) : (
              <Button 
                onClick={startScanning} 
                className="w-full h-32 text-lg"
                disabled={!connected}
              >
                <Scan className="h-8 w-8 mr-3" />
                Start Camera Scanner
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <Input
                placeholder="Enter barcode manually..."
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={!connected || !manualBarcode.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Scanned Items */}
        {scannedItems.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Recently Scanned</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setScannedItems([])}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {scannedItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                    <span className="font-mono">{item.barcode}</span>
                    {item.sent && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
