import { useState } from 'react'
import { usePlanLimits } from '../../contexts/PlanLimitsContext'
import { PLAN_LABELS } from '../../types'
import type { PlanType, PlanLimitsMap } from '../../types'

const PLANS: PlanType[] = ['basic', 'pro', 'business']

function toInput(n: number): string {
  return n === Infinity ? '' : String(n)
}

function fromInput(v: string): number {
  const trimmed = v.trim()
  if (trimmed === '') return Infinity
  const n = Math.floor(Number(trimmed))
  return Number.isFinite(n) && n >= 0 ? n : Infinity
}

export function PlanLimitsPanel() {
  const { planLimits, updatePlanLimit } = usePlanLimits()
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.3px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-90' : ''}`}><path d="M9 6l6 6-6 6"/></svg>
        플랜 한도 설정
      </button>

      {open && (
        <PlanLimitsTable key={JSON.stringify(planLimits)} planLimits={planLimits} updatePlanLimit={updatePlanLimit} />
      )}
    </div>
  )
}

function PlanLimitsTable({ planLimits, updatePlanLimit }: {
  planLimits: PlanLimitsMap
  updatePlanLimit: (plan: PlanType, limits: { maxOrgs: number; maxUsers: number }) => Promise<string | null>
}) {
  const [drafts, setDrafts] = useState<Record<PlanType, { maxOrgs: string; maxUsers: string }>>(() =>
    Object.fromEntries(PLANS.map(p => [p, { maxOrgs: toInput(planLimits[p].maxOrgs), maxUsers: toInput(planLimits[p].maxUsers) }])) as Record<PlanType, { maxOrgs: string; maxUsers: string }>
  )
  const [savingPlan, setSavingPlan] = useState<PlanType | null>(null)
  const [message, setMessage] = useState('')

  async function handleSave(plan: PlanType) {
    setSavingPlan(plan)
    setMessage('')
    const limits = { maxOrgs: fromInput(drafts[plan].maxOrgs), maxUsers: fromInput(drafts[plan].maxUsers) }
    const error = await updatePlanLimit(plan, limits)
    setMessage(error ? `오류: ${error}` : `${PLAN_LABELS[plan]} 한도가 저장되었습니다.`)
    setSavingPlan(null)
  }

  return (
    <div className="mt-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] overflow-hidden shadow-[var(--shadow-sm)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">플랜</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">최대 조직 수</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">최대 회원 수</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {PLANS.map(plan => (
            <tr key={plan} className="hover:bg-[var(--color-surface-hover)]">
              <td className="px-4 py-3 font-medium text-[var(--color-text-primary)] whitespace-nowrap">{PLAN_LABELS[plan]}</td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  min={0}
                  placeholder="무제한"
                  value={drafts[plan].maxOrgs}
                  onChange={e => setDrafts(prev => ({ ...prev, [plan]: { ...prev[plan], maxOrgs: e.target.value } }))}
                  className="w-24 px-2 py-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  min={0}
                  placeholder="무제한"
                  value={drafts[plan].maxUsers}
                  onChange={e => setDrafts(prev => ({ ...prev, [plan]: { ...prev[plan], maxUsers: e.target.value } }))}
                  className="w-24 px-2 py-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                />
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleSave(plan)}
                  disabled={savingPlan === plan}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-brand-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-colors"
                >
                  {savingPlan === plan ? '저장 중...' : '저장'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {message && (
        <p className={`px-4 py-2 text-xs border-t border-[var(--color-border)] ${message.startsWith('오류') ? 'text-red-500' : 'text-green-600'}`}>
          {message}
        </p>
      )}
      <p className="px-4 py-2 text-[11px] text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
        빈 칸으로 두면 무제한으로 적용됩니다.
      </p>
    </div>
  )
}
