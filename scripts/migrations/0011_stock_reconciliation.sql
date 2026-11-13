-- Stock reconciliation: farm-scoped movements grouped by ASD, and stocktake counts per class
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES farms(id);
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS movement_id uuid;
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS stock_class varchar(50);
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS asd_number varchar(50);
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS other_party_nait varchar(50);
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS deleted_at timestamp;
CREATE INDEX IF NOT EXISTS stock_transactions_farm_date_idx ON stock_transactions (farm_id, date);
CREATE INDEX IF NOT EXISTS stock_transactions_movement_idx ON stock_transactions (movement_id);

CREATE TABLE IF NOT EXISTS stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  stock_class varchar(50) NOT NULL,
  count integer NOT NULL,
  counted_at date NOT NULL,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_counts_farm_class_idx ON stock_counts (farm_id, stock_class, counted_at);
