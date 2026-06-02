import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin)
  const isAllowed = allowed.length === 0 || allowed.includes(origin) || isLocalhost
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(body: unknown, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: '인증 필요' }, 200, corsHeaders)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // JWT 검증 — admin 클라이언트로 토큰 직접 검증
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user: caller }, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !caller) return json({ error: '인증 실패' }, 200, corsHeaders)

    const { email, password, name, role_id, tenant_id } = await req.json()

    if (!email || !password || !name || !tenant_id) {
      return json({ error: '필수 항목 누락' }, 200, corsHeaders)
    }

    // 권한 확인: super_admin 또는 해당 테넌트의 승인된 admin만 허용
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('is_super_admin').eq('id', caller.id).single()
    const { data: callerMember } = await supabaseAdmin
      .from('tenant_members').select('role')
      .eq('tenant_id', tenant_id).eq('user_id', caller.id).eq('is_approved', true).single()

    const isAuthorized = callerProfile?.is_super_admin === true || callerMember?.role === 'admin'
    if (!isAuthorized) return json({ error: '권한 없음' }, 200, corsHeaders)

    // 이메일로 기존 유저 조회 (삭제 후 재등록 케이스 처리)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    let userId: string

    if (existingProfile) {
      // 기존 유저 — 비밀번호 갱신 후 tenant_members에 추가
      userId = existingProfile.id
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: { name },
      })
      if (pwErr) return json({ error: '정보 갱신 오류: ' + pwErr.message }, 200, corsHeaders)

      const { error: profileUpdateErr } = await supabaseAdmin
        .from('profiles')
        .update({ name })
        .eq('id', userId)
      if (profileUpdateErr) return json({ error: '프로필 갱신 오류: ' + profileUpdateErr.message }, 200, corsHeaders)
    } else {
      // 신규 유저 생성
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      })
      if (createError) return json({ error: '계정 생성에 실패했습니다.' }, 200, corsHeaders)

      userId = newUser.user.id

      const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        name,
        email,
        is_approved: false,
        is_super_admin: false,
      })
      if (profileErr) return json({ error: '프로필 생성 오류: ' + profileErr.message }, 200, corsHeaders)
    }

    const { error: memberErr } = await supabaseAdmin.from('tenant_members').upsert({
      tenant_id,
      user_id: userId,
      role: 'member',
      role_id: role_id ?? null,
      is_approved: true,
    }, { onConflict: 'tenant_id,user_id' })
    if (memberErr) return json({ error: '조직 등록 오류: ' + memberErr.message }, 200, corsHeaders)

    return json({ success: true }, 200, corsHeaders)
  } catch (err) {
    return json({ error: '서버 오류: ' + (err instanceof Error ? err.message : String(err)) }, 200, corsHeaders)
  }
})
