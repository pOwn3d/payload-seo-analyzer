import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Off on purpose: in dev, StrictMode runs every effect twice, so each view
  // fetches its endpoints twice. The smoke tests must send production's request
  // volume, or they trip the plugin's per-user rate limit (10/min on the
  // expensive endpoints) where a real user never would.
  reactStrictMode: false,
  // Next 16 dev writes AGENTS.md and CLAUDE.md into the app folder otherwise.
  agentRules: false,
}

// withPayload wires the `@payload-config` alias, transpiles Payload packages,
// and applies the admin route handling Next.js needs.
export default withPayload(nextConfig)
