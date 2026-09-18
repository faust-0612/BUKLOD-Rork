import * as DocumentPicker from 'expo-document-picker';

import { supabase } from '@/lib/supabase';

export type BahayRole = 'OWNER'|'ADMIN'|'ADULT'|'TEEN'|'CHILD'|'HELPER'|'GUEST';
export type BahayRoom = 'SALA'|'KITCHEN'|'BEDROOM'|'DRAWER'|'CALENDAR'|'BILLS'|'GARDEN'|'GENERAL';
export type BahayVisibility = 'SHARED'|'ADULTS'|'PRIVATE';

export type BahayHome = {
  id: string;
  name: string;
  home_kind: 'PHYSICAL'|'VIRTUAL';
  created_by: string;
  garden_energy: number;
  garden_seeds: number;
  garden_harvests: number;
  role?: BahayRole;
};

export type BahayMember = {
  home_id: string;
  user_id: string;
  role: BahayRole;
  status: 'PENDING'|'ACTIVE'|'DECLINED'|'REMOVED';
  expires_at?: string|null;
  profiles?: { full_name?: string|null; username?: string|null; avatar_url?: string|null }|null;
};

export type BahayItem = {
  id: string;
  home_id: string;
  room: BahayRoom;
  item_type: string;
  title: string;
  body?: string|null;
  assigned_to?: string|null;
  due_at?: string|null;
  amount?: number|null;
  visibility: BahayVisibility;
  reminder_enabled: boolean;
  is_done: boolean;
  created_by: string;
  created_at: string;
  recurrence?: 'NONE'|'DAILY'|'WEEKLY'|'MONTHLY';
  rotation_enabled?: boolean;
  requires_confirmation?: boolean;
  confirmation_status?: 'NONE'|'PENDING'|'CONFIRMED'|'REJECTED';
  completed_by?: string|null;
};

export type BahayMessage = {
  id: string;
  home_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles?: { full_name?: string|null; username?: string|null }|null;
};

export type BahayPlant = {
  id: string;
  home_id: string;
  plant_type: string;
  nickname?: string|null;
  stage: number;
  water_count: number;
  harvested_at?: string|null;
  planted_at: string;
};

export type BahayCommunity = {
  id: string;
  name: string;
  community_kind: 'COMPOUND'|'SUBDIVISION'|'VIRTUAL';
  parent_community_id?: string|null;
  join_code: string;
  role?: 'ADMIN'|'MEMBER';
};

export function errorMessage(error: any, fallback = 'Hindi natuloy. Subukan muli.') {
  return String(error?.message ?? error?.error_description ?? error ?? fallback);
}

export async function loadBahayHomes(userId: string) {
  const memberships = await (supabase as any)
    .from('buklod_home_members')
    .select('home_id,role,status,expires_at')
    .eq('user_id', userId)
    .in('status', ['ACTIVE','PENDING'])
    .order('created_at', { ascending: true });
  if (memberships.error) throw memberships.error;

  const active = (memberships.data ?? []).filter((m: any) => m.status === 'ACTIVE');
  const pending = (memberships.data ?? []).filter((m: any) => m.status === 'PENDING');
  const ids = active.map((m: any) => m.home_id);
  let homes: any[] = [];
  if (ids.length) {
    const result = await (supabase as any)
      .from('buklod_homes')
      .select('id,name,home_kind,created_by,garden_energy,garden_seeds,garden_harvests')
      .in('id', ids)
      .order('created_at', { ascending: true });
    if (result.error) throw result.error;
    homes = (result.data ?? []).map((home: any) => ({
      ...home,
      role: active.find((m: any) => m.home_id === home.id)?.role,
    }));
  }

  let invitations: any[] = [];
  if (pending.length) {
    const pendingIds = pending.map((m: any) => m.home_id);
    const result = await (supabase as any)
      .from('buklod_homes')
      .select('id,name,home_kind,created_by')
      .in('id', pendingIds);
    invitations = (result.data ?? []).map((home: any) => ({
      ...home,
      role: pending.find((m: any) => m.home_id === home.id)?.role,
    }));
  }
  return { homes: homes as BahayHome[], invitations };
}

export async function createBahay(name: string, kind: 'PHYSICAL'|'VIRTUAL') {
  const result = await (supabase as any).rpc('buklod_home_create_v1', {
    p_name: name,
    p_kind: kind,
  });
  if (result.error) throw result.error;
  return String(result.data);
}

