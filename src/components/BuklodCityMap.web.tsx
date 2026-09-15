import React, { useMemo } from 'react';
import { View } from 'react-native';

import type { BuklodCityPoint } from '@/lib/buklodCity';
import type { BuklodHomeMapLocation } from '@/lib/buklodHomeLocation';

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
  homePoint,
  expanded = false,
}: {
  points: BuklodCityPoint[];
  center?: { latitude: number; longitude: number } | null;
  homePoint?: BuklodHomeMapLocation | null;
  expanded?: boolean;
}) {
  const mapCenter = center ?? homePoint ?? points[0] ?? FALLBACK_CENTER;

  const srcDoc = useMemo(() => {
    const payload = points.map(point => ({
      id: point.id,
      title: point.title,
      subtitle: point.subtitle ?? '',
      category: String(point.category || 'community'),
      latitude: point.latitude,
      longitude: point.longitude,
      verified: Boolean(point.verified),
      isMe: Boolean(point.isMe),
    }));

    const privateHome = homePoint
      ? {
          latitude: homePoint.latitude,
          longitude: homePoint.longitude,
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
.buklod-pin{width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(20,50,70,.25);display:flex;align-items:center;justify-content:center}
.buklod-pin span{transform:rotate(45deg);color:#fff;font-size:12px;font-weight:900}
.buklod-home-pin{width:42px;height:42px;border-radius:14px;background:#fff;border:3px solid #177552;box-shadow:0 5px 16px rgba(23,117,82,.32);display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer}
.buklod-home-pin:after{content:'HOME';position:absolute;top:43px;left:50%;transform:translateX(-50%);background:#177552;color:#fff;border-radius:999px;padding:2px 6px;font-size:8px;line-height:12px;font-weight:900;letter-spacing:.5px;white-space:nowrap;box-shadow:0 2px 6px rgba(20,50,70,.2)}
.buklod-home-pin svg{width:25px;height:25px;display:block;fill:#177552}
.buklod-popup-title{font-weight:800;font-size:13px;color:#183047;margin-bottom:3px}.buklod-popup-sub{font-size:11px;color:#60768a}.buklod-verified{font-size:10px;color:#177552;font-weight:700;margin-top:5px}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
const points=${safeJson(payload)};
const home=${safeJson(privateHome)};
const colors=${safeJson(CATEGORY_COLORS)};
const center=${safeJson([Number(mapCenter.latitude), Number(mapCenter.longitude)])};
const map=L.map('map',{zoomControl:true,attributionControl:true}).setView(center,13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
const bounds=[];
points.forEach((p)=>{
 if(!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)) return;
 const color=colors[p.category]||'#35679D';
 const initial=p.isMe?'M':(String(p.category||'C').charAt(0).toUpperCase());
 const icon=L.divIcon({className:'',html:'<div class="buklod-pin" style="background:'+color+'"><span>'+initial+'</span></div>',iconSize:[28,28],iconAnchor:[14,28],popupAnchor:[0,-26]});
 const marker=L.marker([p.latitude,p.longitude],{icon}).addTo(map);
 const safeTitle=String(p.title||'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
 const safeSub=String(p.subtitle||'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
 marker.bindPopup('<div class="buklod-popup-title">'+safeTitle+'</div><div class="buklod-popup-sub">'+safeSub+'</div>'+(p.verified?'<div class="buklod-verified">Verified BUKLOD place</div>':''));
 bounds.push([p.latitude,p.longitude]);
});
if(home&&Number.isFinite(home.latitude)&&Number.isFinite(home.longitude)){
 const homeSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 2.8 10.6a1 1 0 0 0 .6 1.8h1.1v7.1c0 .8.7 1.5 1.5 1.5h4.2v-5.5h3.6V21H18c.8 0 1.5-.7 1.5-1.5v-7.1h1.1a1 1 0 0 0 .6-1.8L12 3.2Z"/></svg>';
 const homeIcon=L.divIcon({className:'',html:'<div class="buklod-home-pin" title="Open My BUKLOD Home">'+homeSvg+'</div>',iconSize:[42,58],iconAnchor:[21,42]});
 const homeMarker=L.marker([home.latitude,home.longitude],{icon:homeIcon,zIndexOffset:1000,keyboard:true,title:'My BUKLOD Home'}).addTo(map);
 homeMarker.bindTooltip('My BUKLOD Home · tap to enter',{direction:'top',offset:[0,-34]});
 homeMarker.on('click',()=>{try{window.top.location.assign('/personal-home');}catch(_){window.location.assign('/personal-home');}});
 bounds.push([home.latitude,home.longitude]);
}
if(bounds.length>1){map.fitBounds(bounds,{padding:[38,38],maxZoom:15});}else if(bounds.length===1){map.setView(bounds[0],15);}
setTimeout(()=>map.invalidateSize(),120);
</script>
</body>
</html>`;
  }, [
    homePoint?.latitude,
    homePoint?.longitude,
    mapCenter.latitude,
    mapCenter.longitude,
    points,
  ]);

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
