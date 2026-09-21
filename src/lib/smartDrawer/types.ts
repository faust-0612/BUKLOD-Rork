export type SmartDrawerItemType =
  | 'SHOPPING_LIST'
  | 'CHECKLIST'
  | 'TASK'
  | 'DUE_TASK'
  | 'EVENT'
  | 'APPOINTMENT'
  | 'PROGRAM'
  | 'WRITING'
  | 'POEM'
  | 'IDEA'
  | 'REFERENCE'
  | 'DOCUMENT'
  | 'RECEIPT'
  | 'NOTICE'
  | 'CONTACT_REFERENCE'
  | 'QUICK_NOTE'
  | 'OTHER';

export type SmartDrawerItemStatus =
  | 'ACTIVE'
  | 'DONE'
  | 'ARCHIVED'
  | 'RECENTLY_REMOVED';

export type SmartDrawerSyncState =
  | 'LOCAL_ONLY'
  | 'PENDING'
  | 'SYNCED'
  | 'SYNC_ERROR';

export type SmartDrawerAsset = {
  id: string;
  uri: string;
  kind: 'SCAN' | 'PHOTO' | 'IMPORT';
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  originalName?: string | null;
  cloudPath?: string | null;
};

export type SmartDrawerListItem = {
  id: string;
  text: string;
  done: boolean;
};

export type SmartDrawerItem = {
  id: string;
  userId: string;
  type: SmartDrawerItemType;
  title: string;
  body: string;
  extractedText: string;
  location: string;
  dueAt: string | null;
  eventAt: string | null;
  status: SmartDrawerItemStatus;
  keepOnTop: boolean;
  reminderMuted: boolean;
  reminderIds: string[];
  listItems: SmartDrawerListItem[];
  assets: SmartDrawerAsset[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  revision: number;
  syncState: SmartDrawerSyncState;
};

export type SmartDrawerDraft = Partial<
  Omit<
    SmartDrawerItem,
    'id' | 'userId' | 'createdAt' | 'updatedAt' | 'revision'
  >
> & {
  id?: string;
  title?: string;
  body?: string;
};

export type SmartDrawerClassification = {
  type: SmartDrawerItemType;
  title: string;
  dueAt: string | null;
  eventAt: string | null;
  listItems: SmartDrawerListItem[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
};

export type SmartDrawerQuery = {
  search?: string;
  view?: string;
  limit?: number;
  offset?: number;
};

export type SmartDrawerSummary = {
  forYou: SmartDrawerItem[];
  dueSoon: number;
  overdue: number;
  activeLists: number;
  totalActive: number;
};
