import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  onClose: () => void
  onSignIn: (email: string, password: string) => Promise<string | null>
  onSignUp: (email: string, password: string, name: string, role: 'volunteer' | '50plus' | 'team_leader' | 'admin', tenantId?: string, tenantRoleId?: string) => Promise<string | null>
  onGoogle: () => Promise<string | null>
  onKakao: () => Promise<string | null>
  hideCancelButton?: boolean
}

type Mode = 'login' | 'signup'
interface TenantRole { id: string; name: string; display_order: number }
interface Tenant { id: string; name: string }

const DAY_LABELS = ['MON','TUE','WED','THU','FRI','SAT','SUN']
const TIME_TICKS = ['09','10','11','12','·','13','14','15','16','17','18']
const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function getWeekNumber(d: Date): number {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  return Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function LoginModal({ onClose, onSignIn, onSignUp, onGoogle, onKakao, hideCancelButton }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState(() => localStorage.getItem('lastLoginEmail') ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [tenantRoles, setTenantRoles] = useState<TenantRole[] | null>(null)
  const [tenantRoleId, setTenantRoleId] = useState<string | null>(null)
  const [tenantTypeLabels, setTenantTypeLabels] = useState<{ volunteer: string; '50plus': string } | null>(null)
  const [role, setRole] = useState<'volunteer' | '50plus' | 'team_leader' | 'admin' | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [socialPending, setSocialPending] = useState<'google' | 'kakao' | null>(null)

  const tabLoginRef = useRef<HTMLButtonElement>(null)
  const tabSignupRef = useRef<HTMLButtonElement>(null)
  const [pillStyle, setPillStyle] = useState({ width: 0, left: 0 })
  const assignGridRef = useRef<HTMLDivElement>(null)

  const now = new Date()
  const weekNum = getWeekNumber(now)
  const todayDow = now.getDay()
  const monthStr = String(now.getMonth() + 1).padStart(2, '0')
  const yearNum = now.getFullYear()
  const monthName = MONTH_NAMES[now.getMonth()]

  useEffect(() => {
    supabase.from('tenants').select('id, name').order('name').then(({ data }) => {
      setTenants(data ?? [])
    })
  }, [])

  useEffect(() => {
    if (!tenantId) { setTenantRoles(null); setTenantRoleId(null); setRole(null); setTenantTypeLabels(null); return }
    setTenantRoles(null); setTenantRoleId(null); setRole(null); setTenantTypeLabels(null)
    Promise.all([
      supabase.from('tenant_roles').select('id, name, display_order').eq('tenant_id', tenantId).order('display_order'),
      supabase.from('tenants').select('settings').eq('id', tenantId).single(),
    ]).then(([{ data: roles }, { data: tenantData }]) => {
      setTenantRoles(roles ?? [])
      const s = (tenantData as { settings?: { volunteer_label?: string; plus_label?: string } } | null)?.settings
      setTenantTypeLabels({
        volunteer: s?.volunteer_label ?? '팀원',
        '50plus': s?.plus_label ?? '50플러스',
      })
    })
  }, [tenantId])

  function updatePill(tab: Mode) {
    const ref = tab === 'login' ? tabLoginRef.current : tabSignupRef.current
    const wrap = ref?.parentElement
    if (!ref || !wrap) return
    const r = ref.getBoundingClientRect()
    const pr = wrap.getBoundingClientRect()
    setPillStyle({ width: r.width, left: r.left - pr.left - 3 })
  }
  useEffect(() => { updatePill(mode) }, [mode])
  useEffect(() => {
    const fn = () => updatePill(mode)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [mode])

  const runAssignAnimation = useCallback(() => {
    const grid = assignGridRef.current
    if (!grid) return () => {}

    const SHIFTS = [
      { col:0,row:0, span:2,name:'서용혁',cls:'sun' },{ col:0,row:2, span:3,name:'민지우',cls:'plus' },
      { col:0,row:5, span:1,name:'·',     cls:'break'},{ col:0,row:6, span:2,name:'이은서',cls:'sat' },
      { col:0,row:8, span:3,name:'박지훈',cls:'moon' },{ col:1,row:0, span:3,name:'정민석',cls:'plus' },
      { col:1,row:3, span:2,name:'김지움',cls:'sun' }, { col:1,row:5, span:1,name:'·',     cls:'break'},
      { col:1,row:6, span:3,name:'한소윤',cls:'sat' }, { col:1,row:9, span:2,name:'조서윤',cls:'moon' },
      { col:2,row:0, span:2,name:'이하랜',cls:'sat' }, { col:2,row:2, span:2,name:'박지훈',cls:'moon' },
      { col:2,row:4, span:1,name:'서용혁',cls:'sun' }, { col:2,row:5, span:1,name:'·',     cls:'break'},
      { col:2,row:6, span:2,name:'민지우',cls:'plus' },{ col:2,row:8, span:3,name:'이은서',cls:'sat' },
      { col:3,row:0, span:3,name:'박지훈',cls:'moon' },{ col:3,row:3, span:2,name:'조서윤',cls:'sun' },
      { col:3,row:5, span:1,name:'·',     cls:'break'},{ col:3,row:6, span:3,name:'정민석',cls:'plus' },
      { col:3,row:9, span:2,name:'김지움',cls:'sat' }, { col:4,row:0, span:2,name:'한소윤',cls:'sat' },
      { col:4,row:2, span:3,name:'민지우',cls:'plus' },{ col:4,row:5, span:1,name:'·',     cls:'break'},
      { col:4,row:6, span:2,name:'서용혁',cls:'sun' }, { col:4,row:8, span:3,name:'박지훈',cls:'moon' },
      { col:5,row:1, span:2,name:'이하랜',cls:'sat' }, { col:5,row:4, span:2,name:'조서윤',cls:'sun' },
      { col:5,row:7, span:2,name:'김지움',cls:'plus' },{ col:6,row:2, span:3,name:'한소윤',cls:'moon' },
      { col:6,row:6, span:2,name:'이은서',cls:'sat' },
    ]

    const nodes = SHIFTS.map(s => {
      const el = document.createElement('div')
      el.className = `lmp-chip ${s.cls}`
      el.style.gridColumn = `${s.col + 1} / span 1`
      el.style.gridRow = `${s.row + 1} / span ${s.span}`
      el.textContent = s.name
      grid.appendChild(el)
      return el
    })

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) { nodes.forEach(n => n.classList.add('visible')); return () => nodes.forEach(n => n.remove()) }

    let timers: ReturnType<typeof setTimeout>[] = []
    const clearAll = () => { timers.forEach(clearTimeout); timers = [] }
    const shuffle = <T,>(arr: T[]) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}; return a }

    function runCycle() {
      nodes.forEach(n => n.classList.remove('visible','just-placed','fading'))
      const order = shuffle(nodes.map((_,i)=>i))
      let prev: HTMLElement|null = null
      order.forEach((idx,i) => {
        timers.push(setTimeout(()=>{
          const n=nodes[idx]
          if(prev) prev.classList.remove('just-placed')
          n.classList.add('visible','just-placed')
          prev=n
          timers.push(setTimeout(()=>n.classList.remove('just-placed'),260))
        },i*95))
      })
      const done = order.length*95+400
      timers.push(setTimeout(()=>{
        nodes.forEach((n,i)=>{ const s=SHIFTS[i]; timers.push(setTimeout(()=>n.classList.add('fading'),s.col*110+s.row*18)) })
      },done+1800))
      timers.push(setTimeout(runCycle,done+1800+1500))
    }

    timers.push(setTimeout(runCycle,400))
    const onVis = () => { if(document.hidden){clearAll()}else{clearAll();timers.push(setTimeout(runCycle,200))} }
    document.addEventListener('visibilitychange',onVis)
    return () => { clearAll(); document.removeEventListener('visibilitychange',onVis); nodes.forEach(n=>n.remove()) }
  }, [])

  useEffect(() => { return runAssignAnimation() }, [runAssignAnimation])

  function switchMode(m: Mode) { setMode(m); setError(null); setSuccess(null); setSocialPending(null) }

  const hasCustomRoles = tenantRoles !== null && tenantRoles.length > 0
  const effectiveDefaultRoles = [
    { value: 'volunteer' as const, label: tenantTypeLabels?.volunteer ?? '팀원' },
    { value: '50plus' as const, label: tenantTypeLabels?.['50plus'] ?? '50플러스' },
    { value: 'team_leader' as const, label: '팀장' },
  ]
  const accent = 'oklch(0.66 0.16 28)'
  const accentSoft = 'oklch(0.95 0.04 28)'
  const accentInk = 'oklch(0.38 0.13 28)'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true)
    if (mode === 'login') {
      if (!email.trim() || !password) { setError('이메일과 비밀번호를 입력해주세요.'); setLoading(false); return }
      const err = await onSignIn(email, password)
      setLoading(false)
      if (err) setError(err)
      else { localStorage.setItem('lastLoginEmail', email); onClose() }
    } else {
      if (!tenantId) { setError('가입할 조직을 선택해주세요.'); setLoading(false); return }
      if (hasCustomRoles && !tenantRoleId) { setError('활동 유형을 선택해주세요.'); setLoading(false); return }
      if (!hasCustomRoles && !role) { setError('활동 유형을 선택해주세요.'); setLoading(false); return }
      if (!name.trim()) { setError('이름을 입력해주세요.'); setLoading(false); return }
      if (password !== confirmPassword) { setError('비밀번호가 일치하지 않습니다.'); setLoading(false); return }
      if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); setLoading(false); return }
      const effectiveRole: 'volunteer' | '50plus' | 'team_leader' | 'admin' =
        hasCustomRoles ? 'volunteer' : (role as 'volunteer' | '50plus' | 'team_leader' | 'admin')
      const err = await onSignUp(email, password, name, effectiveRole, tenantId, tenantRoleId ?? undefined)
      setLoading(false)
      if (err) setError(err)
      else setSuccess(effectiveRole === 'admin'
        ? '가입이 완료됐습니다. 슈퍼관리자가 승인하면 로그인하실 수 있습니다.'
        : '가입이 완료됐습니다. 조직 관리자가 승인하면 로그인하실 수 있습니다.')
    }
  }

  async function handleGoogle() {
    if (mode === 'signup') { setSocialPending('google'); return }
    setLoading(true); setError(null); const err = await onGoogle(); setLoading(false); if (err) setError(err)
  }
  async function handleKakao() {
    if (mode === 'signup') { setSocialPending('kakao'); return }
    setLoading(true); setError(null); const err = await onKakao(); setLoading(false); if (err) setError(err)
  }
  async function handleSocialConfirm() {
    if (!tenantId) { setError('가입할 조직을 선택해주세요.'); return }
    if (hasCustomRoles && !tenantRoleId) { setError('활동 유형을 선택해주세요.'); return }
    if (!hasCustomRoles && !role) { setError('활동 유형을 선택해주세요.'); return }
    localStorage.setItem('vs_pending_social', JSON.stringify({ tenantId, tenantRoleId }))
    setLoading(true); setError(null)
    const err = socialPending === 'google' ? await onGoogle() : await onKakao()
    setLoading(false)
    if (err) { setError(err); localStorage.removeItem('vs_pending_social') }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', height: 42, padding: '0 14px 0 40px',
    background: '#fff', border: '1px solid rgba(20,23,28,0.09)',
    borderRadius: 10, fontSize: 13.5, color: '#14171C', outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <style>{`
        .lmp {
          font-family: "Pretendard Variable", Pretendard, system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          background: #F4F1EA;
          position: relative;
          width: 100%;
          height: 100dvh;
          overflow: hidden;
          display: grid;
          grid-template-rows: var(--bh,52px) var(--dh,32px) 1fr auto;
          grid-template-columns: var(--tw,48px) 1fr;
        }
        /* background layers */
        .lmp-bg-grid {
          position: absolute;
          top: calc(var(--bh,52px) + var(--dh,32px));
          left: var(--tw,48px); right: 0; bottom: 0;
          z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(to right, rgba(20,23,28,0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(20,23,28,0.07) 1px, transparent 1px);
          background-size: 56px 56px;
          background-position: -1px -1px;
          mask-image: linear-gradient(to bottom,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.5) 65%,rgba(0,0,0,0.15) 100%);
          -webkit-mask-image: linear-gradient(to bottom,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.5) 65%,rgba(0,0,0,0.15) 100%);
        }
        .lmp-bg-digit {
          position: absolute; bottom: -110px; right: -50px;
          font-size: 380px; line-height: 0.85; font-weight: 800; letter-spacing: -10px;
          color: transparent; -webkit-text-stroke: 1.5px rgba(20,23,28,0.07);
          user-select: none; z-index: 0; font-family: "JetBrains Mono", monospace; pointer-events: none;
        }
        .lmp-bg-digit .sm { font-size:0.30em; letter-spacing:0; margin-left:-10px; -webkit-text-stroke:1.2px rgba(20,23,28,0.06); }
        .lmp-bg-digit .lbl { display:block; font-family:"Pretendard Variable",Pretendard,sans-serif; font-size:22px; color:rgba(20,23,28,0.18); letter-spacing:4px; font-weight:600; -webkit-text-stroke:0; margin-top:12px; margin-left:20px; }
        .lmp-bg-now {
          position: absolute;
          left: var(--tw,48px); right: 0; height: 1px;
          background: oklch(0.66 0.16 28); z-index: 1; pointer-events: none; opacity: 0.7;
          animation: lmpNow 18s ease-in-out infinite alternate;
        }
        .lmp-bg-now::before { content:""; position:absolute; left:-4px; top:50%; transform:translateY(-50%); width:8px; height:8px; background:oklch(0.66 0.16 28); border-radius:50%; box-shadow:0 0 0 3px #F4F1EA; }
        .lmp-bg-now::after { content:"NOW"; position:absolute; right:18px; top:50%; transform:translateY(-50%); background:#F4F1EA; padding:1px 7px; font-family:"JetBrains Mono",monospace; font-size:9px; font-weight:700; letter-spacing:1.2px; color:oklch(0.66 0.16 28); border-radius:3px; border:1px solid oklch(0.66 0.16 28); }
        @keyframes lmpNow {
          0%   { top: calc(var(--bh,52px) + var(--dh,32px) + 28%); }
          100% { top: calc(var(--bh,52px) + var(--dh,32px) + 55%); }
        }
        /* brand bar */
        .lmp-brand-bar {
          grid-row:1; grid-column:1/-1;
          display:flex; align-items:center; padding:0 24px 0 20px;
          border-bottom:1px solid rgba(20,23,28,0.07);
          background:#F4F1EA; z-index:3; position:relative;
        }
        .lmp-brand-pill {
          margin-left:4px; font-size:10px; font-family:"JetBrains Mono",monospace;
          padding:3px 8px; border-radius:999px; background:#fff;
          border:1px solid rgba(20,23,28,0.09); color:#6B7280; letter-spacing:0.4px; text-transform:uppercase; white-space:nowrap;
        }
        .lmp-top-nav { margin-left:auto; display:flex; align-items:center; gap:8px; font-size:13px; color:#6B7280; white-space:nowrap; }
        .lmp-nav-btn { color:#14171C; font-weight:600; padding:6px 12px; border-radius:8px; background:#fff; border:1px solid rgba(20,23,28,0.09); cursor:pointer; font:inherit; font-size:13px; transition:background .12s; }
        .lmp-nav-btn:hover { background:#ECE8DF; }
        /* day strip */
        .lmp-day-strip {
          grid-row:2; grid-column:1/-1;
          display:grid; grid-template-columns:var(--tw,48px) repeat(7,1fr);
          background:#FBF9F4; border-bottom:1px solid rgba(20,23,28,0.07); z-index:2; position:relative;
        }
        .lmp-day-corner { border-right:1px solid rgba(20,23,28,0.07); display:flex; align-items:center; justify-content:center; font-family:"JetBrains Mono",monospace; font-size:9px; font-weight:600; color:#B8BBC2; letter-spacing:0.6px; }
        .lmp-day-cell { display:flex; align-items:center; justify-content:center; font-family:"JetBrains Mono",monospace; font-size:10px; font-weight:600; letter-spacing:0.8px; color:#8A8F99; border-right:1px solid rgba(20,23,28,0.07); }
        .lmp-day-cell:last-child { border-right:0; }
        .lmp-day-cell.sat { color:oklch(0.55 0.13 240); }
        .lmp-day-cell.sun { color:oklch(0.55 0.16 25); }
        .lmp-day-cell.today { background:oklch(0.66 0.16 28); color:white; }
        /* time gutter */
        .lmp-time-gutter { grid-row:3; grid-column:1; border-right:1px solid rgba(20,23,28,0.07); background:#FBF9F4; display:flex; flex-direction:column; z-index:2; position:relative; }
        .lmp-tick { flex:1; display:flex; align-items:center; justify-content:center; font-family:"JetBrains Mono",monospace; font-size:10px; font-weight:500; color:#8A8F99; border-bottom:1px dashed rgba(20,23,28,0.07); }
        .lmp-tick:last-child { border-bottom:0; }
        .lmp-tick.lunch { color:#B8BBC2; font-style:italic; }
        /* stage */
        .lmp-stage {
          grid-row:3; grid-column:2; z-index:2; position:relative;
          overflow-y:auto; min-height:0;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          padding:24px 28px;
        }
        /* form card */
        .lmp-card {
          position:relative; z-index:5; width:100%; max-width:420px;
          background:#fff; border:1px solid rgba(20,23,28,0.07); border-radius:18px;
          padding:28px 28px 26px; margin:auto;
          box-shadow:0 1px 0 rgba(20,23,28,0.03),0 22px 60px -28px rgba(20,23,28,0.22),0 4px 14px -8px rgba(20,23,28,0.10);
        }
        /* footer */
        .lmp-footer {
          grid-row:4; grid-column:1/-1; border-top:1px solid rgba(20,23,28,0.07);
          background:#F4F1EA; z-index:3; position:relative; height:36px;
          display:flex; align-items:center; padding:0 24px; font-size:11px; color:#8A8F99; gap:12px;
        }
        .lmp-foot-dot { width:3px; height:3px; border-radius:50%; background:#B8BBC2; flex-shrink:0; }
        /* ─── responsive ─── */
        @media (max-width: 900px) {
          .lmp { --bh:48px; --tw:40px; --dh:30px; }
          .lmp-bg-digit { font-size:280px; bottom:-80px; right:-30px; }
          .lmp-bg-digit .lbl { font-size:18px; margin-top:8px; }
          .lmp-card { max-width:400px; padding:24px 24px 22px; }
        }
        @media (max-width: 720px) {
          .lmp { --bh:46px; --tw:36px; --dh:28px; }
          .lmp-brand-pill { display:none; }
          .lmp-nav-hint { display:none; }
          .lmp-stage { padding:16px 18px; }
          .lmp-card { max-width:380px; padding:22px 22px 20px; border-radius:16px; }
          .lmp-bg-digit { font-size:220px; bottom:-65px; right:-25px; }
          .lmp-bg-digit .lbl { font-size:16px; margin-top:6px; }
        }
        @media (max-width: 540px) {
          .lmp { --bh:44px; --tw:0px; --dh:28px; grid-template-columns:1fr; }
          .lmp-time-gutter { display:none; }
          .lmp-bg-grid { left:0; }
          .lmp-bg-now { left:0; }
          .lmp-day-strip { grid-template-columns:repeat(7,1fr); }
          .lmp-day-corner { display:none; }
          .lmp-brand-bar { padding:0 14px; }
          .lmp-stage { grid-column:1; padding:14px; }
          .lmp-card { max-width:100%; padding:20px 18px 18px; border-radius:14px; }
          .lmp-bg-digit { font-size:160px; bottom:-50px; right:-20px; }
          .lmp-bg-digit .sm, .lmp-bg-digit .lbl { display:none; }
          .lmp-footer { height:30px; padding:0 12px; font-size:10px; gap:8px; }
          .lmp-hide-sm { display:none; }
        }
        @media (max-height: 620px) and (min-width: 541px) {
          .lmp-stage { padding:10px 20px; }
          .lmp-card { padding:16px 22px 14px; }
          .lmp-form-title { font-size:21px; margin-bottom:12px; }
        }
        /* assign animation grid */
        .lmp-assign-grid {
          position:absolute;
          top:calc(var(--bh,52px) + var(--dh,32px) + 4px);
          left:calc(var(--tw,48px) + 4px);
          right:4px; bottom:40px;
          z-index:1; pointer-events:none;
          display:grid;
          grid-template-columns:repeat(7,1fr);
          grid-template-rows:repeat(11,1fr);
          gap:3px;
        }
        .lmp-chip {
          border-radius:4px; font-size:10.5px; font-weight:600;
          display:flex; align-items:center; justify-content:center;
          letter-spacing:-0.2px; padding:1px 4px; min-width:0;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap; line-height:1;
          opacity:0; transform:scale(0.82) translateY(-4px);
          transition:opacity .32s ease,transform .32s cubic-bezier(.34,1.56,.64,1),box-shadow .5s ease;
          will-change:opacity,transform;
        }
        .lmp-chip.visible   { opacity:0.72; transform:scale(1) translateY(0); }
        .lmp-chip.just-placed { opacity:1; box-shadow:0 0 0 1.5px oklch(0.66 0.16 28),0 4px 10px -3px oklch(0.66 0.16 28/0.35); }
        .lmp-chip.fading    { opacity:0; transform:scale(0.94); transition:opacity .55s ease,transform .55s ease; }
        .lmp-chip.sun   { background:oklch(0.93 0.06 70);  color:oklch(0.40 0.12 60); }
        .lmp-chip.sat   { background:oklch(0.93 0.05 160); color:oklch(0.38 0.10 160); }
        .lmp-chip.plus  { background:oklch(0.93 0.05 20);  color:oklch(0.42 0.12 20); }
        .lmp-chip.moon  { background:oklch(0.93 0.05 290); color:oklch(0.40 0.11 290); }
        .lmp-chip.break { background:oklch(0.93 0.05 230); color:oklch(0.42 0.10 240); }
        @media (max-width:540px) { .lmp-assign-grid { opacity:0.55; } }
        /* form element classes — enables media query overrides on inline-styled nodes */
        .lmp-form-title { font-size:26px; line-height:1.18; letter-spacing:-0.8px; font-weight:700; margin:0 0 18px; color:#14171C; }
        .lmp-tabs-bar { display:inline-flex; background:rgba(20,23,28,0.06); padding:3px; border-radius:10px; margin-bottom:18px; position:relative; }
        .lmp-socials { display:flex; flex-direction:column; gap:8px; margin-bottom:14px; }
        .lmp-social-btn { display:flex; align-items:center; justify-content:center; gap:10px; width:100%; height:42px; font:inherit; font-size:13.5px; font-weight:600; letter-spacing:-0.2px; border-radius:10px; border:1px solid rgba(20,23,28,0.09); background:#fff; color:#14171C; cursor:pointer; white-space:nowrap; transition:background .12s,border-color .12s,transform .12s; }
        .lmp-social-btn-kakao { background:#FEE500; color:#181600; border-color:transparent; }
        .lmp-divider { display:flex; align-items:center; gap:10px; margin:4px 0 12px; color:#8A8F99; font-size:11.5px; font-weight:500; }
        .lmp-field { margin-bottom:10px; }
        .lmp-submit-btn { width:100%; height:46px; background:#14171C; color:#fff; border:0; border-radius:12px; font:inherit; font-size:14px; font-weight:600; letter-spacing:-0.2px; cursor:pointer; box-shadow:0 1px 0 rgba(20,23,28,0.06),0 8px 20px -8px rgba(20,23,28,0.30); display:flex; align-items:center; justify-content:center; gap:8px; transition:transform .12s; }
        .lmp-submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
        @media (max-width:540px) {
          .lmp-form-title { font-size:22px; margin-bottom:14px; }
          .lmp-form-title br { display:none; }
          .lmp-tabs-bar { margin-bottom:14px; }
          .lmp-socials { gap:7px; margin-bottom:12px; }
          .lmp-social-btn { height:40px; font-size:13px; }
          .lmp-field { margin-bottom:9px; }
          .lmp-submit-btn { height:44px; font-size:13.5px; }
        }
        @media (max-height:620px) and (min-width:541px) {
          .lmp-form-title { font-size:22px; margin-bottom:14px; }
          .lmp-socials { gap:7px; margin-bottom:10px; }
          .lmp-social-btn { height:38px; font-size:13px; }
          .lmp-divider { margin:2px 0 10px; }
          .lmp-field { margin-bottom:8px; }
          .lmp-submit-btn { height:42px; }
        }
      `}</style>

      <div className="lmp">
        {/* background layers */}
        <div className="lmp-bg-grid" aria-hidden="true" />
        <div className="lmp-bg-digit" aria-hidden="true">
          {monthStr}<span className="sm">月</span>
          <span className="lbl">{monthName} {yearNum}</span>
        </div>
        <div className="lmp-bg-now" aria-hidden="true" />
        <div className="lmp-assign-grid" ref={assignGridRef} aria-hidden="true" />

        {/* Row 1 — brand bar */}
        <header className="lmp-brand-bar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="32" height="32" style={{ flexShrink:0, borderRadius:8, overflow:'hidden' }}>
              <rect width="512" height="512" rx="112" fill="#FBF9F4"/>
              <rect x="64"     y="142.8" width="55.67" height="68.8" rx="16" fill="oklch(0.85 0.10 70)"/>
              <rect x="129.67" y="142.8" width="55.67" height="68.8" rx="16" fill="oklch(0.66 0.16 28)"/>
              <rect x="326.67" y="142.8" width="55.67" height="68.8" rx="16" fill="oklch(0.78 0.09 230)"/>
              <rect x="392.33" y="142.8" width="55.67" height="68.8" rx="16" fill="oklch(0.75 0.10 160)"/>
              <rect x="64"     y="221.6" width="55.67" height="68.8" rx="16" fill="oklch(0.72 0.10 290)"/>
              <rect x="129.67" y="221.6" width="55.67" height="68.8" rx="16" fill="oklch(0.85 0.10 70)"/>
              <rect x="326.67" y="221.6" width="55.67" height="68.8" rx="16" fill="oklch(0.66 0.16 28)"/>
              <rect x="392.33" y="221.6" width="55.67" height="68.8" rx="16" fill="oklch(0.78 0.09 230)"/>
              <rect x="64"     y="300.4" width="55.67" height="68.8" rx="16" fill="oklch(0.75 0.10 160)"/>
              <rect x="129.67" y="300.4" width="55.67" height="68.8" rx="16" fill="oklch(0.72 0.10 290)"/>
              <rect x="326.67" y="300.4" width="55.67" height="68.8" rx="16" fill="oklch(0.85 0.10 70)"/>
              <rect x="392.33" y="300.4" width="55.67" height="68.8" rx="16" fill="oklch(0.66 0.16 28)"/>
              <rect x="64"     y="379.2" width="55.67" height="68.8" rx="16" fill="oklch(0.78 0.09 230)"/>
              <rect x="129.67" y="379.2" width="55.67" height="68.8" rx="16" fill="oklch(0.75 0.10 160)"/>
              <rect x="326.67" y="379.2" width="55.67" height="68.8" rx="16" fill="oklch(0.72 0.10 290)"/>
              <rect x="392.33" y="379.2" width="55.67" height="68.8" rx="16" fill="oklch(0.85 0.10 70)"/>
            </svg>
            <span style={{ fontSize:15, fontWeight:600, letterSpacing:-0.2, color:'#14171C', whiteSpace:'nowrap' }}>스케줄러</span>
            <span className="lmp-brand-pill">WORKSPACE</span>
          </div>
          <div className="lmp-top-nav">
            {mode === 'signup' && (
              <>
                <span className="lmp-nav-hint">이미 계정이 있나요?</span>
                <button className="lmp-nav-btn" onClick={() => switchMode('login')}>로그인</button>
              </>
            )}
            {!hideCancelButton && (
              <button className="lmp-nav-btn" onClick={onClose}>닫기</button>
            )}
          </div>
        </header>

        {/* Row 2 — day strip */}
        <div className="lmp-day-strip" aria-hidden="true">
          <div className="lmp-day-corner">W{String(weekNum).padStart(2,'0')}</div>
          {DAY_LABELS.map((d, i) => {
            const isToday = (i + 1) % 7 === todayDow
            return (
              <div key={d} className={`lmp-day-cell${i===5?' sat':i===6?' sun':''}${isToday?' today':''}`}>{d}</div>
            )
          })}
        </div>

        {/* Col 1 — time gutter */}
        <aside className="lmp-time-gutter" aria-hidden="true">
          {TIME_TICKS.map((t, i) => (
            <div key={i} className={`lmp-tick${t==='·'?' lunch':''}`}>{t}</div>
          ))}
        </aside>

        {/* Col 2 — stage + form card */}
        <main className="lmp-stage">
          <div className="lmp-card">
            {success ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:'oklch(0.96 0.04 145)', display:'grid', placeItems:'center', margin:'0 auto 16px', fontSize:22 }}>✓</div>
                <p style={{ color:'#6B7280', fontSize:14, marginBottom:20, lineHeight:1.5 }}>{success}</p>
                <button onClick={() => { setSuccess(null); switchMode('login') }} style={{ color:accent, fontSize:14, fontWeight:500, background:'none', border:'none', cursor:'pointer', font:'inherit' }}>로그인하러 가기 →</button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:11, color:accent, fontWeight:700, marginBottom:6, letterSpacing:'1.2px', textTransform:'uppercase' as const }}>
                  {mode === 'login' ? 'WELCOME BACK' : 'JOIN US'}
                </div>
                <h2 className="lmp-form-title">
                  {mode === 'login' ? <>다시 만나서<br />반가워요 👋</> : <>새로 오셨나요?<br />반갑습니다 🙌</>}
                </h2>

                {/* tabs */}
                <div className="lmp-tabs-bar">
                  <div style={{ position:'absolute', top:3, height:'calc(100% - 6px)', background:'#fff', borderRadius:8, boxShadow:'0 1px 0 rgba(20,23,28,0.04),0 2px 6px -2px rgba(20,23,28,0.10)', transition:'transform .25s cubic-bezier(.4,0,.2,1),width .25s cubic-bezier(.4,0,.2,1)', zIndex:0, width:pillStyle.width, transform:`translateX(${pillStyle.left}px)` }} />
                  {(['login','signup'] as Mode[]).map(t => (
                    <button key={t} ref={t==='login' ? tabLoginRef : tabSignupRef} onClick={() => switchMode(t)}
                      style={{ padding:'7px 14px', fontSize:12.5, fontWeight:600, color:mode===t?'#14171C':'#6B7280', border:0, background:'transparent', borderRadius:8, position:'relative', zIndex:1, cursor:'pointer', font:'inherit', transition:'color .15s', whiteSpace:'nowrap' }}>
                      {t === 'login' ? '로그인' : '회원가입'}
                    </button>
                  ))}
                </div>

                {socialPending ? (
                  <div>
                    <p style={{ fontSize:13, color:'#6B7280', marginBottom:14, lineHeight:1.5 }}>
                      <strong style={{ color:'#353A44' }}>{socialPending === 'google' ? 'Google' : '카카오'}</strong> 계정으로 가입하기 전에 조직과 활동 유형을 선택해주세요.
                    </p>
                    <div className="lmp-field">
                      <label style={{ display:'block', fontSize:11.5, fontWeight:600, color:'#353A44', marginBottom:5 }}>가입할 조직 *</label>
                      <select value={tenantId} onChange={e => setTenantId(e.target.value)} style={{ ...inputSt, padding:'0 14px', appearance:'none' as const }}>
                        <option value="">조직을 선택하세요</option>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    {tenantId && (
                      <div className="lmp-field">
                        <label style={{ display:'block', fontSize:11.5, fontWeight:600, color:'#353A44', marginBottom:5 }}>활동 유형 *</label>
                        {tenantRoles === null
                          ? <p style={{ fontSize:12, color:'#8A8F99', margin:0 }}>로딩 중...</p>
                          : hasCustomRoles ? (
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                              {tenantRoles.map(tr => (
                                <button key={tr.id} type="button" onClick={() => { setTenantRoleId(tr.id); setRole(null) }}
                                  style={{ padding:'8px 10px', borderRadius:10, fontSize:12.5, fontWeight:600, border:`2px solid ${tenantRoleId===tr.id?accent:'rgba(20,23,28,0.12)'}`, background:tenantRoleId===tr.id?accentSoft:'#fff', color:tenantRoleId===tr.id?accentInk:'#6B7280', cursor:'pointer', font:'inherit', transition:'all .15s' }}>{tr.name}</button>
                              ))}
                            </div>
                          ) : (
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                              {[...effectiveDefaultRoles, { value:'admin' as const, label:'관리자' }].map(opt => (
                                <button key={opt.value} type="button" onClick={() => { setRole(opt.value); setTenantRoleId(null) }}
                                  style={{ padding:'8px 10px', borderRadius:10, fontSize:12.5, fontWeight:600, border:`2px solid ${role===opt.value?accent:'rgba(20,23,28,0.12)'}`, background:role===opt.value?accentSoft:'#fff', color:role===opt.value?accentInk:'#6B7280', cursor:'pointer', font:'inherit', transition:'all .15s' }}>{opt.label}</button>
                              ))}
                            </div>
                          )}
                      </div>
                    )}
                    {error && (
                      <div style={{ margin:'8px 0', padding:'10px 14px', borderRadius:10, background:'oklch(0.97 0.02 25)', border:'1px solid oklch(0.88 0.06 25)', color:'oklch(0.45 0.15 25)', fontSize:13 }}>{error}</div>
                    )}
                    <div style={{ display:'flex', gap:8, marginTop:14 }}>
                      <button type="button" onClick={() => { setSocialPending(null); setError(null); setTenantId(''); setRole(null); setTenantRoleId(null) }}
                        style={{ flex:1, height:44, background:'#F4F1EA', border:'1px solid rgba(20,23,28,0.09)', borderRadius:12, font:'inherit', fontSize:13.5, fontWeight:600, color:'#6B7280', cursor:'pointer' }}>
                        취소
                      </button>
                      <button type="button" disabled={loading} onClick={handleSocialConfirm} className="lmp-submit-btn" style={{ flex:2, marginTop:0, opacity:loading?0.6:1, cursor:loading?'not-allowed':'pointer' }}>
                        {loading ? '처리 중...' : `${socialPending === 'google' ? 'Google' : '카카오'}로 계속`}
                        {!loading && <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12M11 5l5 5-5 5"/></svg>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* social */}
                    <div className="lmp-socials">
                      <button onClick={handleGoogle} disabled={loading} className="lmp-social-btn">
                        <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.1h11.3c-1.5 4.1-5.4 7-11.3 7-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5-5C32.9 5.1 28.7 3.4 24 3.4 12.5 3.4 3.4 12.5 3.4 24S12.5 44.6 24 44.6c11 0 20-8 20-20 0-1.4-.1-2.7-.4-4.1z"/><path fill="#FF3D00" d="M5.3 13.6l5.8 4.3C12.8 14.1 18 11 24 11c3 0 5.8 1.1 7.9 3l5-5C32.9 5.1 28.7 3.4 24 3.4 16.4 3.4 9.8 7.6 5.3 13.6z"/><path fill="#4CAF50" d="M24 44.6c4.6 0 8.7-1.7 11.9-4.5l-5.5-4.6c-1.7 1.3-3.9 2.1-6.4 2.1-5.8 0-10.7-3.9-11.2-7H7v4.7C10.5 40.6 16.8 44.6 24 44.6z"/><path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.1h11.3c-.7 2-2 3.7-3.6 5l5.5 4.6c-.4.4 5.8-4.2 5.8-13.2 0-1.4-.1-2.7-.4-3.4z"/></svg>
                        Google로 계속하기
                      </button>
                      <button onClick={handleKakao} disabled={loading} className="lmp-social-btn lmp-social-btn-kakao">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.7-.7 2.7-.8 3.1-.1.5.2.5.4.4.2-.1 2.6-1.7 3.6-2.4.7.1 1.4.2 2.1.2 5.5 0 10-3.6 10-8s-4.5-8-10-8Z"/></svg>
                        카카오로 계속하기
                      </button>
                    </div>

                    <div className="lmp-divider">
                      <div style={{ flex:1, height:1, background:'rgba(20,23,28,0.12)' }} />또는 이메일로 계속<div style={{ flex:1, height:1, background:'rgba(20,23,28,0.12)' }} />
                    </div>

                    <form onSubmit={handleSubmit}>
                  {mode === 'signup' && (
                    <>
                      <div className="lmp-field">
                        <label style={{ display:'block', fontSize:11.5, fontWeight:600, color:'#353A44', marginBottom:5 }}>가입할 조직 *</label>
                        <select value={tenantId} onChange={e => setTenantId(e.target.value)} style={{ ...inputSt, padding:'0 14px', appearance:'none' as const }}>
                          <option value="">조직을 선택하세요</option>
                          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      {tenantId && (
                        <div className="lmp-field">
                          <label style={{ display:'block', fontSize:11.5, fontWeight:600, color:'#353A44', marginBottom:5 }}>활동 유형 *</label>
                          {tenantRoles === null
                            ? <p style={{ fontSize:12, color:'#8A8F99', margin:0 }}>로딩 중...</p>
                            : hasCustomRoles ? (
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                                {tenantRoles.map(tr => (
                                  <button key={tr.id} type="button" onClick={() => { setTenantRoleId(tr.id); setRole(null) }}
                                    style={{ padding:'8px 10px', borderRadius:10, fontSize:12.5, fontWeight:600, border:`2px solid ${tenantRoleId===tr.id?accent:'rgba(20,23,28,0.12)'}`, background:tenantRoleId===tr.id?accentSoft:'#fff', color:tenantRoleId===tr.id?accentInk:'#6B7280', cursor:'pointer', font:'inherit', transition:'all .15s' }}>{tr.name}</button>
                                ))}
                              </div>
                            ) : (
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                                {[...effectiveDefaultRoles, { value:'admin' as const, label:'관리자' }].map(opt => (
                                  <button key={opt.value} type="button" onClick={() => { setRole(opt.value); setTenantRoleId(null) }}
                                    style={{ padding:'8px 10px', borderRadius:10, fontSize:12.5, fontWeight:600, border:`2px solid ${role===opt.value?accent:'rgba(20,23,28,0.12)'}`, background:role===opt.value?accentSoft:'#fff', color:role===opt.value?accentInk:'#6B7280', cursor:'pointer', font:'inherit', transition:'all .15s' }}>{opt.label}</button>
                                ))}
                              </div>
                            )}
                        </div>
                      )}
                      <div className="lmp-field">
                        <label style={{ display:'block', fontSize:11.5, fontWeight:600, color:'#353A44', marginBottom:5 }}>이름</label>
                        <div style={{ position:'relative' }}>
                          <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#8A8F99', display:'flex', pointerEvents:'none' }}>
                            <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="7" r="3"/><path d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6"/></svg>
                          </span>
                          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" style={inputSt} />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="lmp-field">
                    <label style={{ display:'block', fontSize:11.5, fontWeight:600, color:'#353A44', marginBottom:5 }}>이메일</label>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#8A8F99', display:'flex', pointerEvents:'none' }}>
                        <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="m3 6 7 5 7-5"/></svg>
                      </span>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required style={inputSt} />
                    </div>
                  </div>

                  <div className="lmp-field">
                    <label style={{ display:'block', fontSize:11.5, fontWeight:600, color:'#353A44', marginBottom:5 }}>비밀번호</label>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#8A8F99', display:'flex', pointerEvents:'none' }}>
                        <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="9" width="12" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>
                      </span>
                      <input type={showPw?'text':'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호" autoComplete={mode==='login'?'current-password':'new-password'} required style={inputSt} />
                      <button type="button" onClick={() => setShowPw(p => !p)} style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', width:32, height:32, border:0, background:'transparent', borderRadius:6, color:'#8A8F99', display:'grid', placeItems:'center', cursor:'pointer' }}>
                        <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"/><circle cx="10" cy="10" r="2"/></svg>
                      </button>
                    </div>
                  </div>

                  {mode === 'signup' && (
                    <div className="lmp-field">
                      <label style={{ display:'block', fontSize:11.5, fontWeight:600, color:'#353A44', marginBottom:5 }}>비밀번호 확인</label>
                      <div style={{ position:'relative' }}>
                        <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#8A8F99', display:'flex', pointerEvents:'none' }}>
                          <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="9" width="12" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>
                        </span>
                        <input type={showPw?'text':'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="비밀번호 확인" required style={inputSt} />
                      </div>
                    </div>
                  )}

                  {mode === 'login' && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'6px 0 14px', fontSize:12 }}>
                      <span style={{ color:'#353A44' }}>로그인 유지</span>
                      <button type="button" style={{ color:'#6B7280', background:'none', border:'none', cursor:'pointer', font:'inherit', fontSize:12, fontWeight:500 }}>비밀번호를 잊으셨나요?</button>
                    </div>
                  )}

                  {error && (
                    <div style={{ margin:'8px 0', padding:'10px 14px', borderRadius:10, background:'oklch(0.97 0.02 25)', border:'1px solid oklch(0.88 0.06 25)', color:'oklch(0.45 0.15 25)', fontSize:13 }}>{error}</div>
                  )}

                  <button type="submit" disabled={loading} className="lmp-submit-btn" style={{ marginTop:mode==='signup'?12:0, opacity:loading?0.6:1, cursor:loading?'not-allowed':'pointer' }}>
                    {loading ? '처리 중...' : mode==='login' ? '로그인' : '가입하기'}
                    {!loading && <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12M11 5l5 5-5 5"/></svg>}
                  </button>
                </form>
                  </>
                )}
              </>
            )}
          </div>
        </main>

        {/* Row 4 — footer */}
        <footer className="lmp-footer">
          <span>© {yearNum} 스케줄러</span>
          <span className="lmp-foot-dot lmp-hide-sm" />
          <span className="lmp-hide-sm" style={{ color:'#6B7280', cursor:'pointer' }}>서비스 약관</span>
          <span className="lmp-foot-dot lmp-hide-sm" />
          <span className="lmp-hide-sm" style={{ color:'#6B7280', cursor:'pointer' }}>개인정보</span>
          <span style={{ marginLeft:'auto', fontFamily:'"JetBrains Mono",monospace' }}>v1.0</span>
        </footer>
      </div>
    </div>
  )
}
