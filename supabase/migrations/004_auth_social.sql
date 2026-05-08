-- supabase/migrations/004_auth_social.sql

-- 1. profiles 테이블에 email, avatar_url 컬럼 추가
alter table profiles add column if not exists email text;
alter table profiles add column if not exists avatar_url text;

-- 2. Auth 트리거 업데이트: 소셜 로그인(Google/Kakao) 메타데이터 처리
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_url, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    'volunteer'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 3. RLS 재귀 방지용 security definer 함수
create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  )
$$ language sql security definer stable;

-- 4. 관리자가 다른 사용자의 역할 수정 가능하도록 정책 추가
create policy "profiles_admin_update" on profiles
  for update using (public.is_admin());
