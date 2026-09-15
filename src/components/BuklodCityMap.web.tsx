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
.buklod-pin{width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(20,50,70,.25);display:flex;align-items:center;justify-content:center}
.buklod-pin span{transform:rotate(45deg);color:#fff;font-size:12px;font-weight:900}
.buklod-popup-title{font-weight:800;font-size:13px;color:#183047;margin-bottom:3px}.buklod-popup-sub{font-size:11px;color:#60768a}.buklod-verified{font-size:10px;color:#177552;font-weight:700;margin-top:5px}
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
