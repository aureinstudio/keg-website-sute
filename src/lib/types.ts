export interface StyleProfile {
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
  }
  fonts: {
    heading: string
    body: string
    size: { base: string; heading: string }
  }
  layout: {
    containerWidth: string
    sectionPadding: string
    gridColumns: number
  }
  cssSnippets: {
    header: string
    hero: string
    card: string
    footer: string
    [key: string]: string
  }
  keywords: string[]
}

export interface MenuItem {
  id: string
  name: string
  path: string
}

export interface GenerationContext {
  templateId: string
  styleProfile: StyleProfile
  menuItems: MenuItem[]
  currentPage: string
  userPrompt: string
  existingPages?: { name: string; cssVars: string }[]
}
