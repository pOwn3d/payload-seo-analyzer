/**
 * SeoView — Server component wrapper.
 * Wraps the client SeoView in Payload's DefaultTemplate to get the admin sidebar + header.
 */

import type { AdminViewServerProps } from 'payload'
// @ts-ignore — @payloadcms/next is a peer dependency
import { DefaultTemplate } from '@payloadcms/next/templates'
import React from 'react'
// @ts-ignore — next is a peer dependency
import { redirect } from 'next/navigation'
import { SeoViewClient } from './SeoViewClient.js'
import { ViewErrorBoundary } from './ErrorBoundaryClient.js'
import { seoViewRedirectTarget } from '../helpers/viewAccess.js'

export const SeoView: React.FC<AdminViewServerProps> = (props) => {
  const { initPageResult } = props

  // Not just `!!req.user`: a session on any OTHER auth collection (front-office
  // customers, members…) also populates it, and declaring these views takes the route
  // out of Payload's own canAccessAdmin redirect. See helpers/viewAccess.ts.
  const denied = seoViewRedirectTarget(initPageResult)
  if (denied) { redirect(denied) }

  const { req, visibleEntities, permissions, locale } = initPageResult

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={{}}
      payload={req.payload}
      permissions={permissions}
      req={req}
      searchParams={{}}
      user={req.user!}
      visibleEntities={visibleEntities}
    >
      {/* The client view is the whole page body: a render error there would
          otherwise unmount the admin shell around it. */}
      <ViewErrorBoundary viewName="SeoView">
        <SeoViewClient />
      </ViewErrorBoundary>
    </DefaultTemplate>
  )
}

export default SeoView
