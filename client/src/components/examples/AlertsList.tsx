import AlertsList from "../AlertsList";
import { uid } from "@/lib/utils";

const mockProducts = [
  { id: uid(), name: "Metacam 100 ml", withdrawalDays: 10 },
  { id: uid(), name: "Penicillin LA 250 ml", withdrawalDays: 4 },
];

const mockRecords = [
  {
    id: uid(),
    productName: "Metacam 100 ml",
    batchNo: "BC123456",
    expiryDate: "2025-11-15",
    dateOpened: new Date().toISOString(),
  },
  {
    id: uid(),
    productName: "Penicillin LA 250 ml",
    batchNo: "BC789012",
    useByDate: "2025-11-18",
    dateOpened: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockSettings = {
  enabled: true,
  leadExpiryDays: 30,
  leadUseByDays: 30,
  dailySummaryHour: 7,
};

export default function AlertsListExample() {
  return (
    <div className="p-8 max-w-2xl">
      <AlertsList records={mockRecords} products={mockProducts} settings={mockSettings} />
    </div>
  );
}
