// Nav group component injected by the SEO plugin into Payload admin sidebar (afterNavLinks)
// Matches the AdminNavGroup pattern: group title + items with border-left active indicator
'use client'

import React from 'react'
// @ts-ignore — next is a peer dependency
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const svgProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

export default function SeoNavLink() {
  const pathname = usePathname()

  // Detect admin route prefix from current pathname (works with custom admin routes)
  const adminPrefix = pathname?.match(/^(\/[^/]+)\//)?.[1] || '/admin'

  const items: NavItem[] = [
    {
      href: `${adminPrefix}/seo`,
      label: 'Dashboard',
      icon: (
        <svg {...svgProps}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
          <path d="M11 8v6" />
          <path d="M8 11h6" />
        </svg>
      ),
    },
    {
      href: `${adminPrefix}/sitemap-audit`,
      label: 'Audit Sitemap',
      icon: (
        <svg {...svgProps}>
          <path d="M3 3v18h18" />
          <path d="M7 16l4-8 4 4 4-6" />
        </svg>
      ),
    },
    {
      href: `${adminPrefix}/redirects`,
      label: 'Redirections',
      icon: (
        <svg {...svgProps}>
          <path d="M9 18l6-6-6-6" />
          <path d="M15 18l-6-6 6-6" />
        </svg>
      ),
    },
    {
      href: `${adminPrefix}/cannibalization`,
      label: 'Cannibalisation',
      icon: (
        <svg {...svgProps}>
          <path d="M12 2L2 7l10 5 10-5-10-5Z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
    },
    {
      href: `${adminPrefix}/performance`,
      label: 'Performance',
      icon: (
        <svg {...svgProps}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
    {
      href: `${adminPrefix}/keyword-research`,
      label: 'Mots-cl\u00e9s',
      icon: (
        <svg {...svgProps}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      ),
    },
    {
      href: `${adminPrefix}/schema-builder`,
      label: 'Schema.org',
      icon: (
        <svg {...svgProps}>
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
          <path d="M21 15V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v10" />
          <line x1="12" y1="8" x2="17" y2="8" />
          <line x1="12" y1="12" x2="17" y2="12" />
        </svg>
      ),
    },
    {
      href: `${adminPrefix}/link-graph`,
      label: 'Graphe de liens',
      icon: (
        <svg {...svgProps}>
          <circle cx="5" cy="6" r="3" />
          <circle cx="19" cy="6" r="3" />
          <circle cx="12" cy="18" r="3" />
          <path d="M7.5 8l3 7.5" />
          <path d="M16.5 8l-3 7.5" />
          <path d="M8 6h8" />
        </svg>
      ),
    },
    {
      href: `${adminPrefix}/seo-config`,
      label: 'Configuration',
      icon: (
        <svg {...svgProps}>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
  ]

  return (
    <div style={{ paddingTop: 8, marginTop: 8, borderTop: '1px solid var(--theme-elevation-200)' }}>
      <div
        style={{
          padding: '4px 16px',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: 'var(--theme-elevation-400)',
        }}
      >
        SEO
      </div>
      {items.map((item) => {
        const isActive = pathname === item.href
        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 16px',
              margin: '2px 8px',
              borderRadius: 6,
              borderLeft: isActive ? '3px solid var(--theme-elevation-900)' : '3px solid transparent',
              backgroundColor: isActive ? 'var(--theme-elevation-100)' : 'transparent',
              color: isActive ? 'var(--theme-text)' : 'var(--theme-elevation-500)',
              fontWeight: isActive ? 600 : 500,
              fontSize: 13,
              textDecoration: 'none',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {item.icon}
            {item.label}
          </a>
        )
      })}
    </div>
  )
}
