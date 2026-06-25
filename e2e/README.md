# End-to-end harness

Validates that `@consilioweb/payload-seo-analyzer` integrates and runs in a **real Payload v3**
instance (not just unit tests): config transform, collection/field/hook registration, DB schema,
`analyzeSeo` on a real doc, and meta writes (the bulk-apply target).

```bash
cd e2e
npm install payload@latest @payloadcms/db-sqlite@latest @payloadcms/richtext-lexical@latest @consilioweb/payload-seo-analyzer@latest sharp
node e2e.mjs   # exits 0 when all checks pass
```

Kept out of `pnpm test` on purpose — Payload + native deps (libsql/sharp) are heavy. Run it
manually before a release to catch integration regressions.
