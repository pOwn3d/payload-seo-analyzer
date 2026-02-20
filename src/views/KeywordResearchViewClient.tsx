'use client'

// Import from our own package's client entry — tsup keeps this external,
// preserving the RSC boundary (this file = client, KeywordResearchView wrapper = server)
// @ts-ignore — self-reference via package exports
export { KeywordResearchView as KeywordResearchViewClient } from '@consilioweb/seo-analyzer/client'
