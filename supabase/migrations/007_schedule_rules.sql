-- 007_schedule_rules.sql
-- 수요일 13-14, 14-16 시간대 운영 규칙 추가
insert into schedule_rules (day_of_week, time_slot, is_open)
values
  (3, '13-14', true),
  (3, '14-16', true)
on conflict (day_of_week, time_slot) do update set is_open = true;
