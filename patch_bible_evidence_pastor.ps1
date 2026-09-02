$ErrorActionPreference = "Stop"

Write-Host "BUKLOD Patch 142: Bible evidence + Pastor review" -ForegroundColor Cyan

function Write-Utf8NoBom([string]$Path,[string]$Content){
  $dir=Split-Path -Parent $Path
  if($dir -and -not (Test-Path -LiteralPath $dir)){New-Item -ItemType Directory -Force -Path $dir|Out-Null}
  [System.IO.File]::WriteAllText($Path,$Content,[System.Text.UTF8Encoding]::new($false))
}

function Backup-Once([string]$Path){
  if(Test-Path -LiteralPath $Path){
    $backup="$Path.bak142"
    if(-not (Test-Path -LiteralPath $backup)){Copy-Item -LiteralPath $Path -Destination $backup}
  }
}

$required=@(
  "src\app\bible\index.tsx",
  "src\app\admin\bible\monitor.tsx",
  "src\app\(tabs)\me.tsx",
  "src\app\_layout.tsx"
)
foreach($file in $required){if(-not (Test-Path -LiteralPath $file)){throw "Required project file not found: $file"}}

Backup-Once "src\app\bible\index.tsx"
Backup-Once "src\app\admin\bible\monitor.tsx"
Backup-Once "src\app\(tabs)\me.tsx"
Backup-Once "src\app\_layout.tsx"

$migration=@'
-- ============================================================================
-- BUKLOD DAILY BIBLE - EVIDENCE + PASTOR REVIEW
-- Migration 142
-- Requires Bible-passage evidence AND reflection evidence before approval.
-- Supports private handwritten-photo evidence and Local Pastor review scope.
-- ============================================================================

-- 1) Evidence fields. Reflection text becomes nullable because handwritten-photo
--    reflection is an accepted alternative.
alter table public.daily_bible_submissions
  alter column answer_text drop not null;

alter table public.daily_bible_submissions
  add column if not exists bible_text text,
  add column if not exists bible_photo_path text,
  add column if not exists reflection_photo_path text;

comment on column public.daily_bible_submissions.bible_text is
'Typed Bible passage evidence. Either meaningful typed Bible text or a handwritten Bible photo is required.';

comment on column public.daily_bible_submissions.bible_photo_path is
'Private Storage object path for handwritten Bible-passage evidence.';

comment on column public.daily_bible_submissions.reflection_photo_path is
'Private Storage object path for handwritten reflection evidence.';

-- Existing pending submissions were created before Bible-passage evidence became
-- mandatory. Return them for revision instead of allowing legacy approval.
update public.daily_bible_submissions
set
  status = 'rejected',
  reviewed_by = null,
  reviewed_at = now(),
  admin_note = coalesce(
    nullif(trim(admin_note),''),
    'Bible passage evidence is now required. Please add the Bible text or a handwritten passage photo, then resubmit.'
  )
where status = 'pending_admin'
  and coalesce(char_length(trim(bible_text)),0) < 20
  and bible_photo_path is null;

-- 2) Private evidence bucket.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'daily-bible-evidence',
  'daily-bible-evidence',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Evidence path format:
-- {user_uuid}/{assignment_uuid}/bible-{timestamp}.jpg
-- {user_uuid}/{assignment_uuid}/reflection-{timestamp}.jpg

drop policy if exists "Daily Bible owners upload evidence" on storage.objects;
create policy "Daily Bible owners upload evidence"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'daily-bible-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Daily Bible owners view evidence" on storage.objects;
create policy "Daily Bible owners view evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'daily-bible-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Daily Bible reviewers view evidence" on storage.objects;
create policy "Daily Bible reviewers view evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'daily-bible-evidence'
  and exists (
    select 1
    from public.profiles p
    where p.id::text = (storage.foldername(name))[1]
      and (
        public.is_system_admin()
        or (
          public.current_role() = 'pastor'
          and public.can_view_profile(p.id)
        )
      )
  )
);

