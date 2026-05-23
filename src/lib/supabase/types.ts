export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type TemplatesRow = {
  id: string
  name: string
  thumbnail_url: string | null
  colors: Json
  fonts: Json
  layout: Json
  css_snippets: Json
  keywords: string[]
  embedding: string | null
  created_at: string
}

type TemplatesInsert = {
  name: string
  thumbnail_url?: string | null
  colors?: Json
  fonts?: Json
  layout?: Json
  css_snippets?: Json
  keywords?: string[]
  embedding?: number[] | string | null
}

type TemplatesUpdate = Partial<TemplatesInsert>

type ProjectsRow = {
  id: string
  user_id: string | null
  name: string
  industry: string | null
  template_id: string | null
  menu_structure: Json
  status: 'draft' | 'in_progress' | 'completed'
  created_at: string
}

type ProjectsInsert = {
  user_id?: string | null
  name: string
  industry?: string | null
  template_id?: string | null
  menu_structure?: Json
  status?: 'draft' | 'in_progress' | 'completed'
}

type ProjectsUpdate = Partial<ProjectsInsert>

type PagesRow = {
  id: string
  project_id: string
  page_name: string
  page_order: number
  prompt: string | null
  html_content: string | null
  screenshot_url: string | null
  status: 'pending' | 'generating' | 'generated' | 'approved'
  created_at: string
}

type PagesInsert = {
  project_id: string
  page_name: string
  page_order?: number
  prompt?: string | null
  html_content?: string | null
  screenshot_url?: string | null
  status?: 'pending' | 'generating' | 'generated' | 'approved'
}

type PagesUpdate = Partial<PagesInsert>

export interface Database {
  public: {
    Tables: {
      templates: {
        Row: TemplatesRow
        Insert: TemplatesInsert
        Update: TemplatesUpdate
      }
      projects: {
        Row: ProjectsRow
        Insert: ProjectsInsert
        Update: ProjectsUpdate
      }
      pages: {
        Row: PagesRow
        Insert: PagesInsert
        Update: PagesUpdate
      }
    }
    Views: Record<string, never>
    Functions: {
      match_templates: {
        Args: { query_embedding: number[]; match_count?: number }
        Returns: {
          id: string
          name: string
          thumbnail_url: string | null
          css_snippets: Json
          keywords: string[]
          similarity: number
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
