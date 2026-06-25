import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the harness build lean and deterministic.
  reactStrictMode: true,
}

// withPayload wires the `@payload-config` alias, transpiles Payload packages,
// and applies the admin route handling Next.js needs.
export default withPayload(nextConfig)