drop policy if exists "Daily Bible owners delete evidence" on storage.objects;
create policy "Daily Bible owners delete evidence"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'daily-bible-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- 3) Updated evidence-aware member submission RPC.
create or replace function public.submit_daily_bible_evidence(
  p_assignment_id uuid,
  p_bible_text text default null,
  p_reflection_text text default null,
  p_language text default 'fil',
  p_bible_photo_path text default null,
  p_reflection_photo_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  local_today date := (now() at time zone 'Asia/Manila')::date;
  assignment_record record;
  existing_record record;
  on_time boolean;
  new_id uuid;
  bible_text_value text := nullif(trim(coalesce(p_bible_text,'')),'');
  reflection_text_value text := nullif(trim(coalesce(p_reflection_text,'')),'');
  bible_path text := nullif(trim(coalesce(p_bible_photo_path,'')),'');
  reflection_path text := nullif(trim(coalesce(p_reflection_photo_path,'')),'');
  expected_prefix text;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if p_assignment_id is null then
    raise exception 'Bible reading assignment is required';
  end if;

  if p_language not in ('fil','en') then
    raise exception 'Invalid reflection language';
  end if;

  select a.*
  into assignment_record
  from public.daily_bible_assignments a
  where a.id = p_assignment_id
    and a.is_published = true;

  if assignment_record.id is null then
    raise exception 'Bible reading assignment not found';
  end if;

  if not exists (
    select 1
    from public.daily_bible_assignment_members am
    where am.assignment_id = p_assignment_id
      and am.user_id = actor
  ) then
    raise exception 'This Bible reading was not assigned to your account';
  end if;

  if local_today < assignment_record.reading_date then
    raise exception 'This Bible reading is not yet available';
  end if;

  expected_prefix := actor::text || '/' || p_assignment_id::text || '/';

  if bible_path is not null then
    if left(bible_path, char_length(expected_prefix)) <> expected_prefix then
      raise exception 'Invalid Bible evidence photo path';
    end if;

    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'daily-bible-evidence'
        and o.name = bible_path
    ) then
      raise exception 'Bible evidence photo was not found';
    end if;
  end if;

  if reflection_path is not null then
    if left(reflection_path, char_length(expected_prefix)) <> expected_prefix then
      raise exception 'Invalid reflection evidence photo path';
    end if;

    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'daily-bible-evidence'
        and o.name = reflection_path
    ) then
      raise exception 'Reflection evidence photo was not found';
    end if;
  end if;

  if coalesce(char_length(bible_text_value),0) < 20 and bible_path is null then
    raise exception 'Bible passage evidence is required. Type the Bible text or attach a clear handwritten passage photo';
  end if;

  if coalesce(char_length(reflection_text_value),0) < 20 and reflection_path is null then
    raise exception 'Reflection evidence is required. Write a meaningful reflection or attach a clear handwritten reflection photo';
  end if;

  on_time := local_today = assignment_record.reading_date;

  select s.*
  into existing_record
  from public.daily_bible_submissions s
  where s.assignment_id = p_assignment_id
    and s.user_id = actor
  for update;

  if existing_record.id is not null then
    if existing_record.status = 'approved' then
      raise exception 'This Bible reading has already been approved';
    end if;

    if existing_record.status = 'pending_admin' then
      raise exception 'This Bible reading is already awaiting validation';
    end if;

    update public.daily_bible_submissions
    set
      bible_text = bible_text_value,
      bible_photo_path = bible_path,
      answer_text = reflection_text_value,
      reflection_photo_path = reflection_path,
      answer_language = p_language,
      submitted_at = now(),
      submitted_on_time = on_time,
      reward_amount = assignment_record.reward_amount,
      status = 'pending_admin',
      reviewed_by = null,
      reviewed_at = null,
      admin_note = null
    where id = existing_record.id;

    return existing_record.id;
  end if;

  insert into public.daily_bible_submissions (
    assignment_id,
    user_id,
    bible_text,
    bible_photo_path,
    answer_text,
    reflection_photo_path,
    answer_language,
    submitted_at,
    submitted_on_time,
    reward_amount,
    status
  )
  values (
    p_assignment_id,
    actor,
    bible_text_value,
    bible_path,
    reflection_text_value,
    reflection_path,
    p_language,
    now(),
    on_time,
    assignment_record.reward_amount,
    'pending_admin'
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.submit_daily_bible_evidence(uuid,text,text,text,text,text) from public;
grant execute on function public.submit_daily_bible_evidence(uuid,text,text,text,text,text) to authenticated;

-- Old clients must not bypass the new Bible-passage evidence requirement.
create or replace function public.submit_daily_bible_reflection(
  p_assignment_id uuid,
  p_answer text,
  p_language text default 'fil'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Daily Bible Reading was upgraded. Bible passage evidence and reflection evidence are now both required. Please update/reload BUKLOD.';
end;
$$;

revoke all on function public.submit_daily_bible_reflection(uuid,text,text) from public;
grant execute on function public.submit_daily_bible_reflection(uuid,text,text) to authenticated;

-- 4) Shared reviewer monitor for System Admin and Local Pastor.
create or replace function public.reviewer_get_daily_bible_monitor(
  p_assignment_id uuid
)
returns table (
  assignment_id uuid,
  reading_date date,
  bible_reference text,
  user_id uuid,
  full_name text,
  church_id uuid,
  submission_id uuid,
  bible_text text,
  bible_photo_path text,
  reflection_text text,
  reflection_photo_path text,
  submission_status text,
  submitted_at timestamptz,
  submitted_on_time boolean,
  reviewer_can_act boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  local_today date := (now() at time zone 'Asia/Manila')::date;
  actor_is_admin boolean := public.is_system_admin();
  actor_is_pastor boolean := public.current_role() = 'pastor';
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if not (actor_is_admin or actor_is_pastor) then
    raise exception 'System Administrator or Local Pastor access required';
  end if;

  return query
  select
    a.id,
    a.reading_date,
    a.bible_reference,
    p.id,
    p.full_name::text,
    p.church_id,
    s.id,
    s.bible_text,
    s.bible_photo_path,
    s.answer_text,
    s.reflection_photo_path,
    case
      when s.id is null and a.reading_date < local_today then 'missed'
      when s.id is null then 'not_submitted'
      else s.status
    end::text,
    s.submitted_at,
    coalesce(s.submitted_on_time,false),
    (
      s.id is not null
      and s.status = 'pending_admin'
      and (
        actor_is_admin
        or (actor_is_pastor and actor <> p.id)
      )
    )
  from public.daily_bible_assignment_members am
  join public.daily_bible_assignments a
    on a.id = am.assignment_id
  join public.profiles p
    on p.id = am.user_id
  left join public.daily_bible_submissions s
    on s.assignment_id = am.assignment_id
   and s.user_id = am.user_id
  where am.assignment_id = p_assignment_id
    and (
      actor_is_admin
      or (
        actor_is_pastor
        and public.can_view_profile(p.id)
      )
    )
  order by
    case
      when s.status = 'pending_admin' then 1
      when s.status = 'rejected' then 2
      when s.id is null and a.reading_date < local_today then 3
      when s.id is null then 4
      else 5
    end,
    p.full_name;
end;
$$;

revoke all on function public.reviewer_get_daily_bible_monitor(uuid) from public;
grant execute on function public.reviewer_get_daily_bible_monitor(uuid) to authenticated;

-- 5) Replace review RPC while preserving the existing approval/ledger/points flow.
create or replace function public.admin_review_daily_bible_submission(
  p_submission_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  rec record;
  actor_is_admin boolean := public.is_system_admin();
  actor_is_pastor boolean := public.current_role() = 'pastor';
  has_bible_photo boolean := false;
  has_reflection_photo boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select
    s.*,
    a.bible_reference,
    a.reading_date
  into rec
  from public.daily_bible_submissions s
  join public.daily_bible_assignments a
    on a.id = s.assignment_id
  where s.id = p_submission_id
  for update of s;

  if rec.id is null then
    raise exception 'Bible reading submission not found';
  end if;

  if not (
    actor_is_admin
    or (
      actor_is_pastor
      and public.can_view_profile(rec.user_id)
    )
  ) then
    raise exception 'You are not authorized to review this member''s Bible reading';
  end if;

  if actor_is_pastor and not actor_is_admin and actor = rec.user_id then
    raise exception 'A Local Pastor cannot approve his or her own Bible reading. System Admin review is required';
  end if;

  if rec.status <> 'pending_admin' then
    raise exception 'This Bible reading submission has already been reviewed';
  end if;

  if rec.bible_photo_path is not null then
    select exists (
      select 1 from storage.objects o
      where o.bucket_id = 'daily-bible-evidence'
        and o.name = rec.bible_photo_path
    ) into has_bible_photo;
  end if;

  if rec.reflection_photo_path is not null then
    select exists (
      select 1 from storage.objects o
      where o.bucket_id = 'daily-bible-evidence'
        and o.name = rec.reflection_photo_path
    ) into has_reflection_photo;
  end if;

  if p_approve then
    if coalesce(char_length(trim(rec.bible_text)),0) < 20 and not has_bible_photo then
      raise exception 'Cannot approve: Bible passage evidence is missing';
    end if;

    if coalesce(char_length(trim(rec.answer_text)),0) < 20 and not has_reflection_photo then
      raise exception 'Cannot approve: reflection evidence is missing';
    end if;

    update public.daily_bible_submissions
    set
      status = 'approved',
      reviewed_by = actor,
      reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_admin_note,'')),'')
    where id = p_submission_id;

    if rec.reward_amount > 0 then
      insert into public.bayanihan_ledger (
        user_id,
        direction,
        amount,
        source_type,
        source_key,
        source_id,
        description,
        approved_by
      )
      values (
        rec.user_id,
        'credit',
        rec.reward_amount,
        'bible_reading',
        'bible_reading:' || rec.user_id::text || ':' || rec.assignment_id::text,
        rec.id,
        'Daily Bible Reading: ' || rec.bible_reference || ' (' || rec.reading_date::text || ')',
        actor
      )
      on conflict (user_id, source_key)
      do nothing;
    end if;
  else
    update public.daily_bible_submissions
    set
      status = 'rejected',
      reviewed_by = actor,
      reviewed_at = now(),
      admin_note = coalesce(
        nullif(trim(coalesce(p_admin_note,'')),''),
        'Please revise your Bible passage evidence and/or reflection, then resubmit.'
      )
    where id = p_submission_id;
  end if;
