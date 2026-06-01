import { getCellState } from './cellState'
import type { Assignment, SlotSetting, ScheduleRule, DateOverride, TenantRole, VolunteerType } from '../types'
import type { ProfileWithRole } from '../hooks/useProfiles'

export interface ProposedAssignment {
  id: string
  year: number
  month: number
  day: number
  timeSlot: string
  volunteerType: VolunteerType
  roleId: string | null
  userId: string
  userName: string
  roleName: string
  dayLabel: string
}

export interface MemberPreference {
  availableDays: number[] | null  // null = 모든 요일 가능, 0=일,1=월,...,6=토
  monthlyLimit: number | null      // null = 제한없음
}

interface AutoAssignParams {
  days: Date[]
  timeSlots: string[]
  assignments: Assignment[]
  slotSettings: SlotSetting[]
  scheduleRules: ScheduleRule[]
  dateOverrides: DateOverride[]
  profiles: ProfileWithRole[]
  splitRoles: TenantRole[]
  isSplitMode: boolean
  volunteerLabel?: string
  memberPreferences?: Map<string, MemberPreference>  // userId → preference
  roleRatios?: Record<string, number>                // roleId → percent (합계 100)
}

function formatDayLabel(date: Date): string {
  const dow = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
  return `${date.getMonth() + 1}월 ${date.getDate()}일(${dow})`
}

function getEmptySlots(
  days: Date[],
  timeSlots: string[],
  assignments: Assignment[],
  scheduleRules: ScheduleRule[],
  slotSettings: SlotSetting[],
  dateOverrides: DateOverride[],
  isSlotTaken: (year: number, month: number, day: number, slot: string) => boolean,
): { year: number; month: number; day: number; slot: string }[] {
  const result: { year: number; month: number; day: number; slot: string }[] = []
  for (const date of days) {
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    const d = date.getDate()
    for (const slot of timeSlots) {
      const cs = getCellState(d, slot, y, m, scheduleRules, slotSettings, dateOverrides, assignments)
      if (cs.isClosed || cs.isHoliday || cs.isBreaktime) continue
      if (!isSlotTaken(y, m, d, slot)) {
        result.push({ year: y, month: m, day: d, slot })
      }
    }
  }
  return result
}

/**
 * 제약(가능 요일, 월별 횟수 제한)을 적용하는 라운드로빈 배정.
 *
 * - 각 슬롯마다 해당 요일에 가능한 멤버 중 제한을 넘지 않은 멤버를 선택한다.
 * - 공정성을 위해 누적 배정 수가 가장 적은 멤버를 우선 선택한다.
 * - assignCountThisMonth 는 기존 DB 배정 + 새 제안을 모두 반영하며 호출 간 공유된다.
 * - 가능한 멤버가 없으면 해당 슬롯은 건너뛴다(아무도 배정하지 않음).
 */
function roundRobin(
  members: ProfileWithRole[],
  emptySlots: { year: number; month: number; day: number; slot: string }[],
  existingAssignments: Assignment[],
  countMatchFn: (a: Assignment) => boolean,
  volunteerType: VolunteerType,
  roleId: string | null,
  roleName: string,
  memberPreferences: Map<string, MemberPreference> | undefined,
  assignCountThisMonth: Record<string, number>,
): ProposedAssignment[] {
  if (!members.length || !emptySlots.length) return []

  // 타입/역할별 공정 분배를 위한 누적 카운트(기존 DB 배정 반영)
  const countMap = new Map<string, number>()
  members.forEach(m => countMap.set(m.id, 0))
  existingAssignments.forEach(a => {
    if (countMatchFn(a) && countMap.has(a.user_id)) {
      countMap.set(a.user_id, (countMap.get(a.user_id) ?? 0) + 1)
    }
  })

  function isUnderLimit(userId: string): boolean {
    const pref = memberPreferences?.get(userId)
    if (!pref?.monthlyLimit) return true
    return (assignCountThisMonth[userId] ?? 0) < pref.monthlyLimit
  }

  const proposals: ProposedAssignment[] = []

  emptySlots.forEach((s, i) => {
    const dayOfWeek = new Date(s.year, s.month - 1, s.day).getDay()

    function isAvailableOnDay(userId: string): boolean {
      const pref = memberPreferences?.get(userId)
      if (!pref?.availableDays || pref.availableDays.length === 0) return true
      return pref.availableDays.includes(dayOfWeek)
    }

    // 이 슬롯에 배정 가능한 후보: 가능 요일 + 월별 제한 통과
    const candidates = members.filter(m => isAvailableOnDay(m.id) && isUnderLimit(m.id))
    if (!candidates.length) return  // 후보 없으면 슬롯 건너뜀

    // 누적 배정 수가 가장 적은 후보를 선택(동률이면 안정적으로 첫 번째)
    let chosen = candidates[0]
    let chosenCount = countMap.get(chosen.id) ?? 0
    for (const c of candidates) {
      const cnt = countMap.get(c.id) ?? 0
      if (cnt < chosenCount) {
        chosen = c
        chosenCount = cnt
      }
    }

    countMap.set(chosen.id, chosenCount + 1)
    assignCountThisMonth[chosen.id] = (assignCountThisMonth[chosen.id] ?? 0) + 1

    proposals.push({
      id: `${s.year}-${s.month}-${s.day}-${s.slot}-${roleId ?? volunteerType}-${i}`,
      year: s.year,
      month: s.month,
      day: s.day,
      timeSlot: s.slot,
      volunteerType,
      roleId,
      userId: chosen.id,
      userName: chosen.name,
      roleName,
      dayLabel: formatDayLabel(new Date(s.year, s.month - 1, s.day)),
    })
  })

  return proposals
}

