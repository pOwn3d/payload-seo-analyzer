/**
 * SSRF guard — shared address/URL vetting for every URL the SERVER follows
 * (external-link checker, redirect hops…).
 *
 * The previous implementation matched IPv4 with a dotted-quad regex and IPv6 with
 * a couple of `startsWith` tests. That let `http://[::ffff:169.254.169.254]/`
 * through: `new URL()` normalizes the hostname to `[::ffff:a9fe:a9fe]`, which is
 * neither dotted-quad nor `fc`/`fd`/`fe80`/`::1`, and `dns.lookup()` echoes the
 * literal back unchanged — so both the hostname pass AND the DNS-rebinding pass
 * returned "public". Cloud metadata (169.254.169.254) and every loopback port were
 * reachable that way.
 *
 * This module parses addresses properly instead: IPv6 is expanded to its 8 groups
 * and any embedded IPv4 (`::ffff:*` mapped, `::*` compatible, 6to4, NAT64) is
 * re-checked with the IPv4 rules.
 */
import { promises as dns } from 'dns'

/** Ports the checker is allowed to reach — anything else is internal-service scanning. */
const ALLOWED_PORTS = new Set(['', '80', '443'])

/** True for reserved / non-routable IPv4 space. */
function isPrivateIPv4(a: number, b: number, c: number, d: number): boolean {
  if (a === 0) return true                                   // 0.0.0.0/8 "this network"
  if (a === 10) return true                                  // 10.0.0.0/8
  if (a === 127) return true                                 // 127.0.0.0/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true          // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true                    // 169.254.0.0/16 link-local (metadata)
  if (a === 172 && b >= 16 && b <= 31) return true           // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true           // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 168) return true                    // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true        // 198.18.0.0/15 benchmarking
  if (a >= 224) return true                                  // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  return false
}

function parseIPv4(ip: string): [number, number, number, number] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return null
  const parts = m.slice(1, 5).map(Number) as [number, number, number, number]
  if (parts.some((n) => n > 255)) return null
  return parts
}

/**
 * Expand an IPv6 literal to its 8 16-bit groups.
 * Handles `::` compression, a trailing dotted-quad, and a `%zone` suffix.
 */
function parseIPv6(input: string): number[] | null {
  let ip = input.toLowerCase().split('%')[0]
  if (!ip.includes(':')) return null

  // Trailing dotted-quad form (::ffff:127.0.0.1) → convert the quad to two groups.
  const lastColon = ip.lastIndexOf(':')
  const tail = ip.slice(lastColon + 1)
  const quad = parseIPv4(tail)
  if (quad) {
    const hi = ((quad[0] << 8) | quad[1]).toString(16)
    const lo = ((quad[2] << 8) | quad[3]).toString(16)
    ip = `${ip.slice(0, lastColon + 1)}${hi}:${lo}`
  } else if (/\d+\.\d+/.test(tail)) {
    return null // malformed embedded IPv4
  }

  const doubleColon = ip.indexOf('::')
  let head: string[]
  let rear: string[]
  if (doubleColon >= 0) {
    if (ip.indexOf('::', doubleColon + 1) !== -1) return null // more than one `::`
    head = ip.slice(0, doubleColon).split(':').filter((s) => s !== '')
    rear = ip.slice(doubleColon + 2).split(':').filter((s) => s !== '')
    if (head.length + rear.length > 7) return null
  } else {
    head = ip.split(':')
    rear = []
    if (head.length !== 8) return null
  }

  const groups = [
    ...head,
    ...Array(8 - head.length - rear.length).fill('0'),
    ...rear,
  ]
  const out: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    out.push(parseInt(g, 16))
  }
  return out.length === 8 ? out : null
}

/** IPv4 embedded in an IPv6 address (mapped / compatible / 6to4 / NAT64), if any. */
function embeddedIPv4(g: number[]): [number, number, number, number] | null {
  const zeroPrefix = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0
  // ::ffff:a.b.c.d (mapped) and ::a.b.c.d (deprecated "compatible")
  if (zeroPrefix && (g[5] === 0xffff || g[5] === 0)) {
    return [(g[6] >> 8) & 0xff, g[6] & 0xff, (g[7] >> 8) & 0xff, g[7] & 0xff]
  }
  // 2002:a.b.c.d::/16 — 6to4
  if (g[0] === 0x2002) {
    return [(g[1] >> 8) & 0xff, g[1] & 0xff, (g[2] >> 8) & 0xff, g[2] & 0xff]
  }
  // 64:ff9b::/96 — NAT64 well-known prefix
  if (g[0] === 0x0064 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    return [(g[6] >> 8) & 0xff, g[6] & 0xff, (g[7] >> 8) & 0xff, g[7] & 0xff]
  }
  return null
}

/** True if the address (IPv4 or IPv6 literal) is loopback / private / link-local / reserved. */
export function isPrivateIP(rawIp: string): boolean {
  if (typeof rawIp !== 'string' || !rawIp) return true
  const ip = rawIp.trim().replace(/^\[/, '').replace(/\]$/, '').toLowerCase()

  const v4 = parseIPv4(ip)
  if (v4) return isPrivateIPv4(v4[0], v4[1], v4[2], v4[3])

  const g = parseIPv6(ip)
  if (!g) {
    // Neither a valid IPv4 nor IPv6 literal → not an address we can vet here.
    // (Hostnames are resolved separately; a bare hostname reaches this function
    // only through DNS results, which are always literals.)
    return false
  }

  // Any embedded IPv4 is re-checked with the IPv4 rules — this is the hole that
  // `http://[::ffff:169.254.169.254]/` walked through.
  const mapped = embeddedIPv4(g)
  if (mapped) return isPrivateIPv4(mapped[0], mapped[1], mapped[2], mapped[3])

  if (g.every((x) => x === 0)) return true                               // :: unspecified
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true     // ::1 loopback
  if ((g[0] & 0xfe00) === 0xfc00) return true                            // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return true                            // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true                            // ff00::/8 multicast
  return false
}

/** Hostname-level checks: localhost aliases, raw IP literals, non-web ports. */
export function isPrivateUrl(urlString: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    return true // unparseable → block as a precaution
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true
  // Port allowlist: without it the checker doubles as an internal port scanner.
  if (!ALLOWED_PORTS.has(parsed.port)) return true

  const hostname = parsed.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  if (hostname === '' || hostname === '0') return true

  const rawIp = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname
  return isPrivateIP(rawIp)
}

/**
 * DNS-rebinding protection: resolve the hostname and reject if ANY returned
 * address is private. Checking only the first answer left a trivial bypass —
 * a name with one public and one internal A record.
 */
export async function resolveAndCheckPrivate(hostname: string): Promise<boolean> {
  try {
    const addresses = await dns.lookup(hostname, { all: true })
    if (!addresses.length) return true
    return addresses.some((a) => isPrivateIP(a.address))
  } catch {
    return true // DNS failure → block
  }
}

/** Full gate: hostname/port policy + DNS-resolved addresses. */
export async function isUrlBlocked(url: string): Promise<boolean> {
  if (isPrivateUrl(url)) return true
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.startsWith('[')
      ? parsed.hostname.slice(1, -1)
      : parsed.hostname
    if (await resolveAndCheckPrivate(hostname)) return true
  } catch {
    return true
  }
  return false
}
