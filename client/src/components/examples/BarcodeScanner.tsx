import { useState } from "react";
import BarcodeScanner from "../BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

export default function BarcodeScannerExample() {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedCode, setScannedCode] = useState("");

  const handleDetected = (code: string) => {
    setScannedCode(code);
    console.log("Barcode detected:", code);
  };

  return (
    <div className="p-8">
      <div className="max-w-md mx-auto space-y-4">
        <Button onClick={() => setShowScanner(true)} data-testid="button-open-scanner">
          <Camera className="w-4 h-4 mr-2" />
          Open Scanner
        </Button>
        {scannedCode && (
          <div className="p-4 bg-primary/10 rounded-lg">
            <p className="text-sm font-medium">Last scanned:</p>
            <p className="font-mono text-lg">{scannedCode}</p>
          </div>
        )}
      </div>
      {showScanner && (
        <BarcodeScanner onDetected={handleDetected} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
