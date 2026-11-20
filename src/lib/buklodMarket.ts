import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

export type MarketStore = {
  id: string; owner_id: string; seller_type: 'individual' | 'business';
  name: string; description: string; city: string; province: string; barangay: string;
  is_open: boolean; verification_state: string;
};
export type MarketListing = {
  id: string; store_id: string; owner_id: string; title: string; description: string;
  kind: 'product' | 'service'; category: string; unit: string; price_php: number;
  stock_status: 'available' | 'sold_out'; publication_state: 'draft' | 'published';
  image_path: string | null; created_at: string;
  store?: Pick<MarketStore, 'name' | 'city' | 'province' | 'barangay' | 'is_open'> | null;
};
export const MARKET_CATEGORIES = [
  { value: 'all', label: 'Lahat' }, { value: 'produce', label: '🥬 Gulay / Prutas' },
  { value: 'food', label: '🍲 Pagkain' }, { value: 'fashion', label: '👕 Damit' },
  { value: 'home', label: '🏠 Bahay' }, { value: 'electronics', label: '📱 Gadgets' },
  { value: 'service', label: '🛠️ Serbisyo' }, { value: 'other', label: '🛍️ Iba pa' },
] as const;

const BUCKET = 'buklod-market-media';
export function marketPrice(amount: number, unit: string) {
  return '₱' + Number(amount || 0).toLocaleString('en-PH', {
    maximumFractionDigits: 2, minimumFractionDigits: 0,
  }) + '/' + (unit || 'item');
}
export { marketMarkerId, marketVisiblePostBody } from '@/lib/buklodMarketLink';
export function validMarketStore(input: Pick<MarketStore, 'name' | 'city'>) {
  if (input.name.trim().length < 2 || input.name.trim().length > 80) return 'Pangalan ng tindahan: 2-80 characters.';
  if (input.city.trim().length < 2 || input.city.trim().length > 100) return 'Ilagay ang city/municipality.';
  return null;
}
export function validMarketListing(input: Pick<MarketListing, 'title' | 'price_php' | 'unit'>) {
  if (input.title.trim().length < 2 || input.title.trim().length > 120) return 'Pangalan ng paninda: 2-120 characters.';
  if (!Number.isFinite(input.price_php) || input.price_php < 0 || input.price_php > 999999999) return 'Ilagay ang wastong presyo.';
  if (input.unit.trim().length < 1 || input.unit.trim().length > 30) return 'Ilagay ang unit (hal. kilo, piraso, serbisyo).';
  return null;
}
function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function marketDiscover(options: {
  category?: string; keyword?: string; city?: string; before?: string;
} = {}): Promise<MarketListing[]> {
  let query = (supabase as any).from('buklod_market_listings')
    .select('id,store_id,owner_id,title,description,kind,category,price_php,unit,image_path,stock_status,publication_state,created_at,store:buklod_market_stores!inner(name,city,province,barangay,is_open)')
    .eq('publication_state','published').eq('moderation_state','approved')
    .eq('store.is_open',true)
    .order('created_at',{ascending:false}).limit(24);
  if (options.category && options.category !== 'all') query = query.eq('category',options.category);
  const keyword = (options.keyword || '').trim().replace(/[%_\\]/g,'').slice(0,70);
  if (keyword) query = query.ilike('title','%' + keyword + '%');
  const city = (options.city || '').trim().slice(0,100);
  if (city) query = query.ilike('store.city',city);
  if (options.before) query = query.lt('created_at',options.before);
  const { data,error } = await query;
  throwIfError(error);
  return (data || []) as MarketListing[];
}
export async function marketGetListing(id: string): Promise<MarketListing | null> {
  const {data,error} = await (supabase as any).from('buklod_market_listings')
    .select('id,store_id,owner_id,title,description,kind,category,price_php,unit,image_path,stock_status,publication_state,created_at,store:buklod_market_stores!inner(name,city,province,barangay,is_open)')
    .eq('id',id).eq('publication_state','published').eq('moderation_state','approved')
    .maybeSingle();
  throwIfError(error);
  return data as MarketListing | null;
}
export async function marketMyStores(ownerId: string): Promise<MarketStore[]> {
  const {data,error} = await (supabase as any).from('buklod_market_stores')
    .select('id,owner_id,seller_type,name,description,city,province,barangay,is_open,verification_state')
    .eq('owner_id',ownerId).order('created_at',{ascending:false}).limit(10);
  throwIfError(error);
  return (data || []) as MarketStore[];
}
export async function marketMyListings(ownerId: string): Promise<MarketListing[]> {
  const {data,error} = await (supabase as any).from('buklod_market_listings')
    .select('id,store_id,owner_id,title,description,kind,category,unit,price_php,stock_status,publication_state,image_path,created_at')
    .eq('owner_id',ownerId).order('created_at',{ascending:false}).limit(60);
  throwIfError(error);
  return (data || []) as MarketListing[];
}
export async function marketCreateStore(ownerId: string, input: {
  name: string; seller_type: 'individual' | 'business'; city: string;
  province: string; barangay: string; description: string;
}): Promise<MarketStore> {
  const issue = validMarketStore(input as MarketStore);
  if (issue) throw new Error(issue);
  const {data,error} = await (supabase as any).from('buklod_market_stores')
    .insert({owner_id:ownerId,name:input.name.trim(),seller_type:input.seller_type,
      city:input.city.trim(),province:input.province.trim(),barangay:input.barangay.trim(),
      description:input.description.trim()})
    .select('id,owner_id,seller_type,name,description,city,province,barangay,is_open,verification_state').single();
  throwIfError(error);
  return data as MarketStore;
}
export async function marketCreateListing(ownerId: string, storeId: string, input: {
  title: string; description: string; kind: 'product' | 'service'; category: string;
  unit: string; price_php: number;
}): Promise<MarketListing> {
  const issue = validMarketListing(input as MarketListing);
  if (issue) throw new Error(issue);
  const {data,error} = await (supabase as any).from('buklod_market_listings')
    .insert({owner_id:ownerId,store_id:storeId,title:input.title.trim(),
      description:input.description.trim(),kind:input.kind,category:input.category,
      unit:input.unit.trim(),price_php:input.price_php,publication_state:'draft'})
    .select('id,store_id,owner_id,title,description,kind,category,unit,price_php,stock_status,publication_state,image_path,created_at').single();
  throwIfError(error);
  return data as MarketListing;
}
export async function marketPublishListing(id: string, ownerId: string, imagePath: string | null) {
  const {error} = await (supabase as any).from('buklod_market_listings')
    .update({publication_state:'published',image_path:imagePath,updated_at:new Date().toISOString()})
    .eq('id',id).eq('owner_id',ownerId);
  throwIfError(error);
}
export async function marketChangeStock(listing: MarketListing, status: 'available' | 'sold_out') {
  const {error} = await (supabase as any).from('buklod_market_listings')
    .update({stock_status:status,updated_at:new Date().toISOString()})
    .eq('id',listing.id).eq('owner_id',listing.owner_id);
  throwIfError(error);
}
export async function marketUnpublishListing(listing: MarketListing) {
  const {error} = await (supabase as any).from('buklod_market_listings')
    .update({publication_state:'draft',updated_at:new Date().toISOString()})
    .eq('id',listing.id).eq('owner_id',listing.owner_id);
  throwIfError(error);
}
export function marketImageUrl(path?: string | null) {
  if (!path || !/^[0-9a-f-]+\/[0-9a-f-]+-[0-9]+\.jpg$/i.test(path)) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
export async function marketUploadPhoto(ownerId: string, listingId: string, uri: string) {
  const photo = await ImageManipulator.manipulateAsync(
    uri,[{resize:{width:850}}],{compress:0.65,format:ImageManipulator.SaveFormat.JPEG,base64:true}
  );
  if (!photo.base64) throw new Error('Hindi mabasa ang larawan.');
  const bytes = Math.floor(photo.base64.length * 0.75);
  if (bytes > 2097152) throw new Error('Larawan ay dapat 2 MB o mas maliit.');
  const path = ownerId + '/' + listingId + '-' + Date.now() + '.jpg';
  const {error} = await supabase.storage.from(BUCKET).upload(path,decode(photo.base64),{
    contentType:'image/jpeg',upsert:false
  });
  throwIfError(error);
  return path;
}
export async function marketShareToWall(listingId: string) {
  const {data,error} = await (supabase as any).rpc('buklod_market_share_wall_v1',{p_listing_id:listingId});
  throwIfError(error);
  if (!data) throw new Error('Hindi naibalik ang Wall post ID.');
  return String(data);
}
