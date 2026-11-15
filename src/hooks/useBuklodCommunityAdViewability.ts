import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Dimensions,type View} from 'react-native';
import {buklodVisibleVideoArea} from '@/lib/buklodVideoFrameVisibility';
import {subscribeBuklodVideoScroll} from '@/lib/buklodVideoScrollSignal';

import {
  isCommunityFeedInlineAdRow,
} from '@/lib/buklodAdPlacements';

let visibleCommunityInlineIds: ReadonlySet<string> = new Set();
const visibleCommunityInlineListeners = new Set<() => void>();

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

function publishVisibleCommunityInlineIds(ids: ReadonlySet<string>) {
  if (sameIds(visibleCommunityInlineIds, ids)) return;
  visibleCommunityInlineIds = ids;
  visibleCommunityInlineListeners.forEach(listener => listener());
}

/**
 * Current on-screen state for an inline Community feed row.
 * This is deliberately separate from the sticky AdMob activation state below:
 * ads stay mounted after first view, while video playback may use true current
 * visibility so an off-screen IGPAT cannot continue playing.
 */
export function useBuklodCommunityInlineVisibility(slotId?: string) {
  const readVisible = useCallback(
    () => Boolean(slotId && visibleCommunityInlineIds.has(slotId)),
    [slotId],
  );
  const [visible, setVisible] = useState(readVisible);

  useEffect(() => {
    const sync = () => setVisible(readVisible());
    visibleCommunityInlineListeners.add(sync);
    sync();
    return () => {
      visibleCommunityInlineListeners.delete(sync);
    };
  }, [readVisible]);

  return visible;
}

/**
 * Activates community inline ads only after they are actually on screen.
 * Once activated, a slot stays mounted until the list recycles it so
 * visibility flicker does not spam extra AdMob requests.
 */
