'use client'

// Import from our own package's client entry — tsup keeps this external,
// preserving the RSC boundary (this file = client, PerformanceView wrapper = server)
// @ts-ignore — self-reference via package exports
export { PerformanceView as PerformanceViewClient } from '@consilioweb/seo-analyzer/client'
