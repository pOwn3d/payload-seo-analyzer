/**
 * SEO Generate endpoint handler.
 * Calls user-provided generate functions (generateTitle, generateDescription,
 * generateImage, generateURL) to produce meta values from a Payload document.
 *
 * The consuming application registers generate functions via the plugin config,
 * and this endpoint exposes them as a POST API for the admin UI or external tools.
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'

// ---------------------------------------------------------------------------
// Local interfaces (avoids circular dependency with ../plugin.js)
// ---------------------------------------------------------------------------

interface GenerateFnArgs {
  doc: Record<string, unknown>
  locale?: string
  req: unknown
  collectionSlug?: string
  globalSlug?: string
}

interface GeneratePluginConfig {
  generateTitle?: (args: GenerateFnArgs) => string | Promise<string>
  generateDescription?: (args: GenerateFnArgs) => string | Promise<string>
  generateImage?: (args: GenerateFnArgs) => string | number | Promise<string | number>
  generateURL?: (args: GenerateFnArgs) => string | Promise<string>
}

/** Valid generate types that can be requested */
type GenerateType = 'title' | 'description' | 'image' | 'url'

/** Shape of the expected POST request body */
interface GenerateRequestBody {
  type: GenerateType
  collectionSlug?: string
  globalSlug?: string
  docId?: string | number
  locale?: string
}

// ---------------------------------------------------------------------------
// Maps generate type → config key
// ---------------------------------------------------------------------------

const TYPE_TO_CONFIG_KEY: Record<GenerateType, keyof GeneratePluginConfig> = {
  title: 'generateTitle',
  description: 'generateDescription',
  image: 'generateImage',
  url: 'generateURL',
}

const VALID_TYPES: GenerateType[] = ['title', 'description', 'image', 'url']

// ---------------------------------------------------------------------------
// Endpoint handler factory
// ---------------------------------------------------------------------------

/**
 * Creates a Payload endpoint handler that invokes user-provided generate
 * functions (title, description, image, URL) for a given document.
 *
 * @param pluginConfig - The plugin configuration containing generate functions
 * @returns A PayloadHandler for the generate endpoint
 */
export function createGenerateHandler(pluginConfig: GeneratePluginConfig): PayloadHandler {
  return async (req) => {
    try {
      // Authentication check
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse request body
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let body: GenerateRequestBody
      try {
        body = await (req as any).json()
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      const { type, collectionSlug, globalSlug, docId, locale } = body

      // Validate type parameter
      if (!type || !VALID_TYPES.includes(type)) {
        return Response.json(
          { error: `Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}` },
          { status: 400 },
        )
      }

      // Check that the corresponding generate function is configured
      const configKey = TYPE_TO_CONFIG_KEY[type]
      const generateFn = pluginConfig[configKey]

      if (!generateFn) {
        return Response.json(
          { error: `No generate function configured for ${type}` },
          { status: 400 },
        )
      }

      // Load the document
      let doc: Record<string, unknown>

      if (collectionSlug && docId) {
        // Collection document
        doc = await req.payload.findByID({
          collection: collectionSlug,
          id: docId,
          depth: 1,
          overrideAccess: true,
          ...(locale ? { locale } : {}),
        }) as Record<string, unknown>
      } else if (globalSlug) {
        // Global document
        doc = await req.payload.findGlobal({
          slug: globalSlug,
          depth: 1,
          overrideAccess: true,
          ...(locale ? { locale } : {}),
        }) as Record<string, unknown>
      } else {
        return Response.json(
          { error: 'Provide either { collectionSlug, docId } or { globalSlug }' },
          { status: 400 },
        )
      }

      // Build the args for the generate function
      const fnArgs: GenerateFnArgs = {
        doc,
        locale,
        req,
        ...(collectionSlug ? { collectionSlug } : {}),
        ...(globalSlug ? { globalSlug } : {}),
      }

      // Call the generate function
      const result = await generateFn(fnArgs)

      return Response.json({ result })
    } catch (error) {
      console.error('[seo-plugin/generate] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
