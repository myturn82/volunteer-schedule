import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScheduleBackground } from '../components/auth/ScheduleBackground'

const TERMS = {
  tos: {
    title: '서비스 이용약관',
    body: `제1조 (목적)\n본 약관은 스케줄러 서비스의 이용 조건 및 절차, 이용자와 회사의 권리·의무 및 책임사항을 규정합니다.\n\n제2조 (정의)\n'서비스'란 회사가 제공하는 스케줄 관리 플랫폼을 말합니다.\n\n제3조 (약관의 효력)\n본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력을 발생합니다.\n\n제4조 (서비스 이용 제한)\n회사는 이용자가 약관을 위반하거나 서비스의 정상적인 운영을 방해하는 경우 이용을 제한할 수 있습니다.\n\n제5조 (면책 조항)\n회사는 천재지변 등 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.`,
  },
  privacy: {
    title: '개인정보 수집 및 이용 동의',
    body: `수집 항목: 이메일 주소, 이름\n수집 목적: 서비스 회원 가입 및 관리, 본인 확인\n보유 기간: 회원 탈퇴 시까지\n\n위 개인정보 수집·이용에 동의하지 않을 권리가 있으나,\n거부 시 서비스 이용이 제한됩니다.`,
  },
} as const

type DocKey = keyof typeof TERMS

const ICheck = () => (
  <svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 10 4 4 8-9"/>
  </svg>
)
const IArrow = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10h12M11 5l5 5-5 5"/>
  </svg>
)
const IClose = () => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
    <path d="m5 5 10 10M15 5 5 15"/>
  </svg>
)

function CheckRow({ on, label, onToggle, onView }: {
  on: boolean; label: string; onToggle: () => void; onView: () => void
}) {
  return (
    <div className={`af-ck-row${on ? ' on' : ''}`} onClick={onToggle}>
      <div className="af-ck-left">
        <span className="af-ck">{on && <ICheck />}</span>
        <span className="af-lbl">{label}</span>
        <span className="af-ck-tag">필수</span>
      </div>
      <button className="af-ck-view" onClick={e => { e.stopPropagation(); onView() }}>보기</button>
    </div>
  )
}

export function ConsentPage() {
  const navigate = useNavigate()
  const [tos, setTos]         = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [doc, setDoc]         = useState<DocKey | null>(null)
  const canProceed = tos && privacy

  const topNavSlot = (
    <>
      <span className="lmp-nav-hint">이미 계정이 있나요?</span>
      <button className="lmp-nav-btn" onClick={() => navigate('/auth?tab=login')}>로그인</button>
    </>
  )

  return (
    <ScheduleBackground topNavSlot={topNavSlot}>
      <div className="af-card">
        <span className="af-eyebrow">CONSENT</span>
        <h2 className="af-title">서비스 이용 동의</h2>
        <p className="af-sub">서비스를 시작하기 전에 아래 항목에 동의해 주세요.</p>

        {/* 전체 동의 */}
        <div className={`af-consent-all${canProceed ? ' on' : ''}`}
          onClick={() => { const all = canProceed; setTos(!all); setPrivacy(!all) }}>
          <span className="af-ck">
            {canProceed && <span style={{ color: 'var(--ink-900)', display: 'flex' }}><ICheck /></span>}
          </span>
          <span className="af-lbl">전체 동의</span>
        </div>

        <CheckRow on={tos} label="서비스 이용약관 동의" onToggle={() => setTos(v => !v)} onView={() => setDoc('tos')} />
        <CheckRow on={privacy} label="개인정보 수집 및 이용 동의" onToggle={() => setPrivacy(v => !v)} onView={() => setDoc('privacy')} />

        <button className="af-btn af-btn-primary" disabled={!canProceed}
          style={{ marginTop: 18 }}
          onClick={() => navigate('/auth?tab=signup')}>
          동의 및 계속하기 {canProceed && <IArrow />}
        </button>
      </div>

      {/* 약관 상세 모달 */}
      {doc && (
        <>
          <div className="af-overlay" style={{ zIndex: 210 }} onClick={() => setDoc(null)} />
          <div className="af-popup-layer" style={{ zIndex: 211 }}>
            <div className="af-doc">
              <div className="af-doc-head">
                <span className="af-doc-title">{TERMS[doc].title}</span>
                <button className="af-popup-x" onClick={() => setDoc(null)}><IClose /></button>
              </div>
              <div className="af-doc-body">
                <p>{TERMS[doc].body}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </ScheduleBackground>
  )
}