end;
$$;

revoke all on function public.admin_review_daily_bible_submission(uuid,boolean,text) from public;
grant execute on function public.admin_review_daily_bible_submission(uuid,boolean,text) to authenticated;

'@
Write-Utf8NoBom "supabase\migrations\20260810014200_daily_bible_evidence_pastor_review.sql" $migration
Write-Host "Created migration 142." -ForegroundColor Green

$member=@'
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle, shared } from '@/components/UI';

type Assignment = {
  id: string;
  reading_date: string;
  bible_reference: string;
  instruction_fil: string | null;
  reflection_question_fil: string;
  reflection_question_en: string;
};

type Submission = {
  id: string;
  assignment_id: string;
  bible_text: string | null;
  bible_photo_path: string | null;
  answer_text: string | null;
  reflection_photo_path: string | null;
  answer_language: 'fil' | 'en';
  status: 'pending_admin' | 'approved' | 'rejected';
  submitted_at: string;
  submitted_on_time: boolean;
  admin_note: string | null;
};

type PhotoDraft = {
  uri: string;
  base64: string;
  sizeBytes: number;
};

const EVIDENCE_BUCKET = 'daily-bible-evidence';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const fromIso = (s: string) => {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y,m-1,d);
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate()+n);
  return x;
};

const monday = () => {
  const d = new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate() - ((d.getDay()+6)%7));
  return d;
};

function base64ToArrayBuffer(base64: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  let length = clean.length * 0.75;
  if (clean.endsWith('==')) length -= 2;
  else if (clean.endsWith('=')) length -= 1;

  const bytes = new Uint8Array(Math.max(0, Math.floor(length)));
  let byteIndex = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const e1 = chars.indexOf(clean[i]);
    const e2 = chars.indexOf(clean[i + 1]);
    const e3 = clean[i + 2] === '=' ? 0 : chars.indexOf(clean[i + 2]);
    const e4 = clean[i + 3] === '=' ? 0 : chars.indexOf(clean[i + 3]);
    const triple = (e1 << 18) | (e2 << 12) | (e3 << 6) | e4;

    if (byteIndex < bytes.length) bytes[byteIndex++] = (triple >> 16) & 255;
    if (byteIndex < bytes.length) bytes[byteIndex++] = (triple >> 8) & 255;
    if (byteIndex < bytes.length) bytes[byteIndex++] = triple & 255;
  }

  return bytes.buffer;
}

async function chooseEvidencePhoto(): Promise<PhotoDraft | null> {
  const ImagePicker = await import('expo-image-picker');
  const ImageManipulator = await import('expo-image-manipulator');

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Photo Permission',
      'Please allow BUKLOD to access your photos so you can attach handwritten Bible Reading evidence.'
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: false,
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);

  if ((asset.width ?? 0) > 1280) {
    context.resize({ width: 1280 });
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.72,
    base64: true,
  });

  if (!saved.base64) {
    throw new Error('Could not prepare this photo.');
  }

  const sizeBytes = Math.floor((saved.base64.length * 3) / 4);
  if (sizeBytes > 5 * 1024 * 1024) {
    throw new Error('The compressed photo is still above 5 MB. Please choose another photo.');
  }

  return { uri: saved.uri, base64: saved.base64, sizeBytes };
}

