export type TimeSlot =
  | '10-12'
  | '12-13'
  | '13-14'
  | '14-16'
  | '16-18'
  | '20-22';

export const TIME_SLOTS: TimeSlot[] = [
  '10-12', '12-13', '13-14', '14-16', '16-18', '20-22',
];

export const DEFAULT_MAX_CAPACITY = 2;

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
  created_at: string;
}

export interface Assignment {
  id: string;
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
  created_at: string;
}

export interface SlotSetting {
  id: string;
  time_slot: TimeSlot;
  max_capacity: number;
  updated_by: string | null;
}

export interface ScheduleRule {
  id: string;
  day_of_week: number; // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  time_slot: TimeSlot;
  is_open: boolean;
}

export interface DateOverride {
  id: string;
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
}
