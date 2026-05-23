export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      templates: {
        Row: {
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
        Insert: {
          name: string
          thumbnail_url?: string | null
          colors?: Json
          fonts?: Json
          layout?: Json
          css_snippets?: Json
          keywords?: string[]
          embedding?: number[] | string | null
        }
        Update: Partial<Database['public']['Tables']['templates']['Insert']>
      }
      projects: {
        Row: {
          id: string
          user_id: string | null
          name: string
          industry: string | null
          template_id: string | null
          menu_structure: Json
          status: 'draft' | 'in_progress' | 'completed'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      pages: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['pages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['pages']['Insert']>
      }
    }
  }
}
