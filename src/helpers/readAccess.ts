/**
 * Read-access options for SINGLE-DOCUMENT, user-facing reads (validate, generate,
 * breadcrumb, schema-generator, ai-rewrite).
 *
 * Opt-in strict mode (`SEO_STRICT_READ_ACCESS=1`) respects the caller's collection
 * and field-level access control (`overrideAccess: false` + `user`). The default
 * keeps `overrideAccess: true` — the admin tooling reads the document the user is
 * editing, which avoids regressions on setups that don't expose read ACL to the
 * panel user.
 *
 * NOTE: site-wide AGGREGATION endpoints (audit, sitemap-audit, link-graph, …) keep
 * `overrideAccess: true` unconditionally — they must see every document to be
 * correct (otherwise they produce false orphans/broken links). See docs/THREAT-MODEL.md.
 */
import type { PayloadRequest } from 'payload'

export function readAccessOpts(req: PayloadRequest): {
  overrideAccess: boolean
  user?: PayloadRequest['user']
} {
  if (process.env.SEO_STRICT_READ_ACCESS === '1') {
    return { overrideAccess: false, user: req.user }
  }
  return { overrideAccess: true }
}
