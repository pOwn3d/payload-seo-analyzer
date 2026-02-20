'use client'

// Import from our own package's client entry — tsup keeps this external,
// preserving the RSC boundary (this file = client, RedirectManagerView wrapper = server)
// @ts-ignore — self-reference via package exports
export { RedirectManagerView as RedirectManagerViewClient } from '@consilioweb/seo-analyzer/client'
