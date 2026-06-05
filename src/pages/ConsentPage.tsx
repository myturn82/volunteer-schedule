import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const MODAL_CONTENT = {
  tos: {
    title: '서비스 이용약관',
    body: `제1조 (목적)\n본 약관은 스케줄러 서비스의 이용 조건 및 절차, 이용자와 회사의 권리·의무 및 책임사항을 규정합니다.\n\n제2조 (정의)\n'서비스'란 회사가 제공하는 스케줄 관리 플랫폼을 말합니다.\n\n제3조 (약관의 효력)\n본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력을 발생합니다.\n\n제4조 (서비스 이용 제한)\n회사는 이용자가 약관을 위반하거나 서비스의 정상적인 운영을 방해하는 경우 이용을 제한할 수 있습니다.\n\n제5조 (면책 조항)\n회사는 천재지변 등 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.`,
  },
  privacy: {
    title: '개인정보 수집 및 이용 동의',
    body: `수집 항목: 이메일 주소, 이름\n수집 목적: 서비스 회원 가입 및 관리, 본인 확인\n보유 기간: 회원 탈퇴 시까지\n\n위 개인정보 수집·이용에 동의하지 않을 권리가 있으나,\n거부 시 서비스 이용이 제한됩니다.`,
  },
  marketing: {
    title: '마케팅 정보 수신 동의',
    body: `수집 항목: 이메일 주소\n목적: 서비스 업데이트, 이벤트 및 프로모션 안내\n보유 기간: 동의 철회 시까지\n\n본 동의는 선택 사항으로, 동의하지 않아도 서비스 이용이 가능합니다.`,
  },
} as const

type ModalKey = keyof typeof MODAL_CONTENT

function CheckRow({
  checked, onChange, label, badge, required, onView,
}: {
  checked: boolean
  onChange: () => void
  label: string
  badge: string
  required: boolean
  onView: () => void
}) {
  return (
    <div
      onClick={onChange}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderRadius: 12, marginBottom: 8, cursor: 'pointer',
        border: `1px solid ${checked ? 'rgba(20,23,28,0.12)' : 'rgba(20,23,28,0.07)'}`,
        background: checked ? 'oklch(0.97 0.03 28)' : '#FBF9F4',
        transition: 'all .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          border: `2px solid ${checked ? 'oklch(0.66 0.16 28)' : 'rgba(20,23,28,0.16)'}`,
          background: checked ? 'oklch(0.66 0.16 28)' : '#fff',
          display: 'grid', placeItems: 'center', transition: 'all .15s',
        }}>
          {checked && (
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5"/>
            </svg>
          )}
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#14171C' }}>{label}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
          background: required ? 'oklch(0.95 0.04 28)' : 'rgba(20,23,28,0.05)',
          color: required ? 'oklch(0.50 0.18 28)' : '#8A8F99', whiteSpace: 'nowrap',
        }}>{badge}</span>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onView() }}
        style={{
          fontSize: 12, fontWeight: 600, color: 'oklch(0.66 0.16 28)',
          background: 'oklch(0.96 0.04 28)', border: 'none', borderRadius: 8,
          padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
        }}
      >보기</button>
    </div>
  )
}

export function ConsentPage() {
  const navigate = useNavigate()
  const [tos, setTos]             = useState(false)
  const [privacy, setPrivacy]     = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [modal, setModal]         = useState<ModalKey | null>(null)
  const canProceed = tos && privacy

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F4F1EA', padding: '24px 16px',
      fontFamily: '"Pretendard Variable", Pretendard, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased', color: '#14171C',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, marginBottom: 18,
            fontSize: 12, color: '#8A8F99', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}
        >
          ← 뒤로
        </button>

        <div style={{
          background: '#fff', border: '1px solid rgba(20,23,28,0.07)', borderRadius: 18,
          padding: '28px 28px 26px',
          boxShadow: '0 1px 0 rgba(20,23,28,0.03), 0 22px 60px -28px rgba(20,23,28,0.22)',
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono",monospace', fontSize: 11,
            color: 'oklch(0.66 0.16 28)', fontWeight: 700, marginBottom: 6,
            letterSpacing: '1.2px', textTransform: 'uppercase' as const,
          }}>
            CONSENT
          </div>
          <h2 style={{ fontSize: 22, lineHeight: 1.2, letterSpacing: '-0.6px', fontWeight: 700, margin: '0 0 6px', color: '#14171C' }}>
            서비스 이용 동의
          </h2>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 22px', lineHeight: 1.55 }}>
            서비스를 시작하기 전에 아래 항목에 동의해 주세요.
          </p>

          <CheckRow
            checked={tos} onChange={() => setTos(v => !v)}
            label="서비스 이용약관 동의" badge="필수" required
            onView={() => setModal('tos')}
          />
          <CheckRow
            checked={privacy} onChange={() => setPrivacy(v => !v)}
            label="개인정보 수집 및 이용 동의" badge="필수" required
            onView={() => setModal('privacy')}
          />
          <CheckRow
            checked={marketing} onChange={() => setMarketing(v => !v)}
            label="마케팅 정보 수신 동의" badge="선택" required={false}
            onView={() => setModal('marketing')}
          />

          <button
            disabled={!canProceed}
            onClick={() => navigate('/auth?tab=signup')}
            style={{
              width: '100%', height: 46, marginTop: 18,
              background: canProceed ? '#14171C' : 'rgba(20,23,28,0.10)',
              color: canProceed ? '#fff' : '#8A8F99',
              border: 0, borderRadius: 12, fontFamily: 'inherit', fontSize: 14,
              fontWeight: 600, cursor: canProceed ? 'pointer' : 'not-allowed',
              transition: 'background .15s, color .15s',
            }}
          >
            동의 및 계속하기
          </button>
        </div>
      </div>

      {modal && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60 }}
            onClick={() => setModal(null)}
          />
          <div style={{
            position: 'fixed', inset: 0, zIndex: 61,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px 16px', pointerEvents: 'none',
          }}>
            <div
              style={{
                background: '#fff', borderRadius: 18, width: '100%', maxWidth: 440,
                maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 4px 40px rgba(20,23,28,0.18)', pointerEvents: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '18px 20px 16px', borderBottom: '1px solid rgba(20,23,28,0.07)',
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#14171C' }}>
                  {MODAL_CONTENT[modal].title}
                </span>
                <button
                  onClick={() => setModal(null)}
                  style={{
                    width: 32, height: 32, border: 0, background: 'rgba(20,23,28,0.05)',
                    borderRadius: 8, fontSize: 18, cursor: 'pointer', display: 'grid',
                    placeItems: 'center', color: '#6B7280', fontFamily: 'inherit',
                  }}
                >×</button>
              </div>
              <div style={{ overflowY: 'auto', padding: '18px 20px 22px', flex: 1 }}>
                <p style={{
                  fontSize: 13.5, color: '#353A44', lineHeight: 1.7,
                  whiteSpace: 'pre-line', margin: 0,
                }}>
                  {MODAL_CONTENT[modal].body}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
