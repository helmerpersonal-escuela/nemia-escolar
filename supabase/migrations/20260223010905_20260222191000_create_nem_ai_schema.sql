-- Fix for analytical_programs status constraint with DATA SANITIZATION
DO $$
BEGIN
    -- 1. Sanitize existing data: invalid statuses become 'DRAFT'
    UPDATE public.analytical_programs 
    SET status = 'DRAFT' 
    WHERE status NOT IN ('DRAFT', 'COMPLETED', 'FINALIZADO', 'ACTIVE');

    -- 2. Drop old constraint if exists
    ALTER TABLE public.analytical_programs DROP CONSTRAINT IF EXISTS analytical_programs_status_check;
    
    -- 3. Add new lenient constraint
    ALTER TABLE public.analytical_programs 
    ADD CONSTRAINT analytical_programs_status_check 
    CHECK (status IN ('DRAFT', 'COMPLETED', 'FINALIZADO', 'ACTIVE'));
END $$;

-- Enable pgvector extension
create extension if not exists vector
with
  schema extensions;

-- Create table to track uploaded NEM documents (PDFs)
create table
  public.nem_documents (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    file_url text not null,
    original_filename text not null,
    file_size_bytes bigint,
    uploaded_by uuid references public.profiles(id) on delete set null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
  );

-- Habilitar RLS en nem_documents
alter table public.nem_documents enable row level security;

-- Política para ver documentos (todos pueden ver los documentos NEM)
create policy "Anyone can view nem_documents"
  on public.nem_documents for select
  to authenticated
  using (true);

-- Política para insertar/borrar (solo administradores o usuarios autorizados)
create policy "Authed users can insert nem_documents"
  on public.nem_documents for insert
  to authenticated
  with check (auth.uid() = uploaded_by);

create policy "Authed users can delete own nem_documents"
  on public.nem_documents for delete
  to authenticated
  using (auth.uid() = uploaded_by);


-- Create table to store text chunks and their embeddings
create table
  public.nem_document_chunks (
    id uuid default gen_random_uuid() primary key,
    document_id uuid not null references public.nem_documents(id) on delete cascade,
    page_number integer,
    content text not null,
    -- Utilizaremos text-embedding-3-small (1536 dimensiones)
    -- Si cambiamos a Gemini embedding (768), actualizar la dimensión aquí.
    -- OpenAI text-embedding-ada-002 and text-embedding-3-small use 1536.
    -- Vamos a dejar 1536 asumiendo OpenAI, si usamos otro modelo generamos otra tabla o modificamos tamaño.
    embedding extensions.vector(1536),
    chunk_index integer not null,
    created_at timestamp with time zone default now()
  );

-- Habilitar RLS en nem_document_chunks
alter table public.nem_document_chunks enable row level security;

-- Política para leer los chunks
create policy "Anyone can view nem_document_chunks"
  on public.nem_document_chunks for select
  to authenticated
  using (true);

create policy "Authed users can insert own nem_document_chunks"
  on public.nem_document_chunks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.nem_documents
      where id = document_id and uploaded_by = auth.uid()
    )
  );

-- Create index for faster vector search using HNSW
create index on public.nem_document_chunks
using hnsw (embedding extensions.vector_cosine_ops);

-- Create a Postgres function for similarity search (RAG)
create or replace function public.match_nem_chunks(
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  document_id uuid,
  document_title text,
  page_number integer,
  content text,
  similarity float
)
language sql stable set search_path = public, extensions
as $$
  select
    chunk.id,
    chunk.document_id,
    doc.title as document_title,
    chunk.page_number,
    chunk.content,
    1 - (chunk.embedding <=> query_embedding) as similarity
  from public.nem_document_chunks chunk
  join public.nem_documents doc on doc.id = chunk.document_id
  where 1 - (chunk.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
