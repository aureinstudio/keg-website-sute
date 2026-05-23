create or replace function match_templates(
  query_embedding vector(1536),
  match_count int default 3
)
returns table (
  id uuid,
  name text,
  thumbnail_url text,
  css_snippets jsonb,
  keywords text[],
  similarity float
)
language sql stable
as $$
  select
    id,
    name,
    thumbnail_url,
    css_snippets,
    keywords,
    1 - (embedding <=> query_embedding) as similarity
  from templates
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
