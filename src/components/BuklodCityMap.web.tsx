import React, { useMemo } from 'react';
import { View } from 'react-native';

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

export function BuklodCityMap({
  points,
  center,
  expanded = false,
}: {
  points: BuklodCityPoint[];
  center?: { latitude: number; longitude: number } | null;
  expanded?: boolean;
}) {
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
.leaflet-popup-content{min-width:220px;margin:12px 14px}
.buklod-pin{width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(20,50,70,.25);display:flex;align-items:center;justify-content:center}
.buklod-pin span{transform:rotate(45deg);color:#fff;font-size:12px;font-weight:900}
.buklod-popup-title{font-weight:800;font-size:13px;color:#183047;margin-bottom:3px}.buklod-popup-sub{font-size:11px;line-height:15px;color:#60768a}.buklod-verified{font-size:10px;color:#177552;font-weight:700;margin-top:5px}
.buklod-popup-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.buklod-popup-action{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 10px;border-radius:10px;text-decoration:none;font-size:10px;font-weight:800;border:1px solid #d7e1e8;color:#245574;background:#f5f8fa}.buklod-popup-action-primary{color:#fff;background:#177552;border-color:#177552}.buklod-popup-note{margin-top:7px;font-size:9px;line-height:13px;color:#748695}
.buklod-nav-hint{min-width:150px;padding:9px 11px;border:1px solid #d7e5dd;border-radius:13px;background:rgba(255,255,255,.96);box-shadow:0 5px 18px rgba(22,60,45,.16);color:#204a3a;cursor:default}.buklod-nav-hint strong{display:block;font-size:11px;line-height:14px}.buklod-nav-hint span{display:block;margin-top:2px;font-size:9px;line-height:12px;color:#60786d}
.buklod-nav-dock{max-width:min(390px,calc(100vw - 44px));padding:10px 11px;border:1px solid #d7e5dd;border-radius:15px;background:rgba(255,255,255,.97);box-shadow:0 8px 26px rgba(19,52,68,.2);color:#1f3c4e}.buklod-nav-dock-hidden{display:none}.buklod-nav-dock-title{font-size:11px;line-height:14px;font-weight:900;color:#20384b}.buklod-nav-dock-sub{margin-top:2px;font-size:9px;line-height:12px;color:#6a7f8f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.buklod-nav-dock-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.buklod-nav-dock a{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 11px;border-radius:10px;text-decoration:none;font-size:10px;font-weight:900;border:1px solid #d7e1e8;color:#245574;background:#f5f8fa}.buklod-nav-dock a.primary{color:#fff;background:#177552;border-color:#177552}.buklod-nav-dock-note{margin-top:6px;font-size:8px;line-height:11px;color:#748695}
@media (max-width:560px){.buklod-nav-hint{min-width:0;padding:7px 9px}.buklod-nav-hint strong{font-size:10px}.buklod-nav-hint span{font-size:8px}.buklod-nav-dock{max-width:calc(100vw - 34px);padding:9px}.buklod-nav-dock-actions{gap:5px}.buklod-nav-dock a{min-height:32px;padding:0 9px;font-size:9px}}
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

const NavigationHint=L.Control.extend({
 onAdd(){
  const div=L.DomUtil.create('div','buklod-nav-hint');
  div.innerHTML='<strong>🧭 BUKLOD Navigation</strong><span>Tap a place pin to navigate</span>';
  L.DomEvent.disableClickPropagation(div);
  return div;
 }
});
new NavigationHint({position:'topright'}).addTo(map);

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
 return {directions,navigate:directions+'&travelmode=driving&dir_action=navigate',map:'https://www.google.com/maps/search/?api=1&query='+destination};
}
function isNavigablePoint(p){return String(p.kind||'').toUpperCase()!=='PERSON' && String(p.category||'').toLowerCase()!=='people';}
function showNavigationDock(p){
 const dock=document.getElementById('buklod-nav-dock');
 if(!dock) return;
 if(!isNavigablePoint(p)){
  dock.className='buklod-nav-dock';
  dock.innerHTML='<div class="buklod-nav-dock-title">Privacy-protected presence</div><div class="buklod-nav-dock-note">People-presence pins are not exposed as navigation destinations.</div>';
  return;
 }
 const urls=navigationUrls(p);
 dock.className='buklod-nav-dock';
 dock.innerHTML='<div class="buklod-nav-dock-title">Navigate to '+escapeHtml(p.title)+'</div><div class="buklod-nav-dock-sub">'+escapeHtml(p.subtitle||p.category||'BUKLOD place')+'</div><div class="buklod-nav-dock-actions"><a class="primary" href="'+urls.navigate+'" target="_blank" rel="noopener noreferrer">Start navigation</a><a href="'+urls.directions+'" target="_blank" rel="noopener noreferrer">Directions</a><a href="'+urls.map+'" target="_blank" rel="noopener noreferrer">Google Maps</a></div><div class="buklod-nav-dock-note">Google Maps can use your current device location as origin when available.</div>';
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
 const urls=navigationUrls(p);
 const navigationHtml=isNavigablePoint(p)
   ? '<div class="buklod-popup-actions"><a class="buklod-popup-action buklod-popup-action-primary" href="'+urls.navigate+'" target="_blank" rel="noopener noreferrer">Navigate</a><a class="buklod-popup-action" href="'+urls.directions+'" target="_blank" rel="noopener noreferrer">Directions</a><a class="buklod-popup-action" href="'+urls.map+'" target="_blank" rel="noopener noreferrer">Google Maps</a></div><div class="buklod-popup-note">Google Maps uses your current device location as the starting point when available.</div>'
   : '<div class="buklod-popup-note">People-presence pins are intentionally not exposed as navigation destinations.</div>';
 marker.bindPopup('<div class="buklod-popup-title">'+safeTitle+'</div><div class="buklod-popup-sub">'+safeSub+'</div>'+(p.verified?'<div class="buklod-verified">Verified BUKLOD place</div>':'')+navigationHtml);
 marker.on('click',()=>showNavigationDock(p));
 bounds.push([p.latitude,p.longitude]);
});
if(bounds.length>1){map.fitBounds(bounds,{padding:[38,38],maxZoom:15});}else if(bounds.length===1){map.setView(bounds[0],15);}
setTimeout(()=>map.invalidateSize(),120);
</script>
</body>
</html>`;
  }, [mapCenter.latitude, mapCenter.longitude, points]);

  return (
    <View
      style={{
        width: '100%',
        height: expanded ? 620 : 440,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: '#EAF2F4',
      }}
    >
      {React.createElement('iframe', {
        title: 'BUKLOD City community map',
        srcDoc,
        style: {
          border: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          background: '#EAF2F4',
        },
        referrerPolicy: 'no-referrer',
      })}
    </View>
  );
}
