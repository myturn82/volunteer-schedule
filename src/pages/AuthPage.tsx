import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ScheduleBackground } from '../components/auth/ScheduleBackground'

type Tab       = 'login' | 'signup'
type LoginStep = 'buttons' | 'email' | 'password'
type JoinStep  = 'name' | 'password' | 'confirm' | 'choice' | 'org-name'

const COUNTABLE: JoinStep[] = ['name', 'password', 'confirm', 'org-name']

// ── SVG icons ──────────────────────────────────────────────────
const IGoogle = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.1h11.3c-1.5 4.1-5.4 7-11.3 7-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5-5C32.9 5.1 28.7 3.4 24 3.4 12.5 3.4 3.4 12.5 3.4 24S12.5 44.6 24 44.6c11 0 20-8 20-20 0-1.4-.1-2.7-.4-4.1z"/>
    <path fill="#FF3D00" d="M5.3 13.6l5.8 4.3C12.8 14.1 18 11 24 11c3 0 5.8 1.1 7.9 3l5-5C32.9 5.1 28.7 3.4 24 3.4 16.4 3.4 9.8 7.6 5.3 13.6z"/>
    <path fill="#4CAF50" d="M24 44.6c4.6 0 8.7-1.7 11.9-4.5l-5.5-4.6c-1.7 1.3-3.9 2.1-6.4 2.1-5.8 0-10.7-3.9-11.2-7H7v4.7C10.5 40.6 16.8 44.6 24 44.6z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.1h11.3c-.7 2-2 3.7-3.6 5l5.5 4.6c-.4.4 5.8-4.2 5.8-13.2 0-1.4-.1-2.7-.4-3.4z"/>
  </svg>
)
const IKakao = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.7-.7 2.7-.8 3.1-.1.5.2.5.4.4.2-.1 2.6-1.7 3.6-2.4.7.1 1.4.2 2.1.2 5.5 0 10-3.6 10-8s-4.5-8-10-8Z"/>
  </svg>
)
const IMail = (s = 16) => (
  <svg viewBox="0 0 20 20" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="4.5" width="15" height="11" rx="2.5"/><path d="m3.2 6 6.8 4.8L16.8 6"/>
  </svg>
)
const ILock = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="9" width="12" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>
  </svg>
)
const IUser = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="7" r="3"/><path d="M3.5 17.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5"/>
  </svg>
)
const IEye = () => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"/><circle cx="10" cy="10" r="2.2"/>
  </svg>
)
const IEyeOff = () => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 5.5C2.8 6.9 2 8.7 2 10c0 0 3 5 8 5 1.3 0 2.4-.3 3.4-.8M8 5.2c.6-.1 1.3-.2 2-.2 5 0 8 5 8 5-.5.9-1.2 1.8-2 2.5"/><path d="m4 4 12 12"/>
  </svg>
)
const IArrow = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10h12M11 5l5 5-5 5"/>
  </svg>
)
const IBack = () => (
  <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 10H4M9 5l-5 5 5 5"/>
  </svg>
)
const IClose = () => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
    <path d="m5 5 10 10M15 5 5 15"/>
  </svg>
)
const ICheck = () => (
  <svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 10 4 4 8-9"/>
  </svg>
)
const ISpark = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/>
    <rect x="14" y="3" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/>
  </svg>
)
const IJoin = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="m10 8 4 4-4 4"/><path d="M14 12H4"/>
  </svg>
)
const IPlus = () => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2v16M2 10h16"/>
  </svg>
)

