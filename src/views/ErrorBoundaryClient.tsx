'use client'

// Import from our own package's client entry — tsup keeps this external,
// preserving the RSC boundary (this file = client, the *View wrappers = server).
// An error boundary is a class component with state: it CANNOT be bundled into
// the server `views` entry, which carries no "use client" banner.
// @ts-ignore — self-reference via package exports
export { LocalizedSeoErrorBoundary as ViewErrorBoundary } from '@consilioweb/payload-seo-analyzer/client'
