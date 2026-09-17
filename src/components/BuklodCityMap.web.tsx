import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { BuklodCityPoint } from '@/lib/buklodCity';
import {
  loadMyBuklodHomeMapLocation,
  type BuklodHomeMapLocation,
} from '@/lib/buklodHomeLocation';
import { useAuth } from '@/providers/AuthProvider';

const FALLBACK_CENTER = { latitude: 14.4974, longitude: 121.2862 };

const CATEGORY_COLORS: Record<string, string> = {
  faith: '#7254C8',
  school: '#2877DD',
  market: '#D9971D',
  business: '#DB7040',
  organization: '#168E8A',
  government: '#7753B7',
  community: '#319565',
  event: '#C54A69',
  service: '#35679D',
  bayanihan: '#319565',
  people: '#177552',
};

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function MapIcon({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.mapIconButton, disabled && styles.mapIconButtonDisabled, pressed && !disabled && styles.mapIconButtonPressed]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={disabled ? '#9AA9B5' : '#214A5D'} />
    </Pressable>
  );
}

export function BuklodCityMap({
  points,
  center,
  expanded = false,
  onExpandedChange,
  onShareLocation,
  onManagePlace,
  canManagePlace = true,
}: {
  points: BuklodCityPoint[];
  center?: { latitude: number; longitude: number } | null;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onShareLocation?: () => void;
  onManagePlace?: () => void;
  canManagePlace?: boolean;
}) {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const mobile = width < 720;
  const previewHeight = mobile ? 190 : 250;
  const [privateHomePoint, setPrivateHomePoint] = useState<BuklodHomeMapLocation | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!user?.id) {
      setPrivateHomePoint(null);
      return () => {
        mounted = false;
      };
    }

    void loadMyBuklodHomeMapLocation(user.id)
      .then((location) => {
        if (mounted) setPrivateHomePoint(location);
      })
      .catch(() => {
        if (mounted) setPrivateHomePoint(null);
      });

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const mapCenter = privateHomePoint ?? center ?? points[0] ?? FALLBACK_CENTER;

  const srcDoc = useMemo(() => {
    const payload = points.map(point => ({
      id: point.id,
      kind: point.kind,
      title: point.title,
      subtitle: point.subtitle ?? '',
      category: String(point.category || 'community'),
      latitude: point.latitude,
      longitude: point.longitude,
      verified: Boolean(point.verified),
      isMe: Boolean(point.isMe),
    }));
    const home = privateHomePoint
      ? {
          latitude: privateHomePoint.latitude,
          longitude: privateHomePoint.longitude,
          localityLabel: privateHomePoint.localityLabel ?? '',
        }
      : null;

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
<style>
html,body,#map{width:100%;height:100%;margin:0;padding:0;background:#eaf2f4;font-family:Inter,system-ui,-apple-system,sans-serif}
.leaflet-control-attribution{font-size:9px}
.leaflet-popup-content{min-width:200px;margin:11px 13px}
.buklod-pin{width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(20,50,70,.25);display:flex;align-items:center;justify-content:center}
.buklod-pin span{transform:rotate(45deg);color:#fff;font-size:12px;font-weight:900}
.buklod-home-marker{width:176px;display:flex;flex-direction:column;align-items:center;gap:4px;filter:drop-shadow(0 5px 12px rgba(23,117,82,.22));cursor:pointer}
.buklod-home-door{width:44px;height:44px;border-radius:14px;background:#fff;border:3px solid #177552;display:flex;align-items:center;justify-content:center;position:relative}
.buklod-home-door:after{content:'HOME';position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#177552;color:#fff;border-radius:999px;padding:2px 6px;font-size:8px;line-height:12px;font-weight:900;letter-spacing:.5px;white-space:nowrap}
.buklod-home-door svg{width:26px;height:26px;display:block;fill:#177552}
.buklod-home-address{max-width:170px;padding:4px 8px;border:1px solid #b9d9cb;border-radius:10px;background:rgba(255,255,255,.97);color:#385565;font-size:9px;line-height:12px;font-weight:800;text-align:center;white-space:normal;box-shadow:0 3px 8px rgba(20,50,70,.14)}
.buklod-popup-title{font-weight:800;font-size:13px;color:#183047;margin-bottom:3px}.buklod-popup-sub{font-size:11px;line-height:15px;color:#60768a}.buklod-verified{font-size:10px;color:#177552;font-weight:700;margin-top:5px}.buklod-popup-note{margin-top:7px;font-size:9px;line-height:13px;color:#748695}
.buklod-nav-control{display:block;min-width:165px;max-width:min(300px,calc(100vw - 92px));padding:9px 11px;border:1px solid #cfe0d7;border-radius:14px;background:rgba(255,255,255,.97);box-shadow:0 7px 22px rgba(19,52,68,.18);text-decoration:none;color:#1f3c4e;cursor:default}.buklod-nav-control strong{display:block;font-size:11px;line-height:14px;color:#177552}.buklod-nav-control span{display:block;margin-top:2px;font-size:8px;line-height:11px;color:#6a7f8f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.buklod-nav-control.active{cursor:pointer;border-color:#9ccdb8;background:#f8fffb}.buklod-nav-control.privacy strong{color:#697f8e}
@media (max-width:560px){.buklod-nav-control{min-width:145px;max-width:calc(100vw - 86px);padding:8px 9px}.buklod-nav-control strong{font-size:10px}.buklod-nav-control span{font-size:8px}.buklod-home-marker{width:150px}.buklod-home-address{max-width:144px;font-size:8px;line-height:11px}}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
const points=${safeJson(payload)};
const home=${safeJson(home)};
const colors=${safeJson(CATEGORY_COLORS)};
const center=${safeJson([Number(mapCenter.latitude), Number(mapCenter.longitude)])};
const map=L.map('map',{zoomControl:true,attributionControl:true}).setView(center,13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);

const NavigationControl=L.Control.extend({
 onAdd(){
  const link=L.DomUtil.create('a','buklod-nav-control');
  link.id='buklod-nav-control';
  link.href='#';
  link.setAttribute('aria-disabled','true');
  link.innerHTML='<strong>🧭 BUKLOD Navigation</strong><span>Tap a place pin to choose a destination</span>';
  L.DomEvent.disableClickPropagation(link);
  L.DomEvent.on(link,'click',(event)=>{
    if(link.getAttribute('aria-disabled')==='true') L.DomEvent.preventDefault(event);
  });
  return link;
 }
});
new NavigationControl({position:'topleft'}).addTo(map);

function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
function navigationUrl(p){
 const destination=encodeURIComponent(String(p.latitude)+','+String(p.longitude));
 return 'https://www.google.com/maps/dir/?api=1&destination='+destination+'&travelmode=driving&dir_action=navigate';
}
function isNavigablePoint(p){return String(p.kind||'').toUpperCase()!=='PERSON' && String(p.category||'').toLowerCase()!=='people';}
function selectNavigationDestination(p){
 const link=document.getElementById('buklod-nav-control');
 if(!link) return;
 if(!isNavigablePoint(p)){
  link.className='buklod-nav-control privacy';
  link.setAttribute('aria-disabled','true');
  link.removeAttribute('target');
  link.href='#';
  link.innerHTML='<strong>🛡 Privacy-protected presence</strong><span>People pins are not navigation destinations</span>';
  return;
 }
 link.className='buklod-nav-control active';
 link.setAttribute('aria-disabled','false');
 link.setAttribute('target','_blank');
 link.setAttribute('rel','noopener noreferrer');
 link.href=navigationUrl(p);
 link.innerHTML='<strong>🧭 BUKLOD Navigation</strong><span>Navigate to '+escapeHtml(p.title)+'</span>';
}

const bounds=[];
points.forEach((p)=>{
 if(!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)) return;
 const color=colors[p.category]||'#35679D';
 const initial=p.isMe?'M':(String(p.category||'C').charAt(0).toUpperCase());
 const icon=L.divIcon({className:'',html:'<div class="buklod-pin" style="background:'+color+'"><span>'+initial+'</span></div>',iconSize:[28,28],iconAnchor:[14,28],popupAnchor:[0,-26]});
 const marker=L.marker([p.latitude,p.longitude],{icon}).addTo(map);
 const safeTitle=escapeHtml(p.title);
 const safeSub=escapeHtml(p.subtitle);
 const popupNote=isNavigablePoint(p)
   ? '<div class="buklod-popup-note">Selected. Tap BUKLOD Navigation at the top of the map.</div>'
   : '<div class="buklod-popup-note">People-presence pins are intentionally not navigation destinations.</div>';
 marker.bindPopup('<div class="buklod-popup-title">'+safeTitle+'</div><div class="buklod-popup-sub">'+safeSub+'</div>'+(p.verified?'<div class="buklod-verified">Verified BUKLOD place</div>':'')+popupNote);
 marker.on('click',()=>selectNavigationDestination(p));
 bounds.push([p.latitude,p.longitude]);
});
if(home&&Number.isFinite(home.latitude)&&Number.isFinite(home.longitude)){
 const homeSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 2.8 10.6a1 1 0 0 0 .6 1.8h1.1v7.1c0 .8.7 1.5 1.5 1.5h4.2v-5.5h3.6V21H18c.8 0 1.5-.7 1.5-1.5v-7.1h1.1a1 1 0 0 0 .6-1.8L12 3.2Z"/></svg>';
 const safeHomeAddress=escapeHtml(home.localityLabel||'My saved address');
 const homeHtml='<div class="buklod-home-marker" title="Open My BUKLOD Home"><div class="buklod-home-door">'+homeSvg+'</div><div class="buklod-home-address">'+safeHomeAddress+'</div></div>';
 const homeIcon=L.divIcon({className:'',html:homeHtml,iconSize:[176,76],iconAnchor:[88,44]});
 const homeMarker=L.marker([home.latitude,home.longitude],{icon:homeIcon,zIndexOffset:1000,keyboard:true,title:'My BUKLOD Home'}).addTo(map);
 homeMarker.bindTooltip('My BUKLOD Home · tap to enter',{direction:'top',offset:[0,-42]});
 homeMarker.on('click',()=>{try{window.top.location.assign('/personal-home');}catch(_){window.location.assign('/personal-home');}});
 bounds.push([home.latitude,home.longitude]);
}
if(bounds.length>1){map.fitBounds(bounds,{padding:[38,38],maxZoom:15});}else if(bounds.length===1){map.setView(bounds[0],15);}
setTimeout(()=>map.invalidateSize(),120);
</script>
</body>
</html>`;
  }, [
    mapCenter.latitude,
    mapCenter.longitude,
    points,
    privateHomePoint?.latitude,
    privateHomePoint?.longitude,
    privateHomePoint?.localityLabel,
  ]);

  const iframe = (interactive: boolean) => React.createElement('iframe', {
    title: interactive ? 'BUKLOD City interactive community map' : 'BUKLOD City map preview',
    srcDoc,
    style: {
      border: 0,
      width: '100%',
      height: '100%',
      display: 'block',
      background: '#EAF2F4',
      pointerEvents: interactive ? 'auto' : 'none',
    },
    referrerPolicy: 'no-referrer',
  });

  const controls = (showClose = false) => (
    <View style={styles.mapControls} pointerEvents="box-none">
      <MapIcon icon="crosshairs-gps" label="Share location" onPress={onShareLocation} />
      <MapIcon icon="pencil" label="Manage place" onPress={onManagePlace} disabled={!canManagePlace} />
      {showClose ? <MapIcon icon="close" label="Close full screen map" onPress={() => onExpandedChange?.(false)} /> : null}
    </View>
  );

  return (
    <>
      <View style={[styles.previewFrame, { height: previewHeight }]}> 
        {iframe(false)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open BUKLOD City map full screen"
          onPress={() => onExpandedChange?.(true)}
          style={({ pressed }) => [styles.previewTapLayer, pressed && styles.previewTapLayerPressed]}
        >
          <View style={styles.previewPrompt}>
            <MaterialCommunityIcons name="map-search-outline" size={18} color="#FFFFFF" />
            <Text style={styles.previewPromptText}>Tap map to open</Text>
          </View>
        </Pressable>
        {controls(false)}
      </View>

      <Modal visible={expanded} animationType="fade" onRequestClose={() => onExpandedChange?.(false)}>
        <View style={styles.fullscreenShell}>
          <View style={styles.fullscreenMap}>{iframe(true)}</View>
          {controls(true)}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  previewFrame: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#EAF2F4',
    borderWidth: 1,
    borderColor: '#D6E2E8',
    position: 'relative',
  },
  previewTapLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21,48,64,.04)',
  },
  previewTapLayerPressed: { backgroundColor: 'rgba(21,48,64,.10)' },
  previewPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(24,55,72,.82)',
  },
  previewPromptText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  mapControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 7,
    zIndex: 20,
  },
  mapIconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.96)',
    borderWidth: 1,
    borderColor: '#D6E2E8',
    boxShadow: '0 5px 16px rgba(18,45,62,.16)',
  } as any,
  mapIconButtonDisabled: { opacity: 0.45 },
  mapIconButtonPressed: { opacity: 0.72 },
  fullscreenShell: { flex: 1, backgroundColor: '#EAF2F4', position: 'relative' },
  fullscreenMap: { flex: 1, width: '100%' },
});