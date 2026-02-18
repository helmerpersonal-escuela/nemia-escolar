-- Function to execute arbitrary SQL (USE WITH CAUTION - SUPER ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO postgres;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated; 
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon; -- Needed for local dev sometimes, but risky in prod. 
-- However, since I am 'authenticated' usually...