export function AuthPage() {
  const { profile, signIn, signUp, signInWithGoogle, signInWithKakao } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const initTab = searchParams.get('tab') === 'login' ? 'login' : 'signup'
  const [tab, setTab] = useState<Tab>(initTab)

  const signupInProgress = useRef(false)

  // Login
  const [loginStep, setLoginStep] = useState<LoginStep>('buttons')
  const [loginEmail, setLoginEmail] = useState(() => localStorage.getItem('lastLoginEmail') ?? '')
  const [loginPw, setLoginPw] = useState('')
  const [showLoginPw, setShowLoginPw] = useState(false)

  // Signup
  const [signupEmailInCard, setSignupEmailInCard] = useState(false)
  const [joinEmail, setJoinEmail] = useState('')

  // Wizard popup
  const [wizOpen, setWizOpen] = useState(false)
  const [joinStep, setJoinStep] = useState<JoinStep>('name')
  const [joinName, setJoinName] = useState('')
  const [joinPw, setJoinPw] = useState('')
  const [joinConfirm, setJoinConfirm] = useState('')
  const [orgName, setOrgName] = useState('')
  const [showJoinPw, setShowJoinPw] = useState(false)
  const [wizChoice, setWizChoice] = useState<'service' | 'join'>('service')

  // Shared
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (profile && !signupInProgress.current) navigate('/', { replace: true })
  }, [profile, navigate])

  function switchTab(t: Tab) {
    signupInProgress.current = false
    setTab(t); setError(null)
    setLoginStep('buttons')
    setSignupEmailInCard(false); setWizOpen(false)
    setJoinStep('name')
  }

  function closeWiz() {
    signupInProgress.current = false
    setWizOpen(false); setError(null)
    setSignupEmailInCard(true)
  }

  // ── handlers ──────────────────────────────────────────────────

  async function handleLogin() {
    if (!loginEmail.trim() || !loginPw) { setError('이메일과 비밀번호를 입력해 주세요.'); return }
    setError(null); setLoading(true)
    const err = await signIn(loginEmail, loginPw)
    setLoading(false)
    if (err) setError(err)
    else { localStorage.setItem('lastLoginEmail', loginEmail); navigate('/', { replace: true }) }
  }

  async function handleEmailNext() {
    if (!joinEmail.trim() || !joinEmail.includes('@')) { setError('올바른 이메일을 입력해 주세요.'); return }
    setLoading(true); setError(null)
    const { data } = await supabase.from('profiles').select('id').eq('email', joinEmail.trim()).maybeSingle()
    setLoading(false)
    if (data) { setError('이미 가입된 이메일입니다. 로그인을 이용해 주세요.'); return }
    signupInProgress.current = true
    setSignupEmailInCard(false)
    setJoinStep('name')
    setWizOpen(true)
  }

  async function handleSignUpOnly() {
    setLoading(true); setError(null)
    // signUp 도중 App.tsx가 PendingPage로 전환되기 전에 먼저 세팅
    localStorage.setItem('vs_pending_mode', 'join-org')
    const err = await signUp(joinEmail.trim(), joinPw, joinName.trim(), 'volunteer', '')
    setLoading(false)
    if (err) {
      localStorage.removeItem('vs_pending_mode')
      setError(err); return
    }
    window.location.href = '/'
  }

  async function handleJoinSubmit() {
    if (!orgName.trim()) { setError('서비스 이름을 입력해 주세요.'); return }
    setLoading(true); setError(null)
    const err = await signUp(joinEmail.trim(), joinPw, joinName.trim(), 'volunteer', '')
    if (err) { setLoading(false); setError(err); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setError('인증 오류가 발생했습니다.'); return }
    const { error: custErr } = await supabase
      .from('customers')
      .insert({ name: orgName.trim(), owner_user_id: user.id, plan: 'basic' })
    setLoading(false)
    if (custErr) { setError(`조직 생성 오류: ${custErr.message}`); return }
    window.location.href = '/'
  }

  async function handleGoogle() {
    setLoading(true); setError(null)
    const err = await signInWithGoogle()
    setLoading(false); if (err) setError(err)
  }

  async function handleKakao() {
    setLoading(true); setError(null)
    const err = await signInWithKakao()
    setLoading(false); if (err) setError(err)
  }

  // ── wizard dots ───────────────────────────────────────────────
  const stepIdx = (joinStep === 'choice' || joinStep === 'org-name')
    ? COUNTABLE.length - 1
    : COUNTABLE.indexOf(joinStep)

  // ── top nav ───────────────────────────────────────────────────
  const topNavSlot = (
    <>
      <span className="lmp-nav-hint">{tab === 'login' ? '계정이 없으신가요?' : '이미 계정이 있나요?'}</span>
      <button className="lmp-nav-btn" onClick={() => switchTab(tab === 'login' ? 'signup' : 'login')}>
        {tab === 'login' ? '회원가입' : '로그인'}
      </button>
    </>
  )

  // ── password field helper ─────────────────────────────────────
  function PwField({ value, onChange, placeholder, show, onToggle, onEnter }: {
    value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder: string; show: boolean; onToggle: () => void; onEnter?: () => void
  }) {
    return (
      <div className="af-input-wrap">
        <span className="af-input-ic"><ILock /></span>
        <input className="af-input" type={show ? 'text' : 'password'} value={value}
          onChange={onChange} placeholder={placeholder} autoComplete="new-password" autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter() }} />
        <button type="button" className="af-input-eye" onClick={onToggle} aria-label="비밀번호 표시">
          {show ? <IEyeOff /> : <IEye />}
        </button>
      </div>
    )
  }

  return (
    <ScheduleBackground topNavSlot={topNavSlot}>

      {/* ── Main card ── */}
      <div className="af-card">
        <span className="af-eyebrow">{tab === 'login' ? 'WELCOME BACK' : 'JOIN US'}</span>
        <h2 className="af-title">
          {tab === 'login' ? <>다시 만나서<br />반가워요</> : <>새로 오셨군요<br />반갑습니다</>}
        </h2>

        {/* Segmented tabs */}
        <div className="af-seg">
          <div className="af-seg-ind" style={{ transform: `translateX(${tab === 'signup' ? '100%' : '0%'})` }} />
          {(['login', 'signup'] as Tab[]).map(t => (
            <button key={t} className={`af-seg-btn${tab === t ? ' on' : ''}`} onClick={() => switchTab(t)}>
              {t === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {/* ── Login ── */}
        {tab === 'login' && (
          <>
            {loginStep === 'buttons' && (
              <div className="af-socials">
                <button className="af-btn-social" onClick={handleGoogle} disabled={loading}>
                  <IGoogle /> Google로 계속하기
                </button>
                <button className="af-btn-social kakao" onClick={handleKakao} disabled={loading}>
                  <IKakao /> 카카오로 계속하기
                </button>
                <button className="af-btn-social" disabled={loading} onClick={() => { setError(null); setLoginStep('email') }}>
                  {IMail()} 이메일로 계속하기
                </button>
              </div>
            )}

            {loginStep === 'email' && (
              <>
                <div className="af-field">
                  <label className="af-label">이메일</label>
                  <div className="af-input-wrap">
                    <span className="af-input-ic">{IMail()}</span>
                    <input className="af-input" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                      placeholder="you@example.com" autoComplete="email" autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (!loginEmail.trim() || !loginEmail.includes('@')) { setError('올바른 이메일을 입력해 주세요.'); return }
                          setError(null); setLoginStep('password')
                        }
                      }} />
                  </div>
                </div>
                {error && <div className="af-err">{error}</div>}
                <button className="af-btn af-btn-primary" style={{ marginTop: 6 }} onClick={() => {
                  if (!loginEmail.trim() || !loginEmail.includes('@')) { setError('올바른 이메일을 입력해 주세요.'); return }
                  setError(null); setLoginStep('password')
                }}>
                  계속하기 <IArrow />
                </button>
                <button className="af-back-link" onClick={() => { setLoginStep('buttons'); setError(null) }}>
                  <IBack /> 뒤로
                </button>
              </>
            )}

            {loginStep === 'password' && (
              <>
                <div className="af-recap">{IMail(13)} {loginEmail}</div>
                <div className="af-field">
                  <label className="af-label">비밀번호</label>
                  <div className="af-input-wrap">
                    <span className="af-input-ic"><ILock /></span>
                    <input className="af-input" type={showLoginPw ? 'text' : 'password'} value={loginPw}
                      onChange={e => setLoginPw(e.target.value)} placeholder="비밀번호" autoComplete="current-password" autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleLogin() }} />
                    <button type="button" className="af-input-eye" onClick={() => setShowLoginPw(p => !p)}>
                      {showLoginPw ? <IEyeOff /> : <IEye />}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '2px 0 10px' }}>
                  <button style={{ fontSize: 12.5, color: 'var(--ink-500)', fontWeight: 500 }}>비밀번호를 잊으셨나요?</button>
                </div>
                {error && <div className="af-err">{error}</div>}
                <button className="af-btn af-btn-primary" onClick={handleLogin}
                  disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
                  {loading ? '처리 중...' : <> 로그인 <IArrow /></>}
                </button>
                <button className="af-back-link" onClick={() => { setLoginStep('email'); setLoginPw(''); setError(null) }}>
                  <IBack /> 뒤로
                </button>
              </>
            )}
          </>
        )}

        {/* ── Signup ── */}
        {tab === 'signup' && (
          <>
            {!signupEmailInCard ? (
              <div className="af-socials">
                <button className="af-btn-social" onClick={handleGoogle} disabled={loading}>
                  <IGoogle /> Google로 계속하기
                </button>
                <button className="af-btn-social kakao" onClick={handleKakao} disabled={loading}>
                  <IKakao /> 카카오로 계속하기
                </button>
                <button className="af-btn-social" disabled={loading} onClick={() => { setSignupEmailInCard(true); setError(null) }}>
                  {IMail()} 이메일로 계속하기
                </button>
              </div>
            ) : (
              <>
                <div className="af-field">
                  <label className="af-label">이메일</label>
                  <div className="af-input-wrap">
                    <span className="af-input-ic">{IMail()}</span>
                    <input className="af-input" type="email" value={joinEmail} onChange={e => setJoinEmail(e.target.value)}
                      placeholder="you@example.com" autoComplete="email" autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleEmailNext() }} />
                  </div>
                </div>
                {error && <div className="af-err">{error}</div>}
                <button className="af-btn af-btn-primary" style={{ marginTop: 6, opacity: loading ? 0.6 : 1 }}
                  disabled={loading} onClick={handleEmailNext}>
                  {loading ? '확인 중...' : <> 계속하기 <IArrow /></>}
                </button>
                <button className="af-back-link" onClick={() => { setSignupEmailInCard(false); setError(null) }}>
                  <IBack /> 취소
                </button>
              </>
            )}
            <p className="af-legal">
              가입 시{' '}
              <a onClick={() => navigate('/consent')}>서비스 약관</a>{' '}및{' '}
              <a onClick={() => navigate('/consent')}>개인정보 처리방침</a>에 동의하게 됩니다.
            </p>
          </>
        )}
      </div>

      {/* ── Wizard popup ── */}
      {wizOpen && (
        <>
          <div className="af-overlay" onClick={closeWiz} />
          <div className="af-popup-layer">
            <div className="af-popup">
              {/* Header: dots + close */}
              <div className="af-popup-head">
                <div className="af-dots">
                  {COUNTABLE.map((_, i) => (
                    <span key={i} className={`af-dot-step${i < stepIdx ? ' done' : i === stepIdx ? ' now' : ''}`} />
                  ))}
                </div>
                <button className="af-popup-x" onClick={closeWiz}><IClose /></button>
              </div>

              {/* name */}
              {joinStep === 'name' && (
                <>
                  <h3 className="af-title sm">이름을 입력하세요</h3>
                  <p className="af-sub">실명으로 입력하면 동료가 알아보기 쉬워요.</p>
                  <div className="af-field">
                    <label className="af-label">이름</label>
                    <div className="af-input-wrap">
                      <span className="af-input-ic"><IUser /></span>
                      <input className="af-input" type="text" value={joinName} onChange={e => setJoinName(e.target.value)}
                        placeholder="홍길동" autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (!joinName.trim()) { setError('이름을 입력해 주세요.'); return }
                            setError(null); setJoinStep('password')
                          }
                        }} />
                    </div>
                  </div>
                  {error && <div className="af-err">{error}</div>}
                  <button className="af-btn af-btn-primary" style={{ marginTop: 6 }} onClick={() => {
                    if (!joinName.trim()) { setError('이름을 입력해 주세요.'); return }
                    setError(null); setJoinStep('password')
                  }}>계속하기 <IArrow /></button>
                  <button className="af-back-link" onClick={closeWiz}><IBack /> 취소</button>
                </>
              )}

              {/* password */}
              {joinStep === 'password' && (
                <>
                  <h3 className="af-title sm">비밀번호를 설정하세요</h3>
                  <p className="af-sub">6자 이상으로 안전하게 만들어 주세요.</p>
                  <div className="af-field">
                    <label className="af-label">비밀번호</label>
                    <PwField value={joinPw} onChange={e => setJoinPw(e.target.value)} placeholder="6자 이상"
                      show={showJoinPw} onToggle={() => setShowJoinPw(p => !p)}
                      onEnter={() => {
                        if (joinPw.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
                        setError(null); setJoinStep('confirm')
                      }} />
                  </div>
                  {error && <div className="af-err">{error}</div>}
                  <button className="af-btn af-btn-primary" style={{ marginTop: 6 }} onClick={() => {
                    if (joinPw.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
                    setError(null); setJoinStep('confirm')
                  }}>계속하기 <IArrow /></button>
                  <button className="af-back-link" onClick={() => { setJoinStep('name'); setError(null) }}><IBack /> 뒤로</button>
                </>
              )}

              {/* confirm */}
              {joinStep === 'confirm' && (
                <>
                  <h3 className="af-title sm">비밀번호를 확인하세요</h3>
                  <p className="af-sub">동일한 비밀번호를 한 번 더 입력해 주세요.</p>
                  <div className="af-field">
                    <label className="af-label">비밀번호 확인</label>
                    <PwField value={joinConfirm} onChange={e => setJoinConfirm(e.target.value)} placeholder="비밀번호 재입력"
                      show={showJoinPw} onToggle={() => setShowJoinPw(p => !p)}
                      onEnter={() => {
                        if (joinPw !== joinConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
                        if (joinPw.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
                        setError(null); setJoinStep('choice')
                      }} />
                  </div>
                  {error && <div className="af-err">{error}</div>}
                  <button className="af-btn af-btn-primary" style={{ marginTop: 6 }} onClick={() => {
                    if (joinPw !== joinConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
                    if (joinPw.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
                    setError(null); setJoinStep('choice')
                  }}>계속하기 <IArrow /></button>
                  <button className="af-back-link" onClick={() => { setJoinStep('password'); setError(null) }}><IBack /> 뒤로</button>
                </>
              )}

              {/* choice */}
              {joinStep === 'choice' && (
                <>
                  <h3 className="af-title sm">어떻게 시작할까요?</h3>
                  <p className="af-sub">가입 후에도 변경할 수 있어요.</p>
                  <div className="af-choices">
                    <button className={`af-choice${wizChoice === 'service' ? ' on' : ''}`} onClick={() => setWizChoice('service')}>
                      <span className="af-choice-ic"><ISpark /></span>
                      <span className="af-choice-body">
                        <span className="af-choice-t">내 서비스 시작하기 <span className="af-badge">BASIC 무료</span></span>
                        <span className="af-choice-d">나만의 조직을 직접 만들고 관리합니다</span>
                      </span>
                      <span className="af-choice-radio"><ICheck /></span>
                    </button>
                    <button className={`af-choice${wizChoice === 'join' ? ' on' : ''}`} onClick={() => setWizChoice('join')}>
                      <span className="af-choice-ic"><IJoin /></span>
                      <span className="af-choice-body">
                        <span className="af-choice-t">기존 조직에 가입하기</span>
                        <span className="af-choice-d">운영 중인 조직에 구성원으로 가입합니다</span>
                      </span>
                      <span className="af-choice-radio"><ICheck /></span>
                    </button>
                  </div>
                  {error && <div className="af-err">{error}</div>}
                  <button className="af-btn af-btn-primary" style={{ marginTop: 8, opacity: loading ? 0.6 : 1 }}
                    disabled={loading}
                    onClick={() => {
                      if (wizChoice === 'service') { setJoinStep('org-name'); setError(null) }
                      else handleSignUpOnly()
                    }}>
                    {loading ? '처리 중...' : <>계속하기 <IArrow /></>}
                  </button>
                  <button className="af-back-link" onClick={() => { setJoinStep('confirm'); setError(null) }}><IBack /> 뒤로</button>
                </>
              )}

              {/* org-name */}
              {joinStep === 'org-name' && (
                <>
                  <h3 className="af-title sm">서비스 이름을 정해주세요</h3>
                  <p className="af-sub">나중에 변경할 수 있어요.</p>
                  <div className="af-field">
                    <label className="af-label">서비스 이름</label>
                    <div className="af-input-wrap">
                      <span className="af-input-ic"><IPlus /></span>
                      <input className="af-input" type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
                        placeholder="예: 홍길동 미용실" autoFocus
                        onKeyDown={e => { if (e.key === 'Enter' && orgName.trim()) handleJoinSubmit() }} />
                    </div>
                  </div>
                  {error && <div className="af-err">{error}</div>}
                  <button className="af-btn af-btn-primary" style={{ marginTop: 6, opacity: loading ? 0.6 : 1 }}
                    disabled={loading} onClick={handleJoinSubmit}>
                    {loading ? '처리 중...' : <>시작하기 <IArrow /></>}
                  </button>
                  <button className="af-back-link" onClick={() => { setJoinStep('choice'); setError(null) }}><IBack /> 뒤로</button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </ScheduleBackground>
  )
}
