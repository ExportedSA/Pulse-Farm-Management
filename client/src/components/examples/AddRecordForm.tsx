import AddRecordForm from "../AddRecordForm";
import { uid } from "@/lib/utils";

const mockProducts = [
  { id: uid(), name: "Metacam 100 ml", withdrawalDays: 10 },
  { id: uid(), name: "Penicillin LA 250 ml", withdrawalDays: 4, barcode: "12345" },
  { id: uid(), name: "Oxytetracycline LA 100 ml", withdrawalDays: 7 },
];

const mockUsers = [
  { id: uid(), name: "Mark" },
  { id: uid(), name: "Bella" },
  { id: uid(), name: "Staff" },
];

export default function AddRecordFormExample() {
  return (
    <div className="p-8 max-w-4xl">
      <AddRecordForm
        products={mockProducts}
        users={mockUsers}
        onAdd={(record) => console.log("Record added:", record)}
        onScan={() => console.log("Scan triggered")}
        onSaveBarcode={(productName, batchNo) =>
          console.log("Save barcode mapping:", productName, batchNo)
        }
      />
    </div>
  );
}
