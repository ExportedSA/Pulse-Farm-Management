import { QrCode } from 'lucide-react';
import QRCodeGenerator from '@/components/QRCodeGenerator';
import { useFarm } from '@/lib/farm-context';

// The farm's visitor sign-in QR codes: print one at the gate, the shed or the office, and
// visitors scan it to sign in
export default function QRCodeManagementPage() {
  const { currentFarm } = useFarm();
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-pulse-forest/10 rounded-lg"><QrCode className="h-6 w-6 text-pulse-forest" /></div>
        <div>
          <h1 className="text-2xl font-bold">Visitor sign-in QR codes</h1>
          <p className="text-sm text-muted-foreground">Print a code for each place visitors arrive. Scanning it opens the sign-in for this farm.</p>
        </div>
      </div>
      <QRCodeGenerator farmName={currentFarm?.name ?? 'Farm'} />
    </div>
  );
}
