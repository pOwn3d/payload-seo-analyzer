/**
 * SchemaBuilderView — Server component wrapper.
 * Wraps the client SchemaBuilderView in Payload's DefaultTemplate to get the admin sidebar + header.
 */

import type { AdminViewServerProps } from 'payload'
// @ts-ignore — @payloadcms/next is a peer dependency
import { DefaultTemplate } from '@payloadcms/next/templates'
import React from 'react'
// @ts-ignore — next is a peer dependency
import { redirect } from 'next/navigation'
import { SchemaBuilderViewClient } from './SchemaBuilderViewClient.js'

export const SchemaBuilderView: React.FC<AdminViewServerProps> = (props) => {
  const { initPageResult } = props

  if (!initPageResult?.req?.user) { redirect('/admin/login') }

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
      <SchemaBuilderViewClient />
    </DefaultTemplate>
  )
}

export default SchemaBuilderView
