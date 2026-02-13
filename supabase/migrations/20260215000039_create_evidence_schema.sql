
-- Student Evidence Portfolio Table (Repair script)
CREATE TABLE IF NOT EXISTS evidence_portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT DEFAULT 'IMAGE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='evidence_portfolio' AND column_name='tenant_id') THEN
        ALTER TABLE evidence_portfolio ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='evidence_portfolio' AND column_name='teacher_id') THEN
        ALTER TABLE evidence_portfolio ADD COLUMN teacher_id UUID REFERENCES profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='evidence_portfolio' AND column_name='category') THEN
        ALTER TABLE evidence_portfolio ADD COLUMN category TEXT DEFAULT 'CLASSWORK';
    END IF;
END $$;

-- Enable RLS
ALTER TABLE evidence_portfolio ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own tenant evidence" ON evidence_portfolio;
DROP POLICY IF EXISTS "Teachers can insert evidence in their tenant" ON evidence_portfolio;
DROP POLICY IF EXISTS "Teachers can update/delete their own evidence" ON evidence_portfolio;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evidence_portfolio' AND policyname = 'Users can view their own tenant evidence'
    ) THEN
        CREATE POLICY "Users can view their own tenant evidence" ON evidence_portfolio FOR SELECT
    USING (tenant_id IN (SELECT id FROM tenants));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evidence_portfolio' AND policyname = 'Teachers can insert evidence in their tenant'
    ) THEN
        CREATE POLICY "Teachers can insert evidence in their tenant" ON evidence_portfolio FOR INSERT
    WITH CHECK (tenant_id IN (SELECT id FROM tenants));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evidence_portfolio' AND policyname = 'Teachers can update/delete their own evidence'
    ) THEN
        CREATE POLICY "Teachers can update/delete their own evidence" ON evidence_portfolio FOR ALL
    USING (teacher_id = auth.uid());
    END IF;
END $$;
