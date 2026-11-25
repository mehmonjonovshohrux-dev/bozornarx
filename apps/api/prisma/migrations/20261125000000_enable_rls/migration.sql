-- Security hardening: Supabase exposes every table of the "public" schema over its REST API. Without Row-Level Security anyone holding
-- the project's public (anon) key could read or change data. Enabling RLS with NO policies denies all REST access to those roles.
-- BozorNarx itself talks to the database through Prisma as the table owner, which is not affected by RLS (we do not use FORCE).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
