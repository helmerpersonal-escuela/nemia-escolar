-- TEMP MIGRATION: DISABLE RLS FOR CONFIGURATION
-- This allows any user (including anon) to view/edit system settings and users.
-- WARNING: RUN THIS ON LOCALHOST ONLY. REVERT BEFORE PRODUCTION.

-- 1. System Settings (Public Access)
DROP POLICY IF EXISTS "SuperAdmins can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "SuperAdmins can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "SuperAdmins can insert system settings" ON public.system_settings;

DROP POLICY IF EXISTS "Public can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public can insert system settings" ON public.system_settings;

CREATE POLICY "Public can view system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Public can update system settings" ON public.system_settings FOR UPDATE USING (true);
CREATE POLICY "Public can insert system settings" ON public.system_settings FOR INSERT WITH CHECK (true);

-- 2. Payment Transactions (Public Access)
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payment_transactions;
DROP POLICY IF EXISTS "SuperAdmins can view all payments" ON public.payment_transactions;

DROP POLICY IF EXISTS "Public can view payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Public can insert payment_transactions" ON public.payment_transactions;

CREATE POLICY "Public can view payment_transactions" ON public.payment_transactions FOR SELECT USING (true);
CREATE POLICY "Public can insert payment_transactions" ON public.payment_transactions FOR INSERT WITH CHECK (true);

-- 3. Licenses (Public Access)
DROP POLICY IF EXISTS "Tenants can view their active license" ON public.licenses;
DROP POLICY IF EXISTS "SuperAdmins can manage licenses" ON public.licenses;

DROP POLICY IF EXISTS "Public can view licenses" ON public.licenses;
DROP POLICY IF EXISTS "Public can insert licenses" ON public.licenses;

CREATE POLICY "Public can view licenses" ON public.licenses FOR SELECT USING (true);
CREATE POLICY "Public can insert licenses" ON public.licenses FOR INSERT WITH CHECK (true);

-- 4. Tenants & Profiles (Public Read Access to visualize dashboard)
DROP POLICY IF EXISTS "Public can view tenants" ON public.tenants;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;

CREATE POLICY "Public can view tenants" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);

-- 5. Enable Soft Delete/Restore for Public (for testing)
-- Note: RPC functions are SECURITY DEFINER so they might already bypass RLS if logic allows it.
-- But we ensure we can see the data.
