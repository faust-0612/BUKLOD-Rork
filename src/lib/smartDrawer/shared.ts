import { supabase } from '@/lib/supabase';
import type { SmartDrawerItem, SmartDrawerListItem } from './types';

export type SharedDrawerRole = 'VIEWER' | 'EDITOR';
export type SharedDrawerItem = {
  id: string;
  owner_id: string;
  source_local_id: string | null;
  scope_id: string | null;
  folder_id: string | null;
  assigned_to: string | null;
  title: string;
  body: string;
  item_type: string;
  list_items: SmartDrawerListItem[];
  due_at: string | null;
  expires_at: string | null;
  protected_from_expiry: boolean;
  status: 'ACTIVE' | 'DONE' | 'ARCHIVED' | 'RECENTLY_REMOVED';
  revision: number;
  created_at: string;
  updated_at: string;
};

export type SharedDrawerFolder = {
  id: string;
  owner_id: string;
  scope_id: string | null;
  name: string;
  created_at: string;
};

const ITEM_FIELDS = 'id,owner_id,source_local_id,scope_id,folder_id,assigned_to,title,body,item_type,list_items,due_at,expires_at,protected_from_expiry,status,revision,created_at,updated_at';

export type SharedDrawerGrant = {
  item_id: string;
  owner_id: string;
  user_id: string;
  access_role: SharedDrawerRole;
};

