import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { BuklodCityPoint } from '@/lib/buklodCity';

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
  const mobile = width < 720;
  const previewHeight = mobile ? 190 : 250;
  const mapCenter = center ?? points[0] ?? FALLBACK_CENTER;

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
.buklod-popup-title{font-weight:800;font-size:13px;color:#183047;margin-bottom:3px}.buklod-popup-sub{font-size:11px;line-height:15px;color:#60768a}.buklod-verified{font-size:10px;color:#177552;font-weight:700;margin-top:5px}.buklod-popup-note{margin-top:7px;font-size:9px;line-height:13px;color:#748695}
.buklod-nav-dock{max-width:min(330px,calc(100vw - 40px));padding:0;border:0;background:transparent;box-shadow:none}.buklod-nav-dock-hidden{display:none}.buklod-nav-card{display:block;padding:11px 12px;border:1px solid #cfe0d7;border-radius:15px;background:rgba(255,255,255,.98);box-shadow:0 8px 26px rgba(19,52,68,.2);text-decoration:none;color:#1f3c4e}.buklod-nav-card strong{display:block;font-size:11px;line-height:14px;color:#177552}.buklod-nav-card span{display:block;margin-top:3px;font-size:9px;line-height:12px;color:#6a7f8f}.buklod-nav-card small{display:block;margin-top:6px;font-size:8px;line-height:11px;color:#748695}.buklod-privacy-card{padding:11px 12px;border:1px solid #dfe7ec;border-radius:15px;background:rgba(255,255,255,.98);box-shadow:0 8px 26px rgba(19,52,68,.16);font-size:10px;line-height:14px;color:#586f80}
@media (max-width:560px){.buklod-nav-dock{max-width:calc(100vw - 30px)}.buklod-nav-card{padding:10px 11px}.buklod-nav-card strong{font-size:10px}.buklod-nav-card span{font-size:8px}}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
const points=${safeJson(payload)};
const colors=${safeJson(CATEGORY_COLORS)};
const center=${safeJson([Number(mapCenter.latitude), Number(mapCenter.longitude)])};
const map=L.map('map',{zoomControl:true,attributionControl:true}).setView(center,13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);

const NavigationDock=L.Control.extend({
 onAdd(){
  const div=L.DomUtil.create('div','buklod-nav-dock buklod-nav-dock-hidden');
  div.id='buklod-nav-dock';
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  return div;
 }
});
new NavigationDock({position:'bottomleft'}).addTo(map);

function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
function navigationUrls(p){
 const destination=encodeURIComponent(String(p.latitude)+','+String(p.longitude));
 const directions='https://www.google.com/maps/dir/?api=1&destination='+destination;
 return {navigate:directions+'&travelmode=driving&dir_action=navigate'};
}
function isNavigablePoint(p){return String(p.kind||'').toUpperCase()!=='PERSON' && String(p.category||'').toLowerCase()!=='people';}
function showNavigationDock(p){
 const dock=document.getElementById('buklod-nav-dock');
 if(!dock) return;
 dock.className='buklod-nav-dock';
 if(!isNavigablePoint(p)){
  dock.innerHTML='<div class="buklod-privacy-card"><strong>Privacy-protected presence</strong><br/>People-presence pins are not navigation destinations.</div>';
  return;
 }
 const urls=navigationUrls(p);
 dock.innerHTML='<a class="buklod-nav-card" href="'+urls.navigate+'" target="_blank" rel="noopener noreferrer"><strong>🧭 Navigate to '+escapeHtml(p.title)+'</strong><span>'+escapeHtml(p.subtitle||p.category||'BUKLOD place')+'</span><small>Tap this card to open Google Maps navigation</small></a>';
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
   ? '<div class="buklod-popup-note">Select this place, then tap the green BUKLOD Navigation card.</div>'
   : '<div class="buklod-popup-note">People-presence pins are intentionally not exposed as navigation destinations.</div>';
 marker.bindPopup('<div class="buklod-popup-title">'+safeTitle+'</div><div class="buklod-popup-sub">'+safeSub+'</div>'+(p.verified?'<div class="buklod-verified">Verified BUKLOD place</div>':'')+popupNote);
 marker.on('click',()=>showNavigationDock(p));
 bounds.push([p.latitude,p.longitude]);
});
if(bounds.length>1){map.fitBounds(bounds,{padding:[38,38],maxZoom:15});}else if(bounds.length===1){map.setView(bounds[0],15);}
setTimeout(()=>map.invalidateSize(),120);
</script>
</body>
</html>`;
  }, [mapCenter.latitude, mapCenter.longitude, points]);

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