export async function decideBahayInvite(homeId: string, accept: boolean) {
  const result = await (supabase as any).rpc('buklod_home_invite_decide_v1', {
    p_home_id: homeId,
    p_accept: accept,
  });
  if (result.error) throw result.error;
}

export async function inviteKasambahay(homeId: string, identifier: string, role: BahayRole, expiresAt?: string|null) {
  const result = await (supabase as any).rpc('buklod_home_invite_v1', {
    p_home_id: homeId,
    p_identifier: identifier,
    p_role: role,
    p_expires_at: expiresAt ?? null,
  });
  if (result.error) throw result.error;
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

export async function loadBahaySnapshot(homeId: string) {
  const [homeResult, memberResult, itemResult, messageResult, fileResult, plantResult, communityLinkResult, pollResult, optionResult, voteResult] = await Promise.all([
    (supabase as any).from('buklod_homes').select('*').eq('id', homeId).single(),
    (supabase as any).from('buklod_home_members').select('home_id,user_id,role,status,expires_at').eq('home_id', homeId).eq('status','ACTIVE').order('joined_at'),
    (supabase as any).from('buklod_home_items').select('*').eq('home_id', homeId).order('created_at',{ascending:false}).limit(160),
    (supabase as any).from('buklod_home_messages').select('id,home_id,sender_id,body,created_at').eq('home_id',homeId).order('created_at',{ascending:false}).limit(60),
    (supabase as any).from('buklod_home_files').select('*').eq('home_id',homeId).order('created_at',{ascending:false}).limit(80),
    (supabase as any).from('buklod_home_garden_plants').select('*').eq('home_id',homeId).order('planted_at',{ascending:false}),
    (supabase as any).from('buklod_home_community_homes').select('community_id,role,buklod_home_communities:community_id(id,name,community_kind,parent_community_id,join_code)').eq('home_id',homeId),
    (supabase as any).from('buklod_home_polls').select('*').eq('home_id',homeId).order('created_at',{ascending:false}).limit(20),
    (supabase as any).from('buklod_home_poll_options').select('*'),
    (supabase as any).from('buklod_home_poll_votes').select('*'),
  ]);
  for (const result of [homeResult,memberResult,itemResult,messageResult,fileResult,plantResult,communityLinkResult,pollResult,optionResult,voteResult]) {
    if (result.error) throw result.error;
  }
  const identities = await (supabase as any).rpc('buklod_home_member_directory_v1', { p_home_id: homeId });
  const identityMap = new Map<string, any>(
    (identities.error ? [] : identities.data ?? []).map((row: any) => [row.user_id,row]),
  );

  const membersWithProfiles = (memberResult.data ?? []).map((row: any) => ({
    ...row,
    profiles: identityMap.get(row.user_id) ?? null,
  }));
  const messagesWithProfiles = (messageResult.data ?? []).map((row: any) => ({
    ...row,
    profiles: identityMap.get(row.sender_id) ?? null,
  }));

  const pollIds = new Set((pollResult.data ?? []).map((row:any)=>row.id));
  const polls = (pollResult.data ?? []).map((poll:any)=>({
    ...poll,
    options:(optionResult.data ?? []).filter((option:any)=>option.poll_id===poll.id).map((option:any)=>({
      ...option,
      votes:(voteResult.data ?? []).filter((vote:any)=>vote.option_id===option.id && pollIds.has(vote.poll_id)),
    })),
  }));

  const communities = (communityLinkResult.data ?? []).map((row: any) => ({
    ...(row.buklod_home_communities ?? {}),
    role: row.role,
  })).filter((x: any) => x.id);
  return {
    home: homeResult.data as BahayHome,
    members: membersWithProfiles as BahayMember[],
    items: (itemResult.data ?? []) as BahayItem[],
    messages: messagesWithProfiles as BahayMessage[],
    files: fileResult.data ?? [],
    plants: (plantResult.data ?? []) as BahayPlant[],
    communities: communities as BahayCommunity[],
    polls,
  };
}

export async function addBahayItem(input: {
  homeId: string;
  userId: string;
  room: BahayRoom;
  type: string;
  title: string;
  body?: string;
  assignedTo?: string|null;
  dueAt?: string|null;
  amount?: number|null;
  visibility?: BahayVisibility;
  recurrence?: 'NONE'|'DAILY'|'WEEKLY'|'MONTHLY';
  rotationEnabled?: boolean;
  requiresConfirmation?: boolean;
}) {
  const result = await (supabase as any).from('buklod_home_items').insert({
    home_id: input.homeId,
    room: input.room,
    item_type: input.type,
    title: input.title.trim(),
    body: input.body?.trim() || null,
    assigned_to: input.assignedTo ?? null,
    due_at: input.dueAt ?? null,
    amount: input.amount ?? null,
    visibility: input.visibility ?? 'SHARED',
    recurrence: input.recurrence ?? 'NONE',
    rotation_enabled: Boolean(input.rotationEnabled),
    requires_confirmation: Boolean(input.requiresConfirmation),
    created_by: input.userId,
  }).select('*').single();
  if (result.error) throw result.error;
  return result.data as BahayItem;
}

export async function toggleBahayItem(item: BahayItem) {
  const result = await (supabase as any).rpc('buklod_home_complete_item_v1', {
    p_item_id: item.id,
    p_done: !item.is_done,
  });
  if (result.error) throw result.error;
}

export async function confirmBahayItem(itemId: string, approve: boolean) {
  const result = await (supabase as any).rpc('buklod_home_confirm_item_v1', {
    p_item_id: itemId,
    p_approve: approve,
  });
  if (result.error) throw result.error;
}

export async function loadBahayPreferences(homeId: string, userId: string) {
  const result = await (supabase as any)
    .from('buklod_home_member_preferences')
    .select('quiet_enabled,quiet_start,quiet_end,timezone,notify_messages,notify_tasks,notify_due')
    .eq('home_id',homeId)
    .eq('user_id',userId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data ?? {
    quiet_enabled:false,
    quiet_start:'22:00:00',
    quiet_end:'07:00:00',
    timezone:'Asia/Manila',
    notify_messages:true,
    notify_tasks:true,
    notify_due:true,
  };
}

export async function saveBahayPreferences(homeId: string, userId: string, prefs: {
  quiet_enabled: boolean;
  notify_messages: boolean;
  notify_tasks: boolean;
  notify_due: boolean;
}) {
  const result = await (supabase as any)
    .from('buklod_home_member_preferences')
    .upsert({
      home_id:homeId,
      user_id:userId,
      quiet_enabled:prefs.quiet_enabled,
      quiet_start:'22:00',
      quiet_end:'07:00',
      timezone:'Asia/Manila',
      notify_messages:prefs.notify_messages,
      notify_tasks:prefs.notify_tasks,
      notify_due:prefs.notify_due,
      updated_at:new Date().toISOString(),
    },{onConflict:'home_id,user_id'});
  if (result.error) throw result.error;
}

export async function createBahayPoll(homeId: string, userId: string, question: string, options: string[]) {
  const clean = options.map((x)=>x.trim()).filter(Boolean).slice(0,6);
  if (clean.length < 2) throw new Error('Add at least two choices.');
  const poll = await (supabase as any).from('buklod_home_polls').insert({
    home_id:homeId, question:question.trim(), created_by:userId,
  }).select('id').single();
  if (poll.error) throw poll.error;
  const rows = clean.map((label,index)=>({poll_id:poll.data.id,label,sort_order:index}));
  const inserted = await (supabase as any).from('buklod_home_poll_options').insert(rows);
  if (inserted.error) throw inserted.error;
  return poll.data.id as string;
}

export async function voteBahayPoll(pollId: string, optionId: string, userId: string) {
  await (supabase as any).from('buklod_home_poll_votes').delete().eq('poll_id',pollId).eq('user_id',userId);
  const result = await (supabase as any).from('buklod_home_poll_votes').insert({
    poll_id:pollId, option_id:optionId, user_id:userId,
  });
  if (result.error) throw result.error;
}

export async function sendBahayMessage(homeId: string, userId: string, body: string) {
  const result = await (supabase as any).from('buklod_home_messages').insert({
    home_id: homeId, sender_id: userId, body: body.trim(),
  });
  if (result.error) throw result.error;
}

export async function claimBahayGardenAdReward(homeId: string, rewardToken: string) {
  const result = await (supabase as any).rpc('buklod_home_rewarded_ad_grant_v1', {
    p_home_id: homeId,
    p_reward_token: rewardToken,
  });
  if (result.error) throw result.error;
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return {
    granted: Boolean(row?.granted),
    remainingToday: Number(row?.remaining_today ?? 0),
    gardenEnergy: Number(row?.garden_energy ?? 0),
  };
}

export async function plantBahayGarden(homeId: string, plantType = 'SUNFLOWER', nickname?: string) {
  const result = await (supabase as any).rpc('buklod_home_plant_v1', {
    p_home_id: homeId, p_type: plantType, p_nickname: nickname?.trim() || null,
  });
  if (result.error) throw result.error;
  return result.data as string;
}

export async function waterBahayPlant(plantId: string) {
  const result = await (supabase as any).rpc('buklod_home_water_plant_v1', { p_plant_id: plantId });
  if (result.error) throw result.error;
  return Number(result.data ?? 1);
}

export async function createBahayCommunity(homeId: string, name: string, kind: 'COMPOUND'|'SUBDIVISION'|'VIRTUAL', parent?: string|null) {
  const result = await (supabase as any).rpc('buklod_home_create_community_v1', {
    p_home_id: homeId, p_name: name, p_kind: kind, p_parent: parent ?? null,
  });
  if (result.error) throw result.error;
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

export async function joinBahayCommunity(homeId: string, code: string) {
  const result = await (supabase as any).rpc('buklod_home_join_community_v1', {
    p_home_id: homeId, p_code: code.trim(),
  });
  if (result.error) throw result.error;
  return String(result.data);
}

export async function loadCommunity(communityId: string) {
  const [items,messages] = await Promise.all([
    (supabase as any).from('buklod_home_community_items').select('*').eq('community_id',communityId).order('created_at',{ascending:false}).limit(80),
    (supabase as any).from('buklod_home_community_messages').select('*').eq('community_id',communityId).order('created_at',{ascending:false}).limit(60),
  ]);
  if (items.error) throw items.error;
  if (messages.error) throw messages.error;
  return { items: items.data ?? [], messages: messages.data ?? [] };
}

export async function addCommunityGoal(communityId: string, userId: string, title: string, body?: string) {
  const result = await (supabase as any).from('buklod_home_community_items').insert({
    community_id: communityId, item_type:'GOAL', title:title.trim(), body:body?.trim() || null, created_by:userId,
  });
  if (result.error) throw result.error;
}

export async function sendCommunityMessage(communityId: string, userId: string, body: string) {
  const result = await (supabase as any).from('buklod_home_community_messages').insert({
    community_id:communityId, sender_id:userId, body:body.trim(),
  });
  if (result.error) throw result.error;
}

export async function pickAndUploadBahayFile(input: {
  homeId: string;
  userId: string;
  visibility: BahayVisibility;
}) {
  const picked = await DocumentPicker.getDocumentAsync({ multiple:false, copyToCacheDirectory:true });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];
  const size = Number(asset.size ?? 0);
  if (size > 10 * 1024 * 1024) throw new Error('Maximum 10 MB per file.');
  const scope = input.visibility === 'PRIVATE'
    ? `private/${input.userId}`
    : input.visibility === 'ADULTS' ? 'adults' : 'shared';
  const safeName = String(asset.name || 'file').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-100);
  const storagePath = `${input.homeId}/${scope}/${Date.now()}-${safeName}`;
  const response = await fetch(asset.uri);
  const bytes = await response.arrayBuffer();
  const upload = await (supabase as any).storage.from('buklod-home-drawer').upload(storagePath, bytes, {
    contentType: asset.mimeType || 'application/octet-stream',
    upsert: false,
  });
  if (upload.error) throw upload.error;
  const metadata = await (supabase as any).from('buklod_home_files').insert({
    home_id:input.homeId,
    owner_id:input.userId,
    room: input.visibility === 'PRIVATE' ? 'BEDROOM' : 'DRAWER',
    visibility:input.visibility,
    file_name:asset.name || safeName,
    storage_path:storagePath,
    mime_type:asset.mimeType || null,
    size_bytes:size,
  }).select('*').single();
  if (metadata.error) {
    await (supabase as any).storage.from('buklod-home-drawer').remove([storagePath]);
    throw metadata.error;
  }
  return metadata.data;
}

export async function openBahayFile(path: string) {
  const result = await (supabase as any).storage.from('buklod-home-drawer').createSignedUrl(path, 600);
  if (result.error) throw result.error;
  return String(result.data?.signedUrl || '');
}

export function subscribeBahay(homeId: string, onChange: () => void) {
  const channel = (supabase as any)
    .channel(`buklod-bahay:${homeId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'buklod_home_items',filter:`home_id=eq.${homeId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'buklod_home_messages',filter:`home_id=eq.${homeId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'buklod_home_members',filter:`home_id=eq.${homeId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'buklod_home_garden_plants',filter:`home_id=eq.${homeId}`},onChange)
    .subscribe();
  return () => { void (supabase as any).removeChannel(channel); };
}