export default function DailyBibleScreen() {
  const weekStart = useMemo(monday, []);
  const days = useMemo(
    () => Array.from({length:7},(_,i)=>iso(addDays(weekStart,i))),
    [weekStart]
  );

  const today = iso(new Date());
  const [assignments,setAssignments] = useState<Assignment[]>([]);
  const [submissions,setSubmissions] = useState<Submission[]>([]);
  const [selectedDate,setSelectedDate] = useState(today);
  const [bibleText,setBibleText] = useState('');
  const [answer,setAnswer] = useState('');
  const [language,setLanguage] = useState<'fil'|'en'>('fil');
  const [biblePhotoPath,setBiblePhotoPath] = useState<string|null>(null);
  const [reflectionPhotoPath,setReflectionPhotoPath] = useState<string|null>(null);
  const [bibleDraft,setBibleDraft] = useState<PhotoDraft|null>(null);
  const [reflectionDraft,setReflectionDraft] = useState<PhotoDraft|null>(null);
  const [photoBusy,setPhotoBusy] = useState<'bible'|'reflection'|null>(null);
  const [points,setPoints] = useState(10);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [busy,setBusy] = useState(false);

  const load = useCallback(async () => {
    const {data:a,error:ae} = await supabase
      .from('daily_bible_assignments')
      .select('id,reading_date,bible_reference,instruction_fil,reflection_question_fil,reflection_question_en')
      .gte('reading_date',days[0])
      .lte('reading_date',days[6])
      .eq('is_published',true)
      .order('reading_date');

    if (ae) throw ae;
    const aa = (a ?? []) as Assignment[];
    setAssignments(aa);

    if (aa.length) {
      const {data:s,error:se} = await supabase
        .from('daily_bible_submissions')
        .select('id,assignment_id,bible_text,bible_photo_path,answer_text,reflection_photo_path,answer_language,status,submitted_at,submitted_on_time,admin_note')
        .in('assignment_id',aa.map(x=>x.id));
      if (se) throw se;
      setSubmissions((s ?? []) as Submission[]);
    } else {
      setSubmissions([]);
    }

    const {data:r} = await supabase
      .from('buklod_point_rules')
      .select('base_points')
      .eq('activity_type','daily_bible')
      .eq('is_active',true)
      .maybeSingle();

    if (r?.base_points != null) setPoints(Number(r.base_points));
  }, [days]);

  useEffect(()=>{
    load()
      .catch((e:any)=>Alert.alert('Daily Bible Reading',e?.message ?? 'Unable to load.'))
      .finally(()=>setLoading(false));
  },[load]);

  const byDate = useMemo(
    ()=>Object.fromEntries(assignments.map(x=>[x.reading_date,x])) as Record<string,Assignment>,
    [assignments]
  );
  const subByAssignment = useMemo(
    ()=>Object.fromEntries(submissions.map(x=>[x.assignment_id,x])) as Record<string,Submission>,
    [submissions]
  );

  const selected = byDate[selectedDate];
  const submission = selected ? subByAssignment[selected.id] : undefined;

  useEffect(()=>{
    setBibleText(submission?.bible_text ?? '');
    setAnswer(submission?.answer_text ?? '');
    setLanguage(submission?.answer_language ?? 'fil');
    setBiblePhotoPath(submission?.bible_photo_path ?? null);
    setReflectionPhotoPath(submission?.reflection_photo_path ?? null);
    setBibleDraft(null);
    setReflectionDraft(null);
  },[selectedDate,submission?.id,submission?.status]);

  const approved = submissions.filter(x=>x.status==='approved').length;
  const pending = submissions.filter(x=>x.status==='pending_admin').length;
  const locked = submission?.status==='approved' || submission?.status==='pending_admin';

  const bibleEvidenceOkay = bibleText.trim().length >= 20 || !!biblePhotoPath || !!bibleDraft;
  const reflectionEvidenceOkay = answer.trim().length >= 20 || !!reflectionPhotoPath || !!reflectionDraft;

  const pickPhoto = async (kind:'bible'|'reflection') => {
    if (locked) return;
    setPhotoBusy(kind);
    try {
      const photo = await chooseEvidencePhoto();
      if (!photo) return;
      if (kind==='bible') setBibleDraft(photo);
      else setReflectionDraft(photo);
    } catch(e:any) {
      Alert.alert('Photo',e?.message ?? 'Could not select this photo.');
    } finally {
      setPhotoBusy(null);
    }
  };

  const uploadPhoto = async (
    userId:string,
    assignmentId:string,
    kind:'bible'|'reflection',
    photo:PhotoDraft
  ) => {
    const path = `${userId}/${assignmentId}/${kind}-${Date.now()}.jpg`;
    const {error} = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(path,base64ToArrayBuffer(photo.base64),{
        contentType:'image/jpeg',
        upsert:false,
      });
    if(error) throw error;
    return path;
  };

  const removeUploaded = async (paths:string[]) => {
    const unique = Array.from(new Set(paths.filter(Boolean)));
    if (!unique.length) return;
    await supabase.storage.from(EVIDENCE_BUCKET).remove(unique);
  };

  const submit = async () => {
    if (!selected) return;

    if (!bibleEvidenceOkay) {
      Alert.alert(
        'Bible Passage Required',
        'Type the actual Bible text (at least 20 characters) or attach a clear photo of your handwritten Bible passage.'
      );
      return;
    }

    if (!reflectionEvidenceOkay) {
      Alert.alert(
        'Reflection Required',
        'Write a meaningful reflection (at least 20 characters) or attach a clear photo of your handwritten reflection.'
      );
      return;
    }

    setBusy(true);
    const newlyUploaded:string[] = [];

    try {
      const {data:{user},error:userError} = await supabase.auth.getUser();
      if(userError) throw userError;
      if(!user) throw new Error('Authentication required.');

      let finalBiblePath = biblePhotoPath;
      let finalReflectionPath = reflectionPhotoPath;

      if (bibleDraft) {
        finalBiblePath = await uploadPhoto(user.id,selected.id,'bible',bibleDraft);
        newlyUploaded.push(finalBiblePath);
      }

      if (reflectionDraft) {
        finalReflectionPath = await uploadPhoto(user.id,selected.id,'reflection',reflectionDraft);
        newlyUploaded.push(finalReflectionPath);
      }

      const {error} = await supabase.rpc('submit_daily_bible_evidence',{
        p_assignment_id:selected.id,
        p_bible_text:bibleText.trim() || null,
        p_reflection_text:answer.trim() || null,
        p_language:language,
        p_bible_photo_path:finalBiblePath,
        p_reflection_photo_path:finalReflectionPath,
      });
      if (error) throw error;

      const oldPaths = [submission?.bible_photo_path,submission?.reflection_photo_path]
        .filter((x):x is string=>!!x)
        .filter(x=>x!==finalBiblePath && x!==finalReflectionPath);

      if(oldPaths.length) await removeUploaded(oldPaths);

      Alert.alert(
        'Submitted',
        'Your Bible passage evidence and reflection are awaiting validation by an authorized Local Pastor or System Admin.'
      );
      await load();
    } catch(e:any) {
      if(newlyUploaded.length) await removeUploaded(newlyUploaded);
      Alert.alert('Submission',e?.message ?? 'Unable to submit.');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    !!selected &&
    selectedDate <= today &&
    !locked &&
    bibleEvidenceOkay &&
    reflectionEvidenceOkay;

  if (loading) {
    return <View style={[shared.screen,styles.center]}><ActivityIndicator size="large"/></View>;
  }

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={[shared.content,styles.content]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async()=>{
            setRefreshing(true);
            try { await load(); } finally { setRefreshing(false); }
          }}
        />
      }
    >
      <View style={styles.header}>
        <View style={{flex:1}}>
          <Text style={shared.h1}>Daily Bible Reading</Text>
          <Text style={shared.muted}>Read · Record the passage · Reflect · Submit</Text>
        </View>
        <Pressable onPress={()=>router.back()} style={styles.outline}>
          <Text style={styles.outlineText}>BACK</Text>
        </Pressable>
      </View>

      <Card>
        <Text style={styles.eyebrow}>THIS WEEK</Text>
        <Text style={styles.big}>{approved}/7 valid</Text>
        <Text style={styles.meta}>{pending} pending · +{points} BUKLOD Points per approved reading</Text>
        <View style={styles.dots}>
          {days.map(date=>{
            const a=byDate[date];
            const s=a?subByAssignment[a.id]:undefined;
            return <View key={date} style={[
              styles.dot,
              s?.status==='approved' && styles.dotApproved,
              s?.status==='pending_admin' && styles.dotPending,
              s?.status==='rejected' && styles.dotRejected
            ]}/>;
          })}
        </View>
      </Card>

      <SectionTitle>WEEKLY PLAN</SectionTitle>
      <View style={styles.dayRow}>
        {days.map(date=>{
          const a=byDate[date];
          const s=a?subByAssignment[a.id]:undefined;
          const active=selectedDate===date;
          return (
            <Pressable
              key={date}
              onPress={()=>setSelectedDate(date)}
              style={[styles.day,active&&styles.dayActive]}
            >
              <Text style={[styles.dayName,active&&styles.white]}>
                {fromIso(date).toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()}
              </Text>
              <Text style={[styles.dayNum,active&&styles.white]}>{fromIso(date).getDate()}</Text>
              <Text style={[styles.dayState,active&&styles.white]}>
                {!a?'—':s?.status==='approved'?'VALID':s?.status==='pending_admin'?'PEND':s?.status==='rejected'?'REVISE':'OPEN'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>READ & RESPOND</SectionTitle>

      {!selected ? (
        <Card>
          <Text style={shared.h2}>No reading published for this day yet.</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={styles.dateText}>
              {fromIso(selected.reading_date).toLocaleDateString(undefined,{
                weekday:'long',month:'long',day:'numeric',year:'numeric'
              })}
            </Text>
            <Text style={styles.reference}>{selected.bible_reference}</Text>
            {!!selected.instruction_fil && <Text style={styles.body}>{selected.instruction_fil}</Text>}

            <Text style={styles.eyebrow}>REFLECTION QUESTION</Text>
            <Text style={styles.question}>
              {language==='fil' ? selected.reflection_question_fil : selected.reflection_question_en}
            </Text>

            <View style={styles.langRow}>
              {(['fil','en'] as const).map(l=>(
                <Pressable key={l} disabled={locked} onPress={()=>setLanguage(l)} style={[styles.lang,language===l&&styles.langActive]}>
                  <Text style={[styles.langText,language===l&&styles.white]}>{l==='fil'?'FILIPINO':'ENGLISH'}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={styles.eyebrow}>1. BIBLE PASSAGE EVIDENCE *</Text>
            <Text style={styles.help}>
              Type the Bible text contained in the required passage, or attach a clear photo if you copied it by hand.
            </Text>

            <TextInput
              value={bibleText}
              onChangeText={setBibleText}
              multiline
              textAlignVertical="top"
              editable={!locked}
              placeholder={`Type the actual text you read from ${selected.bible_reference}...`}
              placeholderTextColor="#89958E"
              style={styles.input}
            />
            <Text style={styles.meta}>{bibleText.trim().length} typed characters · minimum 20 if using text</Text>

            <EvidencePhoto
              title="HANDWRITTEN BIBLE PASSAGE"
              draft={bibleDraft}
              existingPath={biblePhotoPath}
              busy={photoBusy==='bible'}
              disabled={locked || photoBusy!==null}
              onPick={()=>pickPhoto('bible')}
              onRemove={()=>{setBibleDraft(null);setBiblePhotoPath(null);}}
            />
          </Card>

          <Card>
            <Text style={styles.eyebrow}>2. REFLECTION *</Text>
            <Text style={styles.help}>
              Answer the reflection question in the app, or attach a clear photo of your handwritten reflection.
            </Text>

            <TextInput
              value={answer}
              onChangeText={setAnswer}
              multiline
              textAlignVertical="top"
              editable={!locked}
              placeholder="What did you learn, and how will you apply it?"
              placeholderTextColor="#89958E"
              style={styles.input}
            />
            <Text style={styles.meta}>{answer.trim().length} typed characters · minimum 20 if using text</Text>

            <EvidencePhoto
              title="HANDWRITTEN REFLECTION"
              draft={reflectionDraft}
              existingPath={reflectionPhotoPath}
              busy={photoBusy==='reflection'}
              disabled={locked || photoBusy!==null}
              onPick={()=>pickPhoto('reflection')}
              onRemove={()=>{setReflectionDraft(null);setReflectionPhotoPath(null);}}
            />

            {selectedDate>today && <Text style={styles.warning}>This reading is not open yet.</Text>}
            {submission?.status==='pending_admin' && <Text style={styles.warning}>Awaiting Local Pastor / System Admin validation.</Text>}
            {submission?.status==='approved' && <Text style={styles.valid}>✓ Validated · +{points} BUKLOD Points</Text>}
            {submission?.status==='rejected' && (
              <Text style={styles.reject}>
                Revision requested{submission.admin_note?`: ${submission.admin_note}`:''}
              </Text>
            )}

            <Pressable
              disabled={!canSubmit || busy}
              onPress={submit}
              style={[styles.submit,(!canSubmit||busy)&&styles.submitOff]}
            >
              <Text style={styles.submitText}>
                {busy?'SUBMITTING...':submission?.status==='rejected'?'RESUBMIT EVIDENCE':'SUBMIT BIBLE READING'}
              </Text>
            </Pressable>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function EvidencePhoto({
  title,
  draft,
  existingPath,
  busy,
  disabled,
  onPick,
  onRemove,
}:{
  title:string;
  draft:PhotoDraft|null;
  existingPath:string|null;
  busy:boolean;
  disabled:boolean;
  onPick:()=>void;
  onRemove:()=>void;
}) {
  const attached = !!draft || !!existingPath;

  return (
    <View style={styles.photoBox}>
      <View style={styles.photoTop}>
        <View style={{flex:1}}>
          <Text style={styles.photoTitle}>{title}</Text>
          <Text style={styles.photoMeta}>{attached?'✓ Photo attached':'Optional when typed evidence is complete'}</Text>
        </View>
        {attached && !disabled && (
          <Pressable onPress={onRemove}><Text style={styles.removeText}>REMOVE</Text></Pressable>
        )}
      </View>

      {!!draft?.uri && <Image source={{uri:draft.uri}} style={styles.preview} resizeMode="cover"/>}

      {!disabled && (
        <Pressable onPress={onPick} style={styles.photoButton}>
          <Text style={styles.photoButtonText}>{busy?'PREPARING...':attached?'REPLACE PHOTO':'ATTACH PHOTO'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  content:{paddingBottom:40,gap:14},
  center:{flex:1,alignItems:'center',justifyContent:'center'},
  header:{flexDirection:'row',gap:12,alignItems:'flex-start'},
  outline:{paddingHorizontal:12,paddingVertical:9,borderWidth:1,borderColor:'#D7DFDA',borderRadius:12},
  outlineText:{fontSize:11,fontWeight:'900',color:'#275D45'},
  eyebrow:{marginTop:4,fontSize:10.5,fontWeight:'900',color:'#6D7B73'},
  big:{marginTop:5,fontSize:22,fontWeight:'900',color:'#20352A'},
  meta:{marginTop:6,fontSize:11,color:'#718078'},
  dots:{flexDirection:'row',gap:7,marginTop:12},
  dot:{width:18,height:8,borderRadius:99,backgroundColor:'#E0E6E2'},
  dotApproved:{backgroundColor:'#275D45'},
  dotPending:{backgroundColor:'#D4A84F'},
  dotRejected:{backgroundColor:'#9B4A4A'},
  dayRow:{flexDirection:'row',gap:6},
  day:{flex:1,paddingVertical:9,alignItems:'center',borderRadius:13,borderWidth:1,borderColor:'#DDE4E0',backgroundColor:'#FFF'},
  dayActive:{backgroundColor:'#275D45',borderColor:'#275D45'},
  dayName:{fontSize:9,fontWeight:'900',color:'#738078'},
  dayNum:{fontSize:16,fontWeight:'900',color:'#26382F'},
  dayState:{fontSize:7.5,fontWeight:'900',color:'#849089'},
  white:{color:'#FFF'},
  dateText:{fontSize:12,fontWeight:'800',color:'#718078'},
  reference:{marginTop:7,fontSize:24,lineHeight:31,fontWeight:'900',color:'#21372C'},
  body:{marginTop:10,fontSize:15,lineHeight:22,color:'#44534B'},
  question:{marginTop:7,fontSize:18,lineHeight:27,fontWeight:'700',color:'#24382E'},
  langRow:{flexDirection:'row',gap:8,marginTop:14},
  lang:{paddingHorizontal:12,paddingVertical:8,borderRadius:999,backgroundColor:'#EEF2F0'},
  langActive:{backgroundColor:'#275D45'},
  langText:{fontSize:10,fontWeight:'900',color:'#607068'},
  help:{marginTop:6,fontSize:12.5,lineHeight:19,color:'#65736B'},
  input:{marginTop:10,minHeight:135,borderWidth:1,borderColor:'#D8E0DB',borderRadius:16,padding:14,fontSize:15.5,lineHeight:23,color:'#23372D',backgroundColor:'#FBFCFB'},
  photoBox:{marginTop:12,padding:12,borderRadius:14,borderWidth:1,borderColor:'#DDE4E0',backgroundColor:'#F7F9F8'},
  photoTop:{flexDirection:'row',gap:10,alignItems:'center'},
  photoTitle:{fontSize:10,fontWeight:'900',color:'#536159'},
  photoMeta:{marginTop:3,fontSize:10.5,color:'#7A8780'},
  removeText:{fontSize:10,fontWeight:'900',color:'#9A4747'},
  preview:{marginTop:10,width:'100%',height:180,borderRadius:12,backgroundColor:'#E7ECE9'},
  photoButton:{marginTop:10,minHeight:42,borderRadius:12,borderWidth:1,borderColor:'#275D45',alignItems:'center',justifyContent:'center'},
  photoButtonText:{fontSize:10.5,fontWeight:'900',color:'#275D45'},
  warning:{marginTop:12,fontSize:12.5,fontWeight:'800',color:'#7B632A'},
  valid:{marginTop:12,fontSize:13,fontWeight:'900',color:'#275D45'},
  reject:{marginTop:12,fontSize:12.5,lineHeight:19,fontWeight:'800',color:'#8A3F3F'},
  submit:{marginTop:15,minHeight:50,borderRadius:15,backgroundColor:'#275D45',alignItems:'center',justifyContent:'center'},
  submitOff:{opacity:.38},
  submitText:{fontSize:12,fontWeight:'900',color:'#FFF'},
});

'@
Write-Utf8NoBom "src\app\bible\index.tsx" $member
Write-Host "Updated member Daily Bible evidence screen." -ForegroundColor Green

$monitor=@'
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';

type Assignment={id:string;reading_date:string;bible_reference:string};
type MonitorRow={
  assignment_id:string;
  reading_date:string;
  bible_reference:string;
  user_id:string;
  full_name:string;
  church_id:string|null;
  submission_id:string|null;
  bible_text:string|null;
  bible_photo_path:string|null;
  reflection_text:string|null;
  reflection_photo_path:string|null;
  submission_status:string;
  submitted_at:string|null;
  submitted_on_time:boolean;
  reviewer_can_act:boolean;
};

const EVIDENCE_BUCKET='daily-bible-evidence';
const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromIso=(s:string)=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const monday=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d};

export default function BibleReadingMonitor(){
  const {hasRole,loading:authLoading}=useAuth();
  const isSystemAdmin=hasRole('system_admin');
  const isPastor=hasRole('pastor');
  const allowed=isSystemAdmin||isPastor;

  const [weekStart,setWeekStart]=useState(iso(monday()));
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [rows,setRows]=useState<MonitorRow[]>([]);
  const [points,setPoints]=useState(10);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [photoUrl,setPhotoUrl]=useState<string|null>(null);
  const [photoTitle,setPhotoTitle]=useState('Evidence Photo');
  const [photoBusy,setPhotoBusy]=useState(false);

  const days=useMemo(()=>Array.from({length:7},(_,i)=>iso(addDays(fromIso(weekStart),i))),[weekStart]);

  const loadAssignments=useCallback(async()=>{
    if(!allowed)return;

    const {data:a,error:ae}=await supabase
      .from('daily_bible_assignments')
      .select('id,reading_date,bible_reference')
      .gte('reading_date',days[0])
      .lte('reading_date',days[6])
      .eq('is_published',true)
      .order('reading_date');
    if(ae)throw ae;

    const aa=(a??[]) as Assignment[];
    setAssignments(aa);
    setSelected(current=>current&&aa.some(x=>x.id===current)?current:aa.length?aa[aa.length-1].id:null);

    const {data:r}=await supabase
      .from('buklod_point_rules')
      .select('base_points')
      .eq('activity_type','daily_bible')
      .eq('is_active',true)
      .maybeSingle();
    if(r?.base_points!=null)setPoints(Number(r.base_points));
  },[allowed,days]);

  const loadRows=useCallback(async()=>{
    if(!allowed||!selected){setRows([]);return;}
    const {data,error}=await supabase.rpc('reviewer_get_daily_bible_monitor',{p_assignment_id:selected});
    if(error)throw error;
    setRows((data??[]) as MonitorRow[]);
  },[allowed,selected]);

  useEffect(()=>{
    if(authLoading)return;
    setLoading(true);
    loadAssignments()
      .catch((e:any)=>Alert.alert('Bible Monitoring',e?.message??'Unable to load readings.'))
      .finally(()=>setLoading(false));
  },[authLoading,loadAssignments]);

  useEffect(()=>{
    if(!selected)return;
    setLoading(true);
    loadRows()
      .catch((e:any)=>Alert.alert('Bible Monitoring',e?.message??'Unable to load member records.'))
      .finally(()=>setLoading(false));
  },[selected,loadRows]);

  const counts={
    total:rows.length,
    approved:rows.filter(x=>x.submission_status==='approved').length,
    pending:rows.filter(x=>x.submission_status==='pending_admin').length,
    missed:rows.filter(x=>x.submission_status==='missed').length,
  };

  const review=async(id:string,approve:boolean)=>{
    setBusy(id);
    try{
      const {error}=await supabase.rpc('admin_review_daily_bible_submission',{
        p_submission_id:id,
        p_approve:approve,
        p_admin_note:approve?null:'Please revise your Bible passage evidence and/or reflection, then resubmit.',
      });
      if(error)throw error;
      Alert.alert(
        approve?'Approved':'Returned for Revision',
        approve?`Bible Reading marked VALID. The existing approved-activity workflow will award +${points} BUKLOD Points.`:'The member can revise the evidence and resubmit.'
      );
      await loadRows();
    }catch(e:any){
      Alert.alert('Review',e?.message??'Unable to review.');
    }finally{setBusy(null)}
  };

  const openPhoto=async(path:string,title:string)=>{
    setPhotoBusy(true);
    try{
      const {data,error}=await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path,600);
      if(error)throw error;
      setPhotoTitle(title);
      setPhotoUrl(data.signedUrl);
    }catch(e:any){
      Alert.alert('Evidence Photo',e?.message??'Unable to open this private photo.');
    }finally{setPhotoBusy(false)}
  };

  if(authLoading){
    return <View style={[shared.screen,styles.center]}><ActivityIndicator size="large"/></View>;
  }

  if(!allowed){
    return (
      <View style={[shared.screen,shared.content]}>
        <Text style={shared.h1}>Bible Reading Validation</Text>
        <Card><Text style={shared.body}>This area is for authorized Local Pastors and the BUKLOD System Administrator.</Text></Card>
        <Pressable onPress={()=>router.back()} style={styles.outline}><Text style={styles.outlineText}>BACK</Text></Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={shared.screen} contentContainerStyle={[shared.content,styles.content]}>
        <View style={styles.header}>
          <View style={{flex:1}}>
            <Text style={shared.h1}>Bible Reading Validation</Text>
            <Text style={shared.muted}>
              {isSystemAdmin?'System-wide review and monitoring.':'Your pastoral review queue is limited to members within your authorized Local Church scope.'}
            </Text>
          </View>
          <Pressable onPress={()=>router.back()} style={styles.outline}><Text style={styles.outlineText}>BACK</Text></Pressable>
        </View>

        <Card>
          <View style={styles.weekNav}>
            <Pressable onPress={()=>{setSelected(null);setWeekStart(iso(addDays(fromIso(weekStart),-7)))}}><Text style={styles.nav}>‹ PREV</Text></Pressable>
            <Text style={styles.weekValue}>{fromIso(weekStart).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</Text>
            <Pressable onPress={()=>{setSelected(null);setWeekStart(iso(addDays(fromIso(weekStart),7)))}}><Text style={styles.nav}>NEXT ›</Text></Pressable>
          </View>
        </Card>

        <SectionTitle>DAY</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            {assignments.map(a=>(
              <Pressable key={a.id} onPress={()=>setSelected(a.id)} style={[styles.chip,selected===a.id&&styles.chipActive]}>
                <Text style={[styles.chipDay,selected===a.id&&styles.white]}>
                  {fromIso(a.reading_date).toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()}
                </Text>
                <Text numberOfLines={1} style={[styles.chipRef,selected===a.id&&styles.white]}>{a.bible_reference}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading?<Card><ActivityIndicator/></Card>:!selected?(
          <Card><Text style={shared.muted}>No published Bible readings are set for this week.</Text></Card>
        ):(
          <>
            <Card>
              <Text style={styles.eyebrow}>DAILY SUMMARY</Text>
              <View style={styles.stats}>
                <Stat label="Assigned" value={counts.total}/>
                <Stat label="Valid" value={counts.approved}/>
                <Stat label="Pending" value={counts.pending}/>
                <Stat label="Missed" value={counts.missed}/>
              </View>
            </Card>

            <SectionTitle>MEMBER RECORDS</SectionTitle>

            {!rows.length&&<Card><Text style={shared.muted}>No members are within your review scope for this reading.</Text></Card>}

            {rows.map(row=>(
              <Card key={`${row.assignment_id}:${row.user_id}`}>
                <View style={styles.memberHeader}>
                  <View style={{flex:1}}>
                    <Text style={styles.name}>{row.full_name}</Text>
                    <Text style={styles.meta}>
                      {row.submission_status.replace(/_/g,' ').toUpperCase()}
                      {row.submitted_at?` · ${row.submitted_on_time?'ON TIME':'LATE'}`:''}
                    </Text>
                  </View>
                  <Pill status={row.submission_status}/>
                </View>

                {!!row.submission_id&&(
                  <>
                    <View style={styles.answerBox}>
                      <Text style={styles.eyebrow}>BIBLE PASSAGE EVIDENCE</Text>
                      {!!row.bible_text?<Text style={styles.answer}>{row.bible_text}</Text>:<Text style={styles.emptyEvidence}>No typed Bible text.</Text>}
                      {!!row.bible_photo_path&&(
                        <Pressable disabled={photoBusy} onPress={()=>openPhoto(row.bible_photo_path!,'Handwritten Bible Passage')} style={styles.photoLink}>
                          <Text style={styles.photoLinkText}>{photoBusy?'OPENING...':'VIEW HANDWRITTEN PASSAGE PHOTO'}</Text>
                        </Pressable>
                      )}
                    </View>

                    <View style={styles.answerBox}>
                      <Text style={styles.eyebrow}>REFLECTION EVIDENCE</Text>
                      {!!row.reflection_text?<Text style={styles.answer}>{row.reflection_text}</Text>:<Text style={styles.emptyEvidence}>No typed reflection.</Text>}
                      {!!row.reflection_photo_path&&(
                        <Pressable disabled={photoBusy} onPress={()=>openPhoto(row.reflection_photo_path!,'Handwritten Reflection')} style={styles.photoLink}>
                          <Text style={styles.photoLinkText}>{photoBusy?'OPENING...':'VIEW HANDWRITTEN REFLECTION PHOTO'}</Text>
                        </Pressable>
                      )}
                    </View>
                  </>
                )}

                {row.submission_status==='pending_admin'&&row.submission_id&&row.reviewer_can_act&&(
                  <View style={styles.actions}>
                    <Pressable disabled={busy===row.submission_id} onPress={()=>review(row.submission_id!,false)} style={styles.returnBtn}>
                      <Text style={styles.returnText}>RETURN</Text>
                    </Pressable>
                    <Pressable disabled={busy===row.submission_id} onPress={()=>review(row.submission_id!,true)} style={styles.approveBtn}>
                      <Text style={styles.approveText}>{busy===row.submission_id?'WORKING...':'APPROVE'}</Text>
                    </Pressable>
                  </View>
                )}

                {row.submission_status==='pending_admin'&&!row.reviewer_can_act&&(
                  <Text style={styles.selfNote}>Your own Bible Reading must be reviewed by the System Admin or another authorized reviewer.</Text>
                )}
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={!!photoUrl} transparent animationType="fade" onRequestClose={()=>setPhotoUrl(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{photoTitle}</Text>
              <Pressable onPress={()=>setPhotoUrl(null)}><Text style={styles.closeText}>CLOSE</Text></Pressable>
            </View>
            {!!photoUrl&&<Image source={{uri:photoUrl}} style={styles.fullPhoto} resizeMode="contain"/>}
          </View>
        </View>
      </Modal>
    </>
  );
}

function Stat({label,value}:{label:string;value:number}){
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function Pill({status}:{status:string}){
  const text=status==='approved'?'VALID':status==='pending_admin'?'PENDING':status==='rejected'?'REVISE':status==='missed'?'MISSED':'OPEN';
  return <View style={styles.pill}><Text style={styles.pillText}>{text}</Text></View>;
}

const styles=StyleSheet.create({
  content:{paddingBottom:40,gap:14},
  center:{flex:1,alignItems:'center',justifyContent:'center'},
  header:{flexDirection:'row',gap:12,alignItems:'flex-start'},
  outline:{paddingHorizontal:12,paddingVertical:9,borderWidth:1,borderColor:'#D7DFDA',borderRadius:12},
  outlineText:{fontSize:11,fontWeight:'900',color:'#275D45'},
  weekNav:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  nav:{padding:8,fontSize:11,fontWeight:'900',color:'#275D45'},
  weekValue:{fontSize:16,fontWeight:'900',color:'#23382E'},
  chips:{flexDirection:'row',gap:8},
  chip:{width:130,padding:11,borderRadius:14,borderWidth:1,borderColor:'#D9E1DC',backgroundColor:'#FFF'},
  chipActive:{backgroundColor:'#275D45',borderColor:'#275D45'},
  chipDay:{fontSize:9.5,fontWeight:'900',color:'#708078'},
  chipRef:{marginTop:4,fontSize:12,fontWeight:'800',color:'#283A31'},
  white:{color:'#FFF'},
  eyebrow:{fontSize:9.5,fontWeight:'900',color:'#728078'},
  stats:{flexDirection:'row',gap:8,marginTop:12},
  stat:{flex:1,paddingVertical:10,alignItems:'center',borderRadius:12,backgroundColor:'#F2F5F3'},
  statValue:{fontSize:20,fontWeight:'900',color:'#25382F'},
  statLabel:{fontSize:8.5,fontWeight:'800',color:'#758179'},
  memberHeader:{flexDirection:'row',gap:10,alignItems:'center'},
  name:{fontSize:16,fontWeight:'900',color:'#23382E'},
  meta:{marginTop:3,fontSize:9.5,fontWeight:'700',color:'#78857D'},
  pill:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:'#E7ECE9'},
  pillText:{fontSize:8.5,fontWeight:'900',color:'#384A40'},
  answerBox:{marginTop:12,padding:12,borderRadius:13,backgroundColor:'#F6F8F7'},
  answer:{marginTop:6,fontSize:14,lineHeight:21,color:'#34463C'},
  emptyEvidence:{marginTop:6,fontSize:12,fontStyle:'italic',color:'#7B8881'},
  photoLink:{marginTop:10,minHeight:40,borderRadius:11,borderWidth:1,borderColor:'#275D45',alignItems:'center',justifyContent:'center'},
  photoLinkText:{fontSize:10,fontWeight:'900',color:'#275D45'},
  actions:{flexDirection:'row',gap:8,marginTop:13},
  returnBtn:{flex:1,minHeight:44,borderRadius:13,borderWidth:1,borderColor:'#9A5555',alignItems:'center',justifyContent:'center'},
  returnText:{fontSize:11,fontWeight:'900',color:'#8A4141'},
  approveBtn:{flex:1,minHeight:44,borderRadius:13,backgroundColor:'#275D45',alignItems:'center',justifyContent:'center'},
  approveText:{fontSize:11,fontWeight:'900',color:'#FFF'},
  selfNote:{marginTop:12,fontSize:11.5,lineHeight:18,fontWeight:'700',color:'#7B632A'},
  modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.78)',justifyContent:'center',padding:18},
  modalCard:{backgroundColor:'#FFF',borderRadius:18,padding:12,maxHeight:'90%'},
  modalHeader:{flexDirection:'row',alignItems:'center',gap:10,paddingBottom:10},
  modalTitle:{flex:1,fontSize:15,fontWeight:'900',color:'#23382E'},
  closeText:{fontSize:11,fontWeight:'900',color:'#275D45'},
  fullPhoto:{width:'100%',height:540,borderRadius:12,backgroundColor:'#EEF2F0'},
});

'@
Write-Utf8NoBom "src\components\BibleReadingMonitor.tsx" $monitor
Write-Utf8NoBom "src\app\admin\bible\monitor.tsx" "export { default } from '@/components/BibleReadingMonitor';`r`n"
Write-Utf8NoBom "src\app\leader\bible.tsx" "export { default } from '@/components/BibleReadingMonitor';`r`n"
Write-Host "Created shared System Admin / Local Pastor validation screen." -ForegroundColor Green

# Add Pastor menu entry under Formation Validation.
$mePath="src\app\(tabs)\me.tsx"
$me=Get-Content -LiteralPath $mePath -Raw
if($me -notmatch 'title="Bible Reading Validation"'){
  $newMenu=@'
          {isPastor && (
            <MenuRow
              icon="book-check-outline"
              title="Bible Reading Validation"
              subtitle="Review Bible passage and reflection evidence"
              onPress={() => router.push('/leader/bible')}
            />
          )}

'@
  $menuMatch=[regex]::Match($me,'(?m)^\s*\{isMentor && \(')
  if(-not $menuMatch.Success){throw "Could not find Pastor/Ministry menu insertion point in me.tsx"}
  $me=$me.Insert($menuMatch.Index,$newMenu)
  Write-Utf8NoBom $mePath $me
  Write-Host "Added Bible Reading Validation to Pastor Ministry tools." -ForegroundColor Green
}else{
  Write-Host "Pastor Bible Reading Validation menu already exists." -ForegroundColor Yellow
}

# Register leader route.
$layoutPath="src\app\_layout.tsx"
$layout=Get-Content -LiteralPath $layoutPath -Raw
if($layout -notmatch 'name="leader/bible"'){
  $routeMatch=[regex]::Match($layout,'(?m)^(\s*)<Stack\.Screen name="(?:leader/formation|admin/bible/monitor|bible/index)"[^>]*/>')
  if(-not $routeMatch.Success){throw "Could not find route insertion point in _layout.tsx"}
  $indent=$routeMatch.Groups[1].Value
  $route=$indent+'<Stack.Screen name="leader/bible" />'
  $insertAt=$routeMatch.Index+$routeMatch.Length
  $layout=$layout.Insert($insertAt,"`r`n$route")
  Write-Utf8NoBom $layoutPath $layout
  Write-Host "Registered /leader/bible route." -ForegroundColor Green
}else{
  Write-Host "/leader/bible route already registered." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "PATCH 142 COMPLETE" -ForegroundColor Cyan
Write-Host "Run next: npx tsc --noEmit"
Write-Host "Then:     npx supabase db push --dry-run"
