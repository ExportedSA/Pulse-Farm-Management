-- The farm guard checks every link from a farm's row to another farm-scoped row.
--
-- 0024 put the guard on the tables it scoped, with the links it listed. Tables that already had
-- farm_id (jobs, tasks, paddock outlines, map features, rosters, timesheets and others) and some
-- later links were left unchecked, so a request could, for example, point a paddock outline at
-- another farm's paddock if it knew the id. This rebuilds the guard on every farm table from its
-- foreign keys to other farm tables. (Every link the guard checked before is one of these.)
-- Links to a built-in row, which has no farm, are still allowed.

DO $$
DECLARE
  t record;
  l record;
  args text;
  bad int;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'farm_id' AND NOT a.attisdropped
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relname <> 'farm_members'
    ORDER BY c.relname
  LOOP
    args := '';
    FOR l IN
      SELECT p.relname AS parent, a.attname AS col
      FROM pg_constraint k
      JOIN pg_class p ON p.oid = k.confrelid
      JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
      JOIN pg_attribute pk ON pk.attrelid = k.confrelid AND pk.attnum = k.confkey[1]
      WHERE k.conrelid = t.oid AND k.contype = 'f' AND array_length(k.conkey, 1) = 1
        AND pk.attname = 'id' AND a.attname <> 'farm_id' AND p.relname <> 'farms'
        AND EXISTS (SELECT 1 FROM pg_attribute f WHERE f.attrelid = p.oid AND f.attname = 'farm_id' AND NOT f.attisdropped)
      ORDER BY p.relname, a.attname
    LOOP
      -- Rows that already cross farms would make every later edit of them fail
      EXECUTE format(
        'SELECT count(*) FROM %I c JOIN %I p ON p.id = c.%I WHERE c.farm_id <> p.farm_id',
        t.relname, l.parent, l.col) INTO bad;
      IF bad > 0 THEN
        RAISE EXCEPTION '% % rows link (%) to another farm''s %; fix them first', bad, t.relname, l.col, l.parent;
      END IF;
      args := args || CASE WHEN args = '' THEN '' ELSE ', ' END || quote_literal(l.parent) || ', ' || quote_literal(l.col);
    END LOOP;

    EXECUTE format('DROP TRIGGER IF EXISTS pulse_farm_guard ON %I', t.relname);
    EXECUTE format(
      'CREATE TRIGGER pulse_farm_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION pulse_farm_guard(%s)',
      t.relname, args);
  END LOOP;
END $$;
