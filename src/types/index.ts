// TimeSlot is now a plain string (e.g. '10-12', '09-10') generated
// dynamically from tenant settings via generateTimeSlots().
export type TimeSlot = string;

// Legacy default slots for the volunteer org — components should prefer
// the timeSlots array from TenantContext instead.
export const TIME_SLOTS: TimeSlot[] = [
  '10-12', '12-13', '13-14', '14-16', '16-18', '20-22',
];

export const DEFAULT_MAX_CAPACITY = 2;

// ─── Tenant types ─────────────────────────────────────────────────────────────

export interface TenantSettings {
  open_from: string;               // 'HH:MM'
  open_to: string;                 // 'HH:MM'
  slot_interval_minutes: number;
  time_slots?: string[];           // Explicit slot list; overrides auto-generation when present
  title: string;
  theme_color?: string;            // '#RRGGBB'
  timezone: string;                // IANA tz, e.g. 'Asia/Seoul'
  locale: string;                  // e.g. 'ko-KR'
  tenant_mode?: '직접입력' | '회원선택';
  slot_labels?: Record<string, string>;
  legend_items?: LegendItem[];
}

export type LegendColor = 'amber' | 'pink' | 'slate' | 'yellow' | 'blue' | 'green' | 'purple' | 'red' | 'indigo'

export interface LegendItem {
  id: string
  icon: string
  label: string
  color: LegendColor
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  business_type: string | null;
  settings: TenantSettings;
  created_at: string;
  updated_at: string;
}

// Access level within a tenant (controls RLS / admin permissions)
export type TenantAccessRole = 'admin' | 'member';

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TenantAccessRole;
  role_id: string | null;          // FK → tenant_roles.id
  created_at: string;
}

// Custom role entity defined per-tenant
export interface TenantRole {
  id: string;
  tenant_id: string;
  name: string;
  split_cell: boolean;
  requires_customer_info: boolean;
  display_order: number;
  created_at: string;
}

export interface TenantMemberWithRole extends TenantMember {
  profile: Profile;
  tenant_role: TenantRole | null;
}

export type UserRole = 'admin' | 'team_leader' | 'volunteer' | '50plus';
export type VolunteerType = 'volunteer' | '50plus' | 'admin_note';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  team_leader: '팀장',
  volunteer: '자원봉사자',
  '50plus': '50플러스활동가',
};

export const TYPE_LABELS: Record<VolunteerType, string> = {
  volunteer: '자원봉사자',
  '50plus': '50플러스활동가',
  admin_note: '관리자 메모',
};

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_super_admin: boolean;
  created_at: string;
}

export interface Assignment {
  id: string;
  tenant_id: string;
  year: number;
  month: number;
  day: number;
  time_slot: TimeSlot;
  volunteer_name: string;
  note: string | null;
  volunteer_type: VolunteerType;
  time_sub: string | null;
  color: string | null;
  user_id: string;
  role_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
}

export interface SlotSetting {
  id: string;
  tenant_id: string;
  time_slot: TimeSlot;
  max_capacity: number;
  updated_by: string | null;
}

export interface ScheduleRule {
  id: string;
  tenant_id: string;
  day_of_week: number; // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  time_slot: TimeSlot;
  is_open: boolean;
}

export interface DateOverride {
  id: string;
  tenant_id: string;
  date: string; // 'YYYY-MM-DD'
  is_open: boolean;
  is_holiday: boolean;
  label: string | null;
}

export interface CellState {
  isBreaktime: boolean;
  isClosed: boolean;
  isHoliday: boolean;
  isNightShift: boolean;
  isSaturdayShift: boolean;
  assignments: Assignment[];
  maxCapacity: number;
  isFull: boolean;
}

export interface ModalTarget {
  year: number;
  month: number;
  day: number;
  timeSlot: TimeSlot;
  volunteerType: VolunteerType;
  roleId?: string | null;
}
