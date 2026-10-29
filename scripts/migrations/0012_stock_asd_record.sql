-- Each stock movement points at the Document record holding its ASD photo
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS record_id uuid REFERENCES farm_records(id);
