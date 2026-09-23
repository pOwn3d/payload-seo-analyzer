/**
 * Options of the meta title / description / image field components.
 *
 * metaFields() stores them in the field's `admin.custom`, which Payload hands to
 * the component as `field.admin.custom` — never as top-level props. Reading only
 * the props hid the "generate" button and ignored a custom `endpointBasePath`.
 */

export interface MetaFieldCustom {
  hasGenerateFn?: boolean
  basePath?: string
}

export interface MetaFieldOptionProps {
  field?: { admin?: { custom?: MetaFieldCustom } }
  /** Direct props win over `admin.custom`, for hosts that mount the component themselves. */
  hasGenerateFn?: boolean
  basePath?: string
}

export function resolveMetaFieldOptions(props: MetaFieldOptionProps): Required<MetaFieldCustom> {
  const custom = props.field?.admin?.custom
  return {
    hasGenerateFn: props.hasGenerateFn ?? custom?.hasGenerateFn ?? false,
    basePath: props.basePath ?? custom?.basePath ?? '/api/seo-plugin',
  }
}