export function computeAutoAssignments(params: AutoAssignParams): ProposedAssignment[] {
  const {
    days, timeSlots, assignments, slotSettings, scheduleRules, dateOverrides,
    profiles, splitRoles, isSplitMode, volunteerLabel,
    memberPreferences, roleRatios,
  } = params

  const proposals: ProposedAssignment[] = []

  // 기존 DB 배정에서 현재 달 배정 수 계산(월별 횟수 제한용).
  // 호출 전체에서 공유되어 새 제안이 추가될 때마다 갱신된다.
  const assignCountThisMonth: Record<string, number> = {}
  for (const a of assignments) {
    if (a.user_id) {
      assignCountThisMonth[a.user_id] = (assignCountThisMonth[a.user_id] ?? 0) + 1
    }
  }

  if (isSplitMode) {
    for (const role of splitRoles) {
      const members = profiles.filter(p => p.tenantRoleId === role.id)
      if (!members.length) continue

      const emptySlots = getEmptySlots(
        days, timeSlots, assignments, scheduleRules, slotSettings, dateOverrides,
        (y, m, d, slot) => assignments.some(a =>
          a.year === y && a.month === m && a.day === d &&
          a.time_slot === slot && a.role_id === role.id
        )
      )

      proposals.push(...roundRobin(
        members, emptySlots, assignments,
        (a) => a.role_id === role.id,
        'volunteer',
        role.id,
        role.name,
        memberPreferences,
        assignCountThisMonth,
      ))
    }
  } else {
    for (const { members, volunteerType, roleName } of [
      { members: profiles, volunteerType: 'volunteer' as VolunteerType, roleName: volunteerLabel ?? '자원봉사자' },
    ]) {
      if (!members.length) continue
      const vt = volunteerType

      const emptySlots = getEmptySlots(
        days, timeSlots, assignments, scheduleRules, slotSettings, dateOverrides,
        (y, m, d, slot) => assignments.some(a =>
          a.year === y && a.month === m && a.day === d &&
          a.time_slot === slot && (a.volunteer_type ?? 'volunteer') === vt && !a.role_id
        )
      )

      // 역할 비율 적용: roleRatios 가 있으면 전체 빈슬롯을 역할별 멤버 그룹에
      // 비율만큼 나누어 배정한다. 비율 정보가 없는 멤버는 비율 외 후보로 둔다.
      if (roleRatios && Object.keys(roleRatios).length > 0) {
        const totalSlots = emptySlots.length
        const roleIds = Object.keys(roleRatios)

        // roleId → 해당 역할 멤버 목록
        const membersByRole: Record<string, ProfileWithRole[]> = {}
        for (const rid of roleIds) {
          membersByRole[rid] = members.filter(m => m.tenantRoleId === rid)
        }

        // 비율에 따른 역할별 최대 배정 수 계산
        const totalPercent = roleIds.reduce((sum, rid) => sum + (roleRatios[rid] ?? 0), 0) || 100
        const maxByRole: Record<string, number> = {}
        for (const rid of roleIds) {
          maxByRole[rid] = Math.round((totalSlots * (roleRatios[rid] ?? 0)) / totalPercent)
        }

        const assignedByRole: Record<string, number> = {}
        roleIds.forEach(rid => { assignedByRole[rid] = 0 })

        let slotIndex = 0
        for (const s of emptySlots) {
          const dayOfWeek = new Date(s.year, s.month - 1, s.day).getDay()

          // 아직 한도가 남은 역할 중에서 후보 멤버를 찾는다(라운드로빈 우선순위:
          // 배정 비율 대비 가장 덜 채워진 역할).
          const eligibleRoles = roleIds
            .filter(rid => assignedByRole[rid] < maxByRole[rid] && membersByRole[rid].length > 0)
            .sort((a, b) => {
              const fillA = maxByRole[a] ? assignedByRole[a] / maxByRole[a] : 1
              const fillB = maxByRole[b] ? assignedByRole[b] / maxByRole[b] : 1
              return fillA - fillB
            })

          let placed = false
          for (const rid of eligibleRoles) {
            const result = roundRobin(
              membersByRole[rid], [s], assignments,
              (a) => (a.volunteer_type ?? 'volunteer') === vt,
              vt, null, roleName,
              memberPreferences,
              assignCountThisMonth,
            )
            if (result.length > 0) {
              // 슬롯 인덱스 안정화를 위해 id 재계산
              result[0].id = `${s.year}-${s.month}-${s.day}-${s.slot}-${vt}-${slotIndex}`
              proposals.push(result[0])
              assignedByRole[rid] += 1
              placed = true
              break
            }
          }
          slotIndex++
          if (!placed) continue  // 후보 없으면 슬롯 건너뜀
        }
      } else {
        proposals.push(...roundRobin(
          members, emptySlots, assignments,
          (a) => (a.volunteer_type ?? 'volunteer') === vt,
          vt, null, roleName,
          memberPreferences,
          assignCountThisMonth,
        ))
      }
    }
  }

  return proposals.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    if (a.month !== b.month) return a.month - b.month
    if (a.day !== b.day) return a.day - b.day
    return a.timeSlot.localeCompare(b.timeSlot)
  })
}
