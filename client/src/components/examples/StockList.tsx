import StockList from "../StockList";
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
    expiryDate: "2025-12-31",
    useByDate: "2025-11-15",
    dateOpened: new Date().toISOString(),
    openedBy: "Mark",
    notes: "Stored in fridge A",
  },
  {
    id: uid(),
    productName: "Penicillin LA 250 ml",
    batchNo: "BC789012",
    expiryDate: "2025-11-20",
    dateOpened: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    openedBy: "Bella",
  },
  {
    id: uid(),
    productName: "Oxytetracycline LA 100 ml",
    batchNo: "BC345678",
    expiryDate: "2024-10-01",
    dateOpened: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    emptiedDate: "2024-11-01",
    openedBy: "Staff",
  },
];

export default function StockListExample() {
  return (
    <div className="p-8 max-w-4xl">
      <StockList
        records={mockRecords}
        products={mockProducts}
        onMarkEmptied={(id) => console.log("Mark emptied:", id)}
        onRemove={(id) => console.log("Remove:", id)}
      />
    </div>
  );
}
