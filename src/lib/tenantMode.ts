import type { TenantMode } from '../types'

export function displayMode(raw: string | undefined): TenantMode {
  if (raw === '회원선택') return '회원공유'
  if (raw === '직접입력') return '비회원'
  return (raw as TenantMode) ?? '회원공유'
}
