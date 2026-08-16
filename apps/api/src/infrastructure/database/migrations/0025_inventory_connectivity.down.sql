DROP TABLE IF EXISTS inventory_ledger;
DROP TABLE IF EXISTS inventory_sync_conflicts;
DROP TABLE IF EXISTS inventory_sync_runs;
DROP TABLE IF EXISTS external_reservations;
DROP TABLE IF EXISTS inventory_connection_mappings;
DROP TABLE IF EXISTS inventory_connections;
DROP TABLE IF EXISTS inventory_blocks;

ALTER TABLE bookable_units
  DROP COLUMN unit_label,
  DROP COLUMN time_slot_end,
  DROP COLUMN time_slot_start;
