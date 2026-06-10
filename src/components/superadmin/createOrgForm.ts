import type { TenantMode } from '../../types'

export interface CreateOrgForm {
  slug: string
  name: string
  business_type: string
  title: string
  theme_color: string
  tenant_mode: TenantMode
}

export const EMPTY_ORG_FORM: CreateOrgForm = { slug: '', name: '', business_type: '', title: '', theme_color: '', tenant_mode: '회원공유' }
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
