import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { BuklodCityPoint } from '@/lib/buklodCity';

/* BUKLOD_LIVE_SATELLITE_MAP_R1 */
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
      style={({ pressed }) => [
        styles.mapIconButton,
        disabled && styles.mapIconButtonDisabled,
        pressed && !disabled && styles.mapIconButtonPressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={disabled ? '#9AA9B5' : '#214A5D'}
      />
    </Pressable>
  );
}

export function BuklodLiveSatelliteMap({
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
    const payload = points.map((point) => ({
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
html,body,#map{width:100%;height:100%;margin:0;padding:0;background:#0d1720;font-family:Inter,system-ui,-apple-system,sans-serif}
.leaflet-control-attribution{font-size:9px}
.leaflet-popup-content{min-width:205px;margin:11px 13px}
.buklod-pin{width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.34);display:flex;align-items:center;justify-content:center}
.buklod-pin span{transform:rotate(45deg);color:#fff;font-size:12px;font-weight:900}
.buklod-home-marker{width:176px;display:flex;flex-direction:column;align-items:center;gap:4px;filter:drop-shadow(0 5px 12px rgba(0,0,0,.35));cursor:pointer}
.buklod-home-door{width:44px;height:44px;border-radius:14px;background:#fff;border:3px solid #177552;display:flex;align-items:center;justify-content:center;position:relative}
.buklod-home-door:after{content:'HOME';position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#177552;color:#fff;border-radius:999px;padding:2px 6px;font-size:8px;line-height:12px;font-weight:900;letter-spacing:.5px;white-space:nowrap}
.buklod-home-door svg{width:26px;height:26px;display:block;fill:#177552}
.buklod-home-address{max-width:170px;padding:4px 8px;border:1px solid #b9d9cb;border-radius:10px;background:rgba(255,255,255,.97);color:#385565;font-size:9px;line-height:12px;font-weight:800;text-align:center;white-space:normal;box-shadow:0 3px 8px rgba(0,0,0,.24)}
.buklod-popup-title{font-weight:800;font-size:13px;color:#183047;margin-bottom:3px}
.buklod-popup-sub{font-size:11px;line-height:15px;color:#60768a}
.buklod-verified{font-size:10px;color:#177552;font-weight:700;margin-top:5px}
.buklod-popup-note{margin-top:7px;font-size:9px;line-height:13px;color:#748695}
.buklod-nav-control{display:block;min-width:165px;max-width:min(300px,calc(100vw - 92px));padding:9px 11px;border:1px solid #cfe0d7;border-radius:14px;background:rgba(255,255,255,.97);box-shadow:0 7px 22px rgba(0,0,0,.24);text-decoration:none;color:#1f3c4e;cursor:default}
.buklod-nav-control strong{display:block;font-size:11px;line-height:14px;color:#177552}
.buklod-nav-control span{display:block;margin-top:2px;font-size:8px;line-height:11px;color:#6a7f8f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.buklod-nav-control.active{cursor:pointer;border-color:#9ccdb8;background:#f8fffb}
.buklod-nav-control.privacy strong{color:#697f8e}
.buklod-live-status{padding:6px 9px;border-radius:11px;background:rgba(10,25,36,.84);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.3);font-size:9px;line-height:12px;font-weight:800;max-width:210px}
.poi-label-marker{display:flex;align-items:center;gap:5px;max-width:170px;padding:4px 7px;border:1px solid #b9d8ca;border-radius:9px;background:rgba(255,255,255,.97);box-shadow:0 2px 7px rgba(0,0,0,.22);color:#173f33;font-size:9px;line-height:12px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.poi-label-dot{width:7px;height:7px;border-radius:999px;background:#177552;flex:0 0 auto}
.poi-label-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.poi-type{display:inline-block;margin-top:5px;padding:2px 6px;border-radius:999px;background:#edf6f2;color:#246653;font-size:9px;font-weight:800;text-transform:capitalize}
@media (max-width:560px){.buklod-nav-control{min-width:145px;max-width:calc(100vw - 86px);padding:8px 9px}.buklod-nav-control strong{font-size:10px}.buklod-nav-control span{font-size:8px}.buklod-home-marker{width:150px}.buklod-home-address{max-width:144px;font-size:8px;line-height:11px}.buklod-live-status{max-width:165px;font-size:8px}.poi-label-marker{max-width:132px;font-size:8px;line-height:11px;padding:3px 6px}}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
const points=${safeJson(payload)};
const colors=${safeJson(CATEGORY_COLORS)};
const center=${safeJson([
      Number(mapCenter.latitude),
      Number(mapCenter.longitude),
    ])};

const map=L.map('map',{
 zoomControl:true,
 attributionControl:true,
 minZoom:3,
 maxZoom:19,
 zoomSnap:1,
 zoomDelta:1,
}).setView(center,14);

const street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
 minZoom:3,
 maxZoom:19,
 maxNativeZoom:19,
 detectRetina:true,
 keepBuffer:4,
 attribution:'&copy; OpenStreetMap contributors'
}).addTo(map);

const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
 minZoom:3,
 maxZoom:19,
 maxNativeZoom:19,
 keepBuffer:4,
 attribution:'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
});

const satelliteLabels=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{
 minZoom:3,
 maxZoom:19,
 maxNativeZoom:19,
 keepBuffer:4,
 attribution:'Reference &copy; Esri'
});

const nearbyPlaces=L.layerGroup().addTo(map);

L.control.layers(
 { 'Street / Navigation': street, 'Satellite': satellite },
 { 'Satellite place labels': satelliteLabels, 'Establishment names': nearbyPlaces },
 { position:'bottomright', collapsed:true }
).addTo(map);

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

const LiveStatusControl=L.Control.extend({
 onAdd(){
  const status=L.DomUtil.create('div','buklod-live-status');
  status.id='buklod-live-status';
  status.textContent='Satellite • loading nearby places…';
  L.DomEvent.disableClickPropagation(status);
  return status;
 }
});
new LiveStatusControl({position:'bottomleft'}).addTo(map);

function setLiveStatus(text){
 const el=document.getElementById('buklod-live-status');
 if(el) el.textContent=text;
}
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
 const icon=L.divIcon({className:'',html:'<div class="buklod-pin" style="background:'+color+'"><span>'+initial+'</span></div>',iconSize:[30,30],iconAnchor:[15,30],popupAnchor:[0,-28]});
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


if(bounds.length>1){map.fitBounds(bounds,{padding:[38,38],maxZoom:15});}
else if(bounds.length===1){map.setView(bounds[0],15);}

function poiMeta(tags){
 const amenity=String(tags.amenity||'').toLowerCase();
 const shop=String(tags.shop||'').toLowerCase();
 const office=String(tags.office||'').toLowerCase();
 const tourism=String(tags.tourism||'').toLowerCase();
 if(['hospital','clinic','doctors'].includes(amenity)) return {type:'medical',priority:1};
 if(amenity==='pharmacy') return {type:'pharmacy',priority:2};
 if(['school','college','university'].includes(amenity)) return {type:'school',priority:1};
 if(amenity==='police') return {type:'police',priority:1};
 if(amenity==='fire_station') return {type:'fire station',priority:1};
 if(amenity==='marketplace') return {type:'market',priority:1};
 if(['bank','atm'].includes(amenity)) return {type:'bank',priority:2};
 if(amenity==='fuel') return {type:'fuel',priority:2};
 if(tourism==='hotel') return {type:'hotel',priority:2};
 if(tourism==='attraction') return {type:'attraction',priority:2};
 if(['restaurant','cafe','fast_food'].includes(amenity)) return {type:'food',priority:3};
 if(shop) return {type:shop.replaceAll('_',' '),priority:4};
 if(office) return {type:office.replaceAll('_',' '),priority:4};
 return {type:'place',priority:5};
}
function poiAddress(tags){
 const pieces=[tags['addr:housenumber'],tags['addr:street'],tags['addr:barangay'],tags['addr:city']]
  .map(v=>String(v||'').trim()).filter(Boolean);
 return pieces.join(', ');
}
function elementCoordinates(element){
 const latitude=Number(element.lat ?? element.center?.lat);
 const longitude=Number(element.lon ?? element.center?.lon);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)) return null;
 return {latitude,longitude};
}
function addNearbyPlace(element){
 const tags=element.tags||{};
 const name=String(tags.name||'').trim();
 if(!name) return false;
 const coords=elementCoordinates(element);
 if(!coords) return false;
 const meta=poiMeta(tags);
 const safeName=escapeHtml(name);
 const icon=L.divIcon({
   className:'',
   html:'<div class="poi-label-marker"><span class="poi-label-dot"></span><span class="poi-label-name">'+safeName+'</span></div>',
   iconSize:[0,0],
   iconAnchor:[0,10],
   popupAnchor:[8,-10],
 });
 const marker=L.marker([coords.latitude,coords.longitude],{
   icon,
   title:name,
   riseOnHover:true,
 }).addTo(nearbyPlaces);
 const address=poiAddress(tags);
 const popup='<div class="buklod-popup-title">'+safeName+'</div>'+
   '<div class="poi-type">'+escapeHtml(meta.type)+'</div>'+
   (address?'<div class="buklod-popup-sub" style="margin-top:6px">'+escapeHtml(address)+'</div>':'')+
   '<div class="buklod-popup-note">Selected. Use BUKLOD Navigation for driving directions and voice guidance.</div>';
 marker.bindPopup(popup);
 marker.on('click',()=>selectNavigationDestination({
   latitude:coords.latitude,
   longitude:coords.longitude,
   title:name,
   kind:'POI',
   category:meta.type,
 }));
 return true;
}

let poiTimer=null;
let poiAbort=null;
let lastPoiCenter=null;
let lastPoiElements=[];
function distanceKm(a,b){
 const rad=Math.PI/180;
 const dLat=(b.lat-a.lat)*rad;
 const dLon=(b.lng-a.lng)*rad;
 const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function renderNearbyPlaces(elements){
 nearbyPlaces.clearLayers();
 const zoom=map.getZoom();

 if(zoom<15){
   setLiveStatus('Zoom in to see establishment names');
   return;
 }

 const limit=zoom>=18?100:zoom>=17?75:zoom>=16?48:24;
 const minDistance=zoom>=18?54:zoom>=17?66:zoom>=16?82:110;
 const placed=[];

 const prepared=(elements||[])
   .map((element)=>{
     const coords=elementCoordinates(element);
     const tags=element.tags||{};
     const name=String(tags.name||'').trim();
     if(!coords||!name) return null;
     return {element,coords,meta:poiMeta(tags)};
   })
   .filter(Boolean)
   .sort((a,b)=>Number(a.meta.priority||9)-Number(b.meta.priority||9));

 let count=0;

 for(const item of prepared){
   const pixel=map.latLngToContainerPoint([
     item.coords.latitude,
     item.coords.longitude,
   ]);

   const collides=placed.some((p)=>
     Math.abs(p.x-pixel.x)<minDistance &&
     Math.abs(p.y-pixel.y)<24
   );

   if(collides) continue;

   if(addNearbyPlace(item.element)){
     placed.push(pixel);
     count+=1;
   }

   if(count>=limit) break;
 }

 setLiveStatus(
   count
     ? 'Street • '+count+' establishment names'
     : 'Street • BUKLOD places online'
 );
}

async function loadNearbyPlaces(force=false){
 const c=map.getCenter();

 if(map.getZoom()<15){
   renderNearbyPlaces([]);
   return;
 }

 if(!force&&lastPoiCenter&&distanceKm(lastPoiCenter,c)<1.2){
   renderNearbyPlaces(lastPoiElements);
   return;
 }

 lastPoiCenter={lat:c.lat,lng:c.lng};

 if(poiAbort) poiAbort.abort();
 poiAbort=new AbortController();

 const radius=4500;
 const query='[out:json][timeout:10];('+
   'nwr(around:'+radius+','+c.lat+','+c.lng+')["amenity"~"hospital|clinic|doctors|pharmacy|police|fire_station|school|college|university|bank|atm|fuel|marketplace|restaurant|cafe|fast_food"]["name"];'+
   'nwr(around:'+radius+','+c.lat+','+c.lng+')["shop"]["name"];'+
   'nwr(around:'+radius+','+c.lat+','+c.lng+')["office"]["name"];'+
   'nwr(around:'+radius+','+c.lat+','+c.lng+')["tourism"~"hotel|attraction"]["name"];'+
   ');out center 180;';

 const endpoints=[
   'https://overpass-api.de/api/interpreter',
   'https://overpass.kumi.systems/api/interpreter'
 ];

 setLiveStatus('Loading establishment names…');

 for(const endpoint of endpoints){
   try{
     const response=await fetch(endpoint,{
       method:'POST',
       headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
       body:'data='+encodeURIComponent(query),
       signal:poiAbort.signal,
     });

     if(!response.ok) throw new Error('POI request failed');

     const data=await response.json();
     lastPoiElements=Array.isArray(data.elements)?data.elements:[];
     renderNearbyPlaces(lastPoiElements);
     return;
   }catch(error){
     if(error&&error.name==='AbortError') return;
   }
 }

 renderNearbyPlaces(lastPoiElements);
}

map.on('moveend',()=>{
 if(poiTimer) clearTimeout(poiTimer);
 poiTimer=setTimeout(()=>{
   void loadNearbyPlaces(false);
 },350);
});
setTimeout(()=>{
 map.invalidateSize();
 void loadNearbyPlaces(true);
},160);
</script>
</body>
</html>`;
  }, [
    mapCenter.latitude,
    mapCenter.longitude,
    points,
  ]);

  const iframe = (interactive: boolean) =>
    React.createElement('iframe', {
      title: interactive
        ? 'BUKLOD live satellite interactive community map'
        : 'BUKLOD live satellite community map preview',
      srcDoc,
      style: {
        border: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        background: '#0D1720',
        pointerEvents: interactive ? 'auto' : 'none',
      },
      referrerPolicy: 'no-referrer',
    });

  const controls = (showClose = false) => (
    <View style={styles.mapControls} pointerEvents="box-none">
      <MapIcon
        icon="crosshairs-gps"
        label="Share location"
        onPress={onShareLocation}
      />
      <MapIcon
        icon="pencil"
        label="Manage place"
        onPress={onManagePlace}
        disabled={!canManagePlace}
      />
      {showClose ? (
        <MapIcon
          icon="close"
          label="Close full screen map"
          onPress={() => onExpandedChange?.(false)}
        />
      ) : null}
    </View>
  );

  return (
    <>
      <View style={[styles.previewFrame, { height: previewHeight }]}> 
        {iframe(false)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open BUKLOD live satellite map full screen"
          onPress={() => onExpandedChange?.(true)}
          style={({ pressed }) => [
            styles.previewTapLayer,
            pressed && styles.previewTapLayerPressed,
          ]}
        >
          <View style={styles.previewPrompt}>
            <MaterialCommunityIcons
              name="satellite-variant"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.previewPromptText}>Tap map to open</Text>
          </View>
        </Pressable>
        {controls(false)}
      </View>

      <Modal
        visible={expanded}
        animationType="fade"
        onRequestClose={() => onExpandedChange?.(false)}
      >
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
    backgroundColor: '#0D1720',
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
    backgroundColor: 'rgba(10,24,34,.05)',
  },
  previewTapLayerPressed: {
    backgroundColor: 'rgba(10,24,34,.14)',
  },
  previewPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(10,25,36,.84)',
  },
  previewPromptText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
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
  fullscreenShell: {
    flex: 1,
    backgroundColor: '#0D1720',
    position: 'relative',
  },
  fullscreenMap: { flex: 1, width: '100%' },
});