function rowToSharedItem(row: Record<string, any>): SharedDrawerItem {
  return {
    id: String(row.id),
    owner_id: String(row.owner_id),
    source_local_id: row.source_local_id ?? null,
    scope_id: row.scope_id ?? null,
    folder_id: row.folder_id ?? null,
    assigned_to: row.assigned_to ?? null,
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    item_type: String(row.item_type ?? 'TASK'),
    list_items: Array.isArray(row.list_items) ? row.list_items : [],
    due_at: row.due_at ?? null,
    expires_at: row.expires_at ?? null,
    protected_from_expiry: row.protected_from_expiry !== false,
    status: row.status === 'DONE' || row.status === 'ARCHIVED' || row.status === 'RECENTLY_REMOVED'
      ? row.status : 'ACTIVE',
    revision: Number(row.revision ?? 1),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/**
 * Only an explicit user action copies the chosen fields to the server.
 * Original local assets, extracted document text and every other Drawer
 * item stay exclusively on the device.
 */
export async function shareSmartDrawerItem(
  ownerId: string,
  item: SmartDrawerItem,
  target:
    | { kind: 'CLUSTER'; scopeId: string }
    | { kind: 'PERSON'; userId: string; role: SharedDrawerRole },
) {
  if (!ownerId || item.userId !== ownerId) {
    throw new Error('Only the Drawer item owner can share this item.');
  }
  const title = item.title.trim();
  if (!title || title.length > 160) {
    throw new Error('Enter a short title (up to 160 characters). Notes have no character limit.');
  }
  if (target.kind === 'PERSON' && target.userId === ownerId) {
    throw new Error('Select another person to collaborate with.');
  }

  const { data, error } = await supabase
    .from('buklod_drawer_shared_items')
    .insert({
      owner_id: ownerId,
      source_local_id: item.id,
      scope_id: target.kind === 'CLUSTER' ? target.scopeId : null,
      title,
      body: item.body,
      item_type: item.type,
      list_items: item.listItems,
      due_at: item.dueAt,
      expires_at: item.expiresAt,
      protected_from_expiry: item.protectedFromExpiry || item.keepOnTop,
      status: item.status === 'DONE' || item.status === 'ARCHIVED'
        ? item.status : 'ACTIVE',
    })
    .select('id')
    .single();
  throwIfError(error);
  if (!data?.id) throw new Error('Sharing did not return an item ID.');

  const sharedId = String(data.id);
  if (target.kind === 'PERSON') {
    const { error: grantError } = await supabase
      .from('buklod_drawer_collaborators')
      .insert({
        item_id: sharedId,
        owner_id: ownerId,
        user_id: target.userId,
        access_role: target.role,
      });

    if (grantError) {
      // Do not leave a private document in an orphaned shared workspace
      // when its intended invitation was rejected.
      await supabase.from('buklod_drawer_shared_items')
        .delete().eq('id', sharedId).eq('owner_id', ownerId);
      throw new Error(grantError.message);
    }
  }
  return sharedId;
}

export async function loadSharedDrawerItems(limit = 50) {
  const { data, error } = await supabase
    .from('buklod_drawer_shared_items')
    .select(ITEM_FIELDS)
    .order('updated_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  throwIfError(error);
  return (data ?? []).map(rowToSharedItem);
}

export async function loadSharedDrawerItem(id: string) {
  const { data, error } = await supabase
    .from('buklod_drawer_shared_items')
    .select(ITEM_FIELDS)
    .eq('id', id)
    .maybeSingle();
  throwIfError(error);
  return data ? rowToSharedItem(data) : null;
}

export async function loadSharedDrawerGrants(itemId: string) {
  const { data, error } = await supabase
    .from('buklod_drawer_collaborators')
    .select('item_id,owner_id,user_id,access_role')
    .eq('item_id', itemId)
    .limit(100);
  throwIfError(error);
  return (data ?? []) as SharedDrawerGrant[];
}

export async function updateSharedDrawerItem(
  item: SharedDrawerItem,
  changes: Partial<Pick<SharedDrawerItem, 'title' | 'body' | 'list_items' | 'due_at' | 'status' | 'folder_id' | 'assigned_to' | 'expires_at' | 'protected_from_expiry'>>,
) {
  const nextTitle = changes.title ?? item.title;
  if (!nextTitle.trim() || nextTitle.length > 160) {
    throw new Error('The title must have 1–160 characters. Notes have no character limit.');
  }
  const { data, error } = await supabase
    .from('buklod_drawer_shared_items')
    .update({ ...changes, revision: item.revision + 1 })
    .eq('id', item.id)
    .eq('revision', item.revision)
    .select(ITEM_FIELDS)
    .maybeSingle();
  throwIfError(error);
  if (!data) {
    throw new Error('Someone edited this shared item. Reload before saving your changes.');
  }
  return rowToSharedItem(data);
}

export async function revokeSharedDrawerAccess(itemId: string, userId: string) {
  const { error } = await supabase
    .from('buklod_drawer_collaborators')
    .delete()
    .eq('item_id', itemId)
    .eq('user_id', userId);
  throwIfError(error);
}

export async function inviteSharedDrawerCollaborator(
  item: SharedDrawerItem,
  inviterId: string,
  userId: string,
  role: SharedDrawerRole,
) {
  if (item.owner_id !== inviterId || inviterId === userId) {
    throw new Error('Only the owner may invite another collaborator.');
  }
  const { error } = await supabase
    .from('buklod_drawer_collaborators')
    .insert({
      item_id: item.id,
      owner_id: inviterId,
      user_id: userId,
      access_role: role,
    });
  throwIfError(error);
}

export async function deleteSharedDrawerItem(itemId: string, ownerId: string) {
  const { error } = await supabase
    .from('buklod_drawer_shared_items')
    .delete()
    .eq('id', itemId)
    .eq('owner_id', ownerId);
  throwIfError(error);
}

export async function loadSharedDrawerFolders() {
  const { data, error } = await supabase.from('buklod_drawer_shared_folders')
    .select('id,owner_id,scope_id,name,created_at').order('name').limit(100);
  throwIfError(error);
  return (data ?? []) as SharedDrawerFolder[];
}

export async function createSharedDrawerWorkItem(ownerId: string, input: {
  folderId?: string | null;
  scopeId?: string | null;
  title: string;
  body?: string;
}) {
  const title = input.title.trim();
  if (!title || title.length > 160) throw new Error('Enter a title (up to 160 characters). The note body has no character limit.');
  const { data, error } = await supabase.from('buklod_drawer_shared_items')
    .insert({
      owner_id: ownerId,
      folder_id: input.folderId ?? null,
      scope_id: input.scopeId ?? null,
      title, body: input.body ?? '',
      item_type: 'TASK', list_items: [], status: 'ACTIVE', protected_from_expiry: true,
    })
    .select('id').single();
  throwIfError(error);
  if (!data?.id) throw new Error('The new workspace task was not saved.');
  return String(data.id);
}

export async function createSharedDrawerFolder(ownerId: string, name: string, scopeId: string | null) {
  const clean = name.trim();
  if (!clean || clean.length > 100) throw new Error('Project folder name must have 1–100 characters.');
  const { data, error } = await supabase.from('buklod_drawer_shared_folders')
    .insert({ owner_id: ownerId, scope_id: scopeId, name: clean })
    .select('id,owner_id,scope_id,name,created_at').single();
  throwIfError(error);
  return data as SharedDrawerFolder;
}

export async function renameSharedDrawerFolder(folderId: string, ownerId: string, name: string) {
  const clean = name.trim();
  if (!clean || clean.length > 100) throw new Error('Project folder name must have 1–100 characters.');
  const { error } = await supabase.from('buklod_drawer_shared_folders').update({ name: clean })
    .eq('id', folderId).eq('owner_id', ownerId);
  throwIfError(error);
}

export async function deleteSharedDrawerFolder(folderId: string, ownerId: string) {
  const { error } = await supabase.from('buklod_drawer_shared_folders').delete()
    .eq('id', folderId).eq('owner_id', ownerId);
  throwIfError(error);
  // The foreign key uses ON DELETE SET NULL; shared items remain intact.
}