export function useBuklodCommunityAdViewability(feedRows: readonly unknown[] = []) {
  const feedRowsRef = useRef(feedRows);
  feedRowsRef.current = feedRows;
  const [activatedAdIds, setActivatedAdIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [visibleVideoPostId, setVisibleVideoPostId] = useState<string | null>(
    null,
  );

  const [preloadVideoPostId, setPreloadVideoPostId] = useState<string | null>(null);
  const [preloadAdId,setPreloadAdId]=useState<string|null>(null);
  const frameRefs=useRef(new Map<string,View>());
  const possibleVideoIds=useRef<string[]>([]);
  const scrollingRef=useRef(false);
  const measureEpoch=useRef(0);
  const rafRef=useRef<number|null>(null);
  const checkRef=useRef<()=>void>(()=>{});
  const scheduleRef=useRef<()=>void>(()=>{});
  const checkFrames=useCallback(()=>{
    const generation=++measureEpoch.current;
    if(scrollingRef.current){setVisibleVideoPostId(null);return;}
    const frames=possibleVideoIds.current.map(id=>({id,node:frameRefs.current.get(id)}))
      .filter((row):row is {id:string;node:View}=>Boolean(row.node));
    if(!frames.length){setVisibleVideoPostId(null);return;}
    const screen=Dimensions.get('window');
    let remaining=frames.length,bestId:string|null=null,bestArea=0;
    frames.forEach(({id,node})=>node.measureInWindow((x,y,width,height)=>{
      if(measureEpoch.current!==generation||scrollingRef.current)return;
      const area=buklodVisibleVideoArea({x,y,width,height},screen);
      if(area>bestArea){bestArea=area;bestId=id;}
      if(--remaining===0)setVisibleVideoPostId(current=>current===bestId?current:bestId);
    }));
  },[]);
  checkRef.current=checkFrames;
  const scheduleVideoFrameCheck=useCallback(()=>{
    if(rafRef.current!==null)return;
    rafRef.current=requestAnimationFrame(()=>{
      rafRef.current=null;
      checkRef.current();
    });
  },[]);
  scheduleRef.current=scheduleVideoFrameCheck;
  const registerVideoFrame=useCallback((postId:string,node:View|null)=>{
    if(node){
      if(frameRefs.current.get(postId)===node)return;
      frameRefs.current.set(postId,node);
    }else if(!frameRefs.current.delete(postId))return;
    scheduleRef.current();
  },[]);
  useEffect(()=>subscribeBuklodVideoScroll(scrolling=>{
    scrollingRef.current=scrolling;
    if(scrolling){++measureEpoch.current;setVisibleVideoPostId(null);}
    else scheduleRef.current();
  }),[]);
  useEffect(()=>()=>{++measureEpoch.current;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);},[]);

  // Native ads retain the original conservative visibility requirement.
  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{ item?: unknown }>;
    }) => {
      const incoming: string[] = [];
      for (const token of viewableItems) {
        if (isCommunityFeedInlineAdRow(token.item)) incoming.push(token.item.id);
      }

      publishVisibleCommunityInlineIds(new Set(incoming));

      if (!incoming.length) {
        return;
      }

      setActivatedAdIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of incoming) {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
  ).current;

  // Video becomes eligible as its post enters the viewport, independently
  // of ad request visibility. Keep only one autoplay video at a time.
  const onVideoViewableItemsChanged = useRef(
    ({viewableItems}:{viewableItems:Array<{item?:unknown;index?:number|null}>})=>{
      const ids=viewableItems.map(token=>communityVideoPostId(token.item))
        .filter((id):id is string=>Boolean(id));
      possibleVideoIds.current=ids;
      scheduleRef.current();
      const rows=feedRowsRef.current;
      const indices=viewableItems.map(token=>token.index)
        .filter((i):i is number=>typeof i==='number'&&i>=0);
      const index=indices.length?Math.max(...indices):
        (ids.length?rows.findIndex(item=>communityVideoPostId(item)===ids[0]):-1);
      let upcomingAd:string|null=null;
      if(index>=0)for(let i=index+1;i<Math.min(rows.length,index+9);i++){
        if(isCommunityFeedInlineAdRow(rows[i])){upcomingAd=(rows[i] as {id:string}).id;break;}
      }
      setPreloadAdId(current=>current===upcomingAd?current:upcomingAd);
      // Prepare only one near-future video player; it must not play offscreen.
      let nextPreloadId: string | null = null;
      if (index >= 0) {
        for (let i = index + 1; i < Math.min(rows.length, index + 5); i += 1) {
          nextPreloadId = communityVideoPostId(rows[i]);
          if (nextPreloadId) break;
        }
      }
      setPreloadVideoPostId(current =>
        current === nextPreloadId ? current : nextPreloadId,
      );
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 400,
  }).current;
  // Start the already-prebuffered next clip as soon as it enters the viewport.
  // Independent from the stricter AdMob visibility/impression threshold.
  const videoViewabilityConfig = useRef({
    itemVisiblePercentThreshold: 1,
    minimumViewTime: 0,
  }).current;

  const extraData = useMemo(
    () =>
      `${[...activatedAdIds].sort().join('|')}:${visibleVideoPostId ?? ''}:${preloadVideoPostId ?? ''}:${preloadAdId ?? ''}`,
    [activatedAdIds, visibleVideoPostId, preloadVideoPostId, preloadAdId],
  );

  const isAdActive = useCallback(
    (id: string) => activatedAdIds.has(id),
    [activatedAdIds],
  );

  return {
    onViewableItemsChanged,
    viewabilityConfig,
    videoViewabilityConfig,
    onVideoViewableItemsChanged,
    preloadVideoPostId,
    preloadAdId,
    registerVideoFrame,
    onVideoFrameLayout:scheduleVideoFrameCheck,
    extraData,
    isAdActive,
    visibleVideoPostId,
  };
}

function communityVideoPostId(item: unknown) {
  if (!item || typeof item !== 'object') return null;

  const post = item as {
    id?: unknown;
    is_reel?: unknown;
    media_url?: unknown;
    media_mime_type?: unknown;
    media_items?: unknown;
  };

  const id = String(post.id ?? '').trim();
  if (!id) return null;

  const attached = Array.isArray(post.media_items)
    ? post.media_items.find((media) => {
        const row = media as {
          media_mime_type?: unknown;
          media_url?: unknown;
        };
        return (
          String(row?.media_mime_type ?? '')
            .trim()
            .toLowerCase()
            .startsWith('video/') &&
          String(row?.media_url ?? '').trim().length > 0
        );
      })
    : null;

  const fallback = String(post.media_mime_type ?? '')
    .trim()
    .toLowerCase()
    .startsWith('video/')
    ? post
    : null;

  const media = (attached ?? fallback) as {
    media_url?: unknown;
  } | null;

  if (!media || !String(media.media_url ?? '').trim()) {
    return null;
  }

  return id;
}