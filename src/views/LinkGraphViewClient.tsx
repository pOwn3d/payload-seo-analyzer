'use client'

// Import from our own package's client entry — tsup keeps this external,
// preserving the RSC boundary (this file = client, LinkGraphView wrapper = server)
// @ts-ignore — self-reference via package exports
export { LinkGraphView as LinkGraphViewClient } from '@consilioweb/seo-analyzer/client'
