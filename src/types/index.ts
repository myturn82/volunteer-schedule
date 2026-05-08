export type TimeSlot =
  | '10-12'
  | '12-13'
  | '13-14'
  | '14-16'
  | '16-18'
  | '18-20'
  | '20-22';

export const TIME_SLOTS: TimeSlot[] = [
  '10-12', '12-13', '13-14', '14-16', '16-18', '18-20', '20-22',
];

export type UserRole = 'admin' | 'volunteer';

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
}
