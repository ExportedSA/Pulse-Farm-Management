import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let codeReader: any;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        codeReader = new BrowserMultiFormatReader();
        const video = videoRef.current!;
        const controls = await codeReader.decodeFromVideoDevice(
          undefined,
          video,
          (result: any, err: any) => {
            if (!active) return;
            if (result) {
              onDetected(result.getText());
              setTimeout(() => onClose(), 300);
            } else if (err) {
              console.warn(err);
            }
          }
        );
        return () => controls?.stop();
      } catch (e: any) {
        console.error(e);
        setError("Camera/barcode not available. You can type or use a USB scanner.");
      }
    })();

    return () => {
      active = false;
      try {
        codeReader?.reset?.();
      } catch {}
    };
  }, [onDetected, onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" data-testid="modal-barcode-scanner">
      <div className="bg-card border border-card-border rounded-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" data-testid="text-scanner-title">Scan Barcode</h3>
          <Button variant="ghost" onClick={onClose} data-testid="button-close-scanner">
            Close
          </Button>
        </div>
        {error ? (
          <div className="text-sm text-destructive p-4 bg-destructive/10 rounded-lg" data-testid="text-scanner-error">
            {error}
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden aspect-video bg-black" data-testid="video-camera-feed">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          </div>
        )}
        <p className="text-xs text-muted-foreground" data-testid="text-scanner-tip">
          Tip: USB barcode scanners (keyboard emulation) also work — focus a field and scan.
        </p>
      </div>
    </div>
  );
}
