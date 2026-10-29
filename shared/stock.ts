// Stock classes and movement types used by stock reconciliation

export const STOCK_CLASSES = [
  "Milking cows",
  "Dry cows",
  "R2 heifers",
  "R1 heifer calves",
  "Bull calves",
  "Bulls",
  "Steers",
  "Other",
];

export const STOCK_IN_TYPES = ["purchase", "transfer_in", "birth"] as const;
export const STOCK_OUT_TYPES = ["sale", "transfer_out", "death"] as const;
export const STOCK_MOVEMENT_TYPES = [...STOCK_IN_TYPES, ...STOCK_OUT_TYPES, "adjustment"] as const;
export type StockMovementType = typeof STOCK_MOVEMENT_TYPES[number];

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  purchase: "Bought in",
  transfer_in: "Arrived (grazing / transfer)",
  birth: "Born",
  sale: "Sold",
  transfer_out: "Left (grazing / transfer)",
  death: "Died",
  adjustment: "Adjustment",
};

// Movements between farms need an Animal Status Declaration
export const ASD_TYPES: StockMovementType[] = ["purchase", "transfer_in", "sale", "transfer_out"];
