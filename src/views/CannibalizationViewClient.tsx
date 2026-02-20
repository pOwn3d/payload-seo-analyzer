'use client'

// Import from our own package's client entry — tsup keeps this external,
// preserving the RSC boundary (this file = client, CannibalizationView wrapper = server)
// @ts-ignore — self-reference via package exports
export { CannibalizationView as CannibalizationViewClient } from '@consilioweb/seo-analyzer/client'
