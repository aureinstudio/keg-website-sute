-- pgvector 활성화
create extension if not exists vector with schema public;

-- 스타일 템플릿
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  thumbnail_url text,
  colors jsonb not null default '{}',
  fonts jsonb not null default '{}',
  layout jsonb not null default '{}',
  css_snippets jsonb not null default '{}',
  keywords text[] not null default '{}',
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- 벡터 유사도 검색 인덱스
create index if not exists templates_embedding_idx
  on templates using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 프로젝트
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  industry text,
  template_id uuid references templates(id),
  menu_structure jsonb not null default '[]',
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'completed')),
  created_at timestamptz not null default now()
);

-- 생성된 페이지
create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  page_name text not null,
  page_order integer not null default 0,
  prompt text,
  html_content text,
  screenshot_url text,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'generated', 'approved')),
  created_at timestamptz not null default now()
);

-- Storage 버킷
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict do nothing;
