import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, Customer } from '../types'

interface AuthState {
  profile: Profile | null
  myCustomer: Customer | null
  loading: boolean
  refreshCustomer: () => Promise<Customer | null>
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, name: string, role: 'volunteer' | '50plus' | 'team_leader' | 'admin', tenantId?: string, tenantRoleId?: string) => Promise<string | null>
  signInWithGoogle: () => Promise<string | null>
  signInWithKakao: () => Promise<string | null>
  linkGoogle: () => Promise<string | null>
  linkKakao: () => Promise<string | null>
  getIdentities: () => Promise<{ provider: string }[]>
  signOut: () => Promise<void>
  deleteAccount: (tenantId?: string) => Promise<string | null>
  resetPassword: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myCustomer, setMyCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (window.location.pathname === '/reset-password') { setLoading(false); return }
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setLoading(false); return }
      if (window.location.pathname === '/reset-password') { setLoading(false); return }
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setMyCustomer(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const [profileRes, customerRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('customers').select('*').eq('owner_user_id', userId).maybeSingle(),
    ])
    setProfile(profileRes.data)
    setMyCustomer(customerRes.data ?? null)
    setLoading(false)
  }

  const refreshCustomer = useCallback(async (): Promise<Customer | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('owner_user_id', session.user.id)
      .maybeSingle()
    setMyCustomer(data ?? null)
    return data ?? null
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return null
    if (error.status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    if (error.message === 'Email not confirmed') return '이메일 인증이 필요합니다. 가입 시 받은 인증 메일을 확인해 주세요.'
    if (error.message === 'Invalid login credentials') return '이메일 또는 비밀번호가 올바르지 않습니다.'
    return error.message
  }, [])

  const signUp = useCallback(async (email: string, password: string, name: string, role: 'volunteer' | '50plus' | 'team_leader' | 'admin', tenantId?: string, tenantRoleId?: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name, role,
          ...(tenantId ? { tenant_id: tenantId } : {}),
          ...(tenantRoleId ? { tenant_role_id: tenantRoleId } : {}),
        },
      },
    })
    if (error) {
      if (error.status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
      if (error.message === 'User already registered') return '이미 가입된 이메일입니다. 로그인 후 재신청해 주세요.'
      return error.message
    }
    if (data.user?.identities?.length === 0) return '이미 가입된 이메일입니다. 로그인 후 재신청해 주세요.'
    return null
  }, [])

  const signInWithGoogle = useCallback(async (): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return error?.message ?? null
  }, [])

  const signInWithKakao = useCallback(async (): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.origin, scopes: 'profile_nickname profile_image' },
    })
    return error?.message ?? null
  }, [])

  const linkGoogle = useCallback(async (): Promise<string | null> => {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return error?.message ?? null
  }, [])

  const linkKakao = useCallback(async (): Promise<string | null> => {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'kakao',
      options: { redirectTo: window.location.origin, scopes: 'profile_nickname profile_image' },
    })
    return error?.message ?? null
  }, [])

  const getIdentities = useCallback(async (): Promise<{ provider: string }[]> => {
    const { data: { user } } = await supabase.auth.getUser()
    return (user?.identities ?? []).map(i => ({ provider: i.provider }))
  }, [])

  const resetPassword = useCallback(async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (!error) return null
    if (error.status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    return error.message
  }, [])

  const updatePassword = useCallback(async (password: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    // 토큰 만료(403) 등으로 서버 로그아웃 실패 시 로컬 세션만 제거
    if (error) await supabase.auth.signOut({ scope: 'local' })
  }, [])

  const deleteAccount = useCallback(async (tenantId?: string): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return '로그인이 필요합니다.'
    const { data, error } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: tenantId ? { tenant_id: tenantId } : undefined,
    })
    if (error || data?.error) return data?.error ?? error?.message ?? '오류가 발생했습니다.'
    if (!tenantId) {
      const { error: soErr } = await supabase.auth.signOut({ scope: 'global' })
      if (soErr) await supabase.auth.signOut({ scope: 'local' })
    }
    return null
  }, [])

  return (
    <AuthContext.Provider value={{
      profile, myCustomer, loading,
      refreshCustomer,
      signIn, signUp, signInWithGoogle, signInWithKakao,
      linkGoogle, linkKakao, getIdentities, signOut, deleteAccount,
      resetPassword, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
