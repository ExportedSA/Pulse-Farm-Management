import { useState } from "react";
import ProductManagement from "../ProductManagement";
import { uid } from "@/lib/utils";
import type { Product } from "@shared/schema";

export default function ProductManagementExample() {
  const [products, setProducts] = useState<Product[]>([
    { id: uid(), name: "Metacam 100 ml", withdrawalDays: 10 },
    { id: uid(), name: "Penicillin LA 250 ml", withdrawalDays: 4, barcode: "12345" },
  ]);

  return (
    <div className="p-8 max-w-4xl">
      <ProductManagement
        products={products}
        onAdd={(product) => {
          console.log("Add product:", product);
          setProducts((prev) => [...prev, { ...product, id: uid() }]);
        }}
        onRemove={(id) => {
          console.log("Remove product:", id);
          setProducts((prev) => prev.filter((p) => p.id !== id));
        }}
      />
    </div>
  );
}
