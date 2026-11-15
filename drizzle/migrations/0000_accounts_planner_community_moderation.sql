
create type public.app_role as enum ('admin','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudonym text not null check (char_length(pseudonym) between 2 and 40),
  language text not null default 'ru',
  timezone text not null default 'UTC',
  rules_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text; tz text;
begin
  p := nullif(trim(new.raw_user_meta_data->>'pseudonym'), '');
  if p is null or char_length(p) < 2 then p := 'Участница_' || substr(replace(new.id::text,'-',''),1,5); end if;
  tz := coalesce(nullif(new.raw_user_meta_data->>'timezone',''), 'UTC');
  insert into public.profiles (id, pseudonym, timezone) values (new.id, left(p,40), tz) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- restrictions
create table public.account_restrictions (
  user_id uuid primary key,
  kind text not null check (kind in ('suspended','muted')),
  until timestamptz,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.account_restrictions to authenticated;
grant all on public.account_restrictions to service_role;
alter table public.account_restrictions enable row level security;
create policy "own restriction read" on public.account_restrictions for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin manage restrictions" on public.account_restrictions for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.is_restricted(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_restrictions where user_id = _user_id and (until is null or until > now()))
$$;

-- appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  type text not null,
  starts_on date not null,
  start_time time not null default '10:00',
  place text not null default '' check (char_length(place) <= 120),
  notes text not null default '' check (char_length(notes) <= 500),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  remind_day_before boolean not null default true,
  remind_same_day boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.appointments (user_id, starts_on);
grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "own appointments" on public.appointments for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null check (kind in ('day_before','same_day')),
  title text not null,
  due_at timestamptz not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (appointment_id, kind)
);
create index on public.notifications (user_id, due_at);
grant select on public.notifications to authenticated;
grant update (read_at, dismissed_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.sync_appointment_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
declare tz text; d_before timestamptz; d_same timestamptz; ttl text;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.created_at := old.created_at; new.user_id := old.user_id; end if;
  return new;
end $$;
create trigger appointments_guard before insert or update on public.appointments for each row execute function public.sync_appointment_notifications();

create or replace function public.appointment_reminders_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare tz text; ttl text;
begin
  select coalesce(timezone,'UTC') into tz from public.profiles where id = new.user_id;
  tz := coalesce(tz,'UTC');
  begin perform now() at time zone tz; exception when others then tz := 'UTC'; end;
  ttl := new.type || ', ' || to_char(new.starts_on,'DD.MM.YYYY') || ' в ' || to_char(new.start_time,'HH24:MI');

  if new.status <> 'scheduled' then
    delete from public.notifications where appointment_id = new.id and read_at is null and dismissed_at is null;
    return new;
  end if;

  if new.remind_day_before then
    insert into public.notifications (user_id, appointment_id, kind, title, due_at)
    values (new.user_id, new.id, 'day_before', 'Завтра: ' || ttl, ((new.starts_on - 1)::timestamp + time '09:00') at time zone tz)
    on conflict (appointment_id, kind) do update set title = excluded.title, due_at = excluded.due_at
      where public.notifications.read_at is null and public.notifications.dismissed_at is null;
  else
    delete from public.notifications where appointment_id = new.id and kind = 'day_before' and read_at is null and dismissed_at is null;
  end if;

  if new.remind_same_day then
    insert into public.notifications (user_id, appointment_id, kind, title, due_at)
    values (new.user_id, new.id, 'same_day', 'Сегодня: ' || ttl, (new.starts_on::timestamp + least(time '08:00', new.start_time)) at time zone tz)
    on conflict (appointment_id, kind) do update set title = excluded.title, due_at = excluded.due_at
      where public.notifications.read_at is null and public.notifications.dismissed_at is null;
  else
    delete from public.notifications where appointment_id = new.id and kind = 'same_day' and read_at is null and dismissed_at is null;
  end if;
  return new;
end $$;
create trigger appointments_reminders after insert or update on public.appointments for each row execute function public.appointment_reminders_after();

-- saved articles
create table public.saved_articles (
  user_id uuid not null default auth.uid(),
  article_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);
grant select, insert, delete on public.saved_articles to authenticated;
grant all on public.saved_articles to service_role;
alter table public.saved_articles enable row level security;
create policy "own saved" on public.saved_articles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- blocks
create table public.blocks (
  blocker_id uuid not null default auth.uid(),
  blocked_id uuid not null,
  blocked_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
grant select, insert, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;
alter table public.blocks enable row level security;
create policy "own blocks" on public.blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create or replace function public.is_blocked(_blocker uuid, _blocked uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _blocker is not null and _blocked is not null and exists (select 1 from public.blocks where blocker_id = _blocker and blocked_id = _blocked)
$$;

-- posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid default auth.uid(),
  author_name text not null default '',
  category text not null check (category in ('Мой опыт','Вопрос врачу','Поддержка','Диагностика','Во время лечения','После лечения')),
  body text not null check (char_length(body) between 1 and 2000),
  is_demo boolean not null default false,
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  removed_at timestamptz,
  removed_reason text
);
create index on public.posts (created_at desc);
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "anon demo posts" on public.posts for select to anon using (is_demo and removed_at is null);
create policy "read posts" on public.posts for select to authenticated using (
  (removed_at is null and not public.is_blocked(auth.uid(), author_id))
  or author_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "create own posts" on public.posts for insert to authenticated with check (author_id = auth.uid() and not public.is_restricted(auth.uid()));
create policy "edit own posts" on public.posts for update to authenticated using (author_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (author_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "delete own posts" on public.posts for delete to authenticated using (author_id = auth.uid());

create or replace function public.posts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.author_id := auth.uid();
      new.author_name := coalesce((select pseudonym from public.profiles where id = auth.uid()), 'Участница');
      new.is_demo := false; new.likes_count := 0; new.removed_at := null; new.edited_at := null;
    end if;
    return new;
  end if;
  new.author_id := old.author_id; new.author_name := old.author_name; new.is_demo := old.is_demo;
  new.likes_count := old.likes_count; new.created_at := old.created_at;
  if not public.has_role(auth.uid(),'admin') then
    new.removed_at := old.removed_at; new.removed_reason := old.removed_reason;
    if public.is_restricted(auth.uid()) then raise exception 'Аккаунт ограничен'; end if;
  end if;
  if new.body is distinct from old.body or new.category is distinct from old.category then
    if old.author_id is distinct from auth.uid() then new.body := old.body; new.category := old.category;
    else new.edited_at := now(); end if;
  end if;
  return new;
end $$;
create trigger posts_guard before insert or update on public.posts for each row execute function public.posts_guard();

-- comments
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid default auth.uid(),
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 1000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  removed_at timestamptz
);
create index on public.comments (post_id, created_at);
grant select on public.comments to anon;
grant select, insert, update, delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "anon demo comments" on public.comments for select to anon using (is_demo and removed_at is null);
create policy "read comments" on public.comments for select to authenticated using (
  (removed_at is null and not public.is_blocked(auth.uid(), author_id))
  or author_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "create own comments" on public.comments for insert to authenticated with check (
  author_id = auth.uid() and not public.is_restricted(auth.uid())
  and not public.is_blocked((select p.author_id from public.posts p where p.id = post_id), auth.uid())
  and (parent_id is null or not public.is_blocked((select c.author_id from public.comments c where c.id = parent_id), auth.uid())));
create policy "edit own comments" on public.comments for update to authenticated using (author_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (author_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "delete own comments" on public.comments for delete to authenticated using (author_id = auth.uid());

create or replace function public.comments_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare pp uuid;
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select parent_id into pp from public.comments where id = new.parent_id;
      if pp is not null then new.parent_id := pp; end if;
    end if;
    if auth.uid() is not null then
      new.author_id := auth.uid();
      new.author_name := coalesce((select pseudonym from public.profiles where id = auth.uid()), 'Участница');
      new.is_demo := false; new.removed_at := null; new.edited_at := null;
    end if;
    return new;
  end if;
  new.author_id := old.author_id; new.author_name := old.author_name; new.is_demo := old.is_demo;
  new.post_id := old.post_id; new.parent_id := old.parent_id; new.created_at := old.created_at;
  if not public.has_role(auth.uid(),'admin') then new.removed_at := old.removed_at; end if;
  if new.body is distinct from old.body then
    if old.author_id is distinct from auth.uid() then new.body := old.body; else new.edited_at := now(); end if;
  end if;
  return new;
end $$;
create trigger comments_guard before insert or update on public.comments for each row execute function public.comments_guard();

-- likes
create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
grant select, insert, delete on public.post_likes to authenticated;
grant all on public.post_likes to service_role;
alter table public.post_likes enable row level security;
create policy "own likes" on public.post_likes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.likes_count_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.posts set likes_count = likes_count + 1 where id = new.post_id;
  else update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id; end if;
  return null;
end $$;
create trigger likes_count_sync after insert or delete on public.post_likes for each row execute function public.likes_count_sync();

-- pseudonym changes propagate
create or replace function public.profile_name_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pseudonym is distinct from old.pseudonym then
    update public.posts set author_name = new.pseudonym where author_id = new.id;
    update public.comments set author_name = new.pseudonym where author_id = new.id;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profile_name_sync before update on public.profiles for each row execute function public.profile_name_sync();

-- reports & moderation
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid(),
  post_id uuid references public.posts(id) on delete set null,
  comment_id uuid references public.comments(id) on delete set null,
  reason text not null check (reason in ('bullying','insults','threats','spam','misinformation','harmful','other')),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  check (post_id is not null or comment_id is not null)
);
grant select, insert, update on public.content_reports to authenticated;
grant all on public.content_reports to service_role;
alter table public.content_reports enable row level security;
create policy "file report" on public.content_reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy "admin read reports" on public.content_reports for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin update reports" on public.content_reports for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null default auth.uid(),
  action text not null,
  report_id uuid,
  post_id uuid,
  comment_id uuid,
  target_user_id uuid,
  note text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert on public.moderation_actions to authenticated;
grant all on public.moderation_actions to service_role;
alter table public.moderation_actions enable row level security;
create policy "admin read actions" on public.moderation_actions for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin log actions" on public.moderation_actions for insert to authenticated with check (public.has_role(auth.uid(),'admin') and admin_id = auth.uid());

-- demo content
insert into public.posts (id, author_name, category, body, is_demo, likes_count, created_at) values
('00000000-0000-4000-8000-000000000001','Лилия_Р','Мой опыт','Сегодня впервые прошла маммографию. Очень боялась, а всё заняло минут 15. Девочки, не откладывайте — страх намного больше, чем сама процедура.',true,24, now() - interval '3 hours'),
('00000000-0000-4000-8000-000000000002','Тихая_Волна','Вопрос врачу','В заключении написали «BI-RADS 3». Как вы готовились к разговору с врачом? Какие вопросы задавали?',true,11, now() - interval '8 hours'),
('00000000-0000-4000-8000-000000000003','Солнце_88','Во время лечения','Третий месяц терапии. Хочу сказать всем, кто сейчас в начале пути: бывают тяжёлые дни, но вы не одни. Обнимаю каждую.',true,47, now() - interval '26 hours'),
('00000000-0000-4000-8000-000000000004','Вера_Н','После лечения','Два года в ремиссии! Продолжаю наблюдение у врача и учусь снова радоваться простым вещам.',true,63, now() - interval '50 hours'),
('00000000-0000-4000-8000-000000000005','Нежность','Поддержка','Как вы справляетесь с тревогой в ожидании результатов? Мне помогает гулять и не гуглить симптомы.',true,19, now() - interval '70 hours');
insert into public.comments (post_id, author_name, body, is_demo, created_at) values
('00000000-0000-4000-8000-000000000001','Мира','Спасибо, что поделились! Я как раз записана на следующей неделе.',true, now() - interval '2 hours'),
('00000000-0000-4000-8000-000000000002','Анна_К','Я записала вопросы заранее в AI-помощнике и взяла с собой. Очень помогло не растеряться.',true, now() - interval '6 hours'),
('00000000-0000-4000-8000-000000000004','Лилия_Р','Какая чудесная новость! 💗',true, now() - interval '48 hours');
