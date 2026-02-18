-- Function to get database size in MB
CREATE OR REPLACE FUNCTION get_database_size()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  db_size bigint;
BEGIN
  -- Get size of the current database
  SELECT pg_database_size(current_database()) INTO db_size;
  
  -- Convert to MB
  RETURN (db_size / 1024 / 1024);
END;
$$;

GRANT EXECUTE ON FUNCTION get_database_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_size() TO service_role;
