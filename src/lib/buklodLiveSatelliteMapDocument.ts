export const BUKLOD_MAP_LEAFLET_CSS =
  '/vendor/leaflet/leaflet.css?v=1.9.4-buklod-r4';
export const BUKLOD_MAP_LEAFLET_JS =
  '/vendor/leaflet/leaflet.js?v=1.9.4-buklod-r4';
export const BUKLOD_MAP_LEAFLET_CSS_CDN =
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
export const BUKLOD_MAP_LEAFLET_JS_CDN =
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

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

export function buildBuklodLiveSatelliteMapDocument(input: {
  points: unknown;
  center: { latitude: number; longitude: number };
  leafletCss?: string;
  leafletJs?: string;
  bottomInset?: number;
}) {
  const pointsJson = safeJson(input.points);
  const colorsJson = safeJson(CATEGORY_COLORS);
  const centerJson = safeJson([
    Number(input.center.latitude),
    Number(input.center.longitude),
  ]);
  const leafletCss = input.leafletCss ?? BUKLOD_MAP_LEAFLET_CSS;
  const leafletJs = input.leafletJs ?? BUKLOD_MAP_LEAFLET_JS;
  const bottomInset = Math.max(0, Math.round(input.bottomInset ?? 0));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<!-- BUKLOD_LOCAL_LEAFLET_ENGINE_R4 -->
<link rel="stylesheet" href="${leafletCss}" />
<style>
html,body,#map,.leaflet-container{position:fixed;inset:0;width:100%;height:100%;margin:0;padding:0;overflow:hidden;background:#eef2f4;font-family:Inter,system-ui,-apple-system,sans-serif}
.leaflet-bottom{bottom:${bottomInset}px}
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
.poi-pin{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.98);border:1.5px solid #1f6d5b;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#205b4d;box-shadow:0 2px 6px rgba(0,0,0,.26)}
.poi-type{display:inline-block;margin-top:5px;padding:2px 6px;border-radius:999px;background:#edf6f2;color:#246653;font-size:9px;font-weight:800;text-transform:capitalize}
.poi-photo{display:block;width:100%;height:92px;object-fit:cover;border-radius:10px;margin:0 0 8px;background:#eef3f0}
.buklod-popup-nav{margin-top:9px;width:100%;border:0;border-radius:9px;background:#177552;color:#fff;padding:8px 10px;font:800 10px/13px Inter,system-ui,sans-serif;cursor:pointer}
.buklod-route-panel{min-width:190px;max-width:min(320px,calc(100vw - 40px));padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.97);border:1px solid #cfe0d7;box-shadow:0 8px 24px rgba(0,0,0,.22);color:#203d4e}
.buklod-route-title{font-size:11px;line-height:14px;font-weight:900;color:#177552}
.buklod-route-meta{margin-top:3px;font-size:10px;line-height:14px;font-weight:800;color:#405d6d}
.buklod-route-note{margin-top:4px;font-size:8px;line-height:11px;color:#728693}
.buklod-route-actions{display:flex;gap:6px;margin-top:8px}
.buklod-route-actions a,.buklod-route-actions button{appearance:none;border:0;border-radius:9px;padding:7px 9px;font:800 9px/12px Inter,system-ui,sans-serif;text-decoration:none;cursor:pointer}
.buklod-route-actions a{background:#177552;color:#fff}
.buklod-route-actions button{background:#edf6f2;color:#246653}
.buklod-user-dot{width:18px;height:18px;border-radius:50%;background:#1677ff;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.34)}
.buklod-destination-search{width:min(330px,calc(100vw - 92px));padding:9px;border:1px solid #cfe0d7;border-radius:14px;background:rgba(255,255,255,.98);box-shadow:0 7px 22px rgba(0,0,0,.24);color:#1f3c4e}
.buklod-destination-search-row{display:flex;gap:6px;align-items:center}
.buklod-destination-search input{min-width:0;flex:1;border:1px solid #c6d8cf;border-radius:10px;padding:8px 9px;background:#fff;color:#183047;font:700 10px/14px Inter,system-ui,sans-serif;outline:none}
.buklod-destination-search input:focus{border-color:#177552;box-shadow:0 0 0 2px rgba(23,117,82,.12)}
.buklod-destination-search button{appearance:none;border:0;border-radius:10px;padding:8px 10px;background:#177552;color:#fff;font:900 9px/12px Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
.buklod-destination-results{display:none;margin-top:7px;max-height:190px;overflow:auto;border-top:1px solid #e1ebe6;padding-top:5px}
.buklod-destination-result{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #edf2ef;background:#fff;color:#284655;padding:7px 5px;cursor:pointer}
.buklod-destination-result strong{display:block;font:900 10px/13px Inter,system-ui,sans-serif;color:#1f4f3d}
.buklod-destination-result span{display:block;margin-top:2px;font:600 8px/11px Inter,system-ui,sans-serif;color:#71828d;white-space:normal}
.buklod-destination-selected{padding:7px 5px}
.buklod-destination-selected strong{display:block;font-size:10px;line-height:13px;color:#177552}
.buklod-destination-selected span{display:block;margin:2px 0 7px;font-size:8px;line-height:11px;color:#71828d}
.buklod-destination-selected-actions{display:flex;gap:6px}
.buklod-destination-selected-actions button{flex:1}
.buklod-destination-note{padding:6px 5px;color:#71828d;font:700 8px/11px Inter,system-ui,sans-serif}
@media (max-width:560px){.buklod-nav-control{min-width:145px;max-width:calc(100vw - 86px);padding:8px 9px}.buklod-nav-control strong{font-size:10px}.buklod-nav-control span{font-size:8px}.buklod-destination-search{width:calc(100vw - 86px);padding:8px}.buklod-home-marker{width:150px}.buklod-home-address{max-width:144px;font-size:8px;line-height:11px}.buklod-live-status{max-width:165px;font-size:8px}}
</style>
</head>
<body>
<div id="map"></div>
<script src="${leafletJs}"></script>
<script>
function buklodShowMapEngineError(){
 document.getElementById('map').innerHTML='<div style="height:100%;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;color:#49616f;font:700 12px/18px system-ui;background:#eef2f4">BUKLOD map engine could not load. Please refresh the page.</div>';
 throw new Error('BUKLOD_LOCAL_LEAFLET_ENGINE_MISSING');
}
function buklodBootLiveMap(){
if(!window.L){
 buklodShowMapEngineError();
 return;
}
const points=${pointsJson};
const colors=${colorsJson};
const center=${centerJson};
document.addEventListener('click',function(event){
 var node=event.target;
 while(node&&node.tagName!=='A') node=node.parentElement;
 if(!node||!node.getAttribute) return;
 var href=node.getAttribute('href')||'';
 if(href.indexOf('google.com/maps')===-1&&href.indexOf('maps.google.com')===-1) return;
 event.preventDefault();
 try{window.parent.postMessage({type:'BUKLOD_MAP_OPEN_URL',url:node.href},'*');}catch(e){}
});


/*
 * BUKLOD_IN_MAP_DRIVING_NAV_R1
 *
 * Start with the clearer road map for actual wayfinding. Satellite remains
 * one tap away in Layers and its place-label overlay remains available.
 */
/* BUKLOD_PROGRESSIVE_CLEAR_MAP_R2 */
const map=L.map('map',{zoomControl:true,attributionControl:true,preferCanvas:true,maxZoom:19}).setView(center,14);
const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
 maxNativeZoom:19,
 maxZoom:19,
 detectRetina:true,
 keepBuffer:4,
 attribution:'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
});
const satelliteLabels=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{
 maxNativeZoom:19,
 maxZoom:19,
 detectRetina:true,
 keepBuffer:4,
 attribution:'Reference &copy; Esri'
});
/* BUKLOD_ROAD_DEFAULT_ESRI_R6
 * The previously visible Carto alternate now requires an API key and paints
 * an API KEY REQUIRED watermark. Use Esri World Street Map as the default,
 * keep OpenStreetMap as the first fallback, and Esri Topo as backup.
 */
const street=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{
 maxNativeZoom:19,
 maxZoom:19,
 keepBuffer:4,
 updateWhenIdle:false,
 attribution:'Tiles &copy; Esri and contributors'
}).addTo(map);
function fitBuklodMap(){
 try{map.invalidateSize({animate:false});}catch(e){}
}
window.addEventListener('resize', fitBuklodMap);
if(window.ResizeObserver){
 try{
  new ResizeObserver(fitBuklodMap).observe(document.documentElement);
  new ResizeObserver(fitBuklodMap).observe(document.getElementById('map'));
 }catch(e){}
}
[0,60,180,320,800].forEach(function(ms){setTimeout(fitBuklodMap, ms);});

const streetFallback=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
 maxNativeZoom:19,
 maxZoom:19,
 keepBuffer:4,
 updateWhenIdle:false,
 attribution:'&copy; OpenStreetMap contributors'
});

const streetFallback2=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{
 maxNativeZoom:19,
 maxZoom:19,
 keepBuffer:4,
 updateWhenIdle:false,
 attribution:'Tiles &copy; Esri and contributors'
});

let roadStage=0;
let roadTileLoaded=false;
function activateRoadFallback(reason){
 if(roadStage===0){
  roadStage=1;
  try{map.removeLayer(street);}catch{}
  streetFallback.addTo(map);
  setLiveStatus('Road map • OSM fallback');
  return;
 }
 if(roadStage===1){
  roadStage=2;
  try{map.removeLayer(streetFallback);}catch{}
  streetFallback2.addTo(map);
  setLiveStatus('Road map • topo backup');
  return;
 }
 setLiveStatus('Road tiles unavailable • retry when connection improves');
}

street.once('tileload',()=>{
 roadTileLoaded=true;
 setLiveStatus('Road map • zoom in for nearby places');
});
street.on('tileerror',()=>activateRoadFallback('esri-street-error'));

streetFallback.once('tileload',()=>{
 roadTileLoaded=true;
 setLiveStatus('Road map • zoom in for nearby places');
});
streetFallback.on('tileerror',()=>activateRoadFallback('osm-error'));

streetFallback2.once('tileload',()=>{
 roadTileLoaded=true;
 setLiveStatus('Road map • zoom in for nearby places');
});

setTimeout(()=>{
 if(!roadTileLoaded&&roadStage===0){
  activateRoadFallback('esri-street-timeout');
 }
},3500);

setTimeout(()=>{
 if(!roadTileLoaded&&roadStage===1){
  activateRoadFallback('osm-timeout');
 }
},7500);

const nearbyPlaces=L.layerGroup().addTo(map);
const routeLayer=L.layerGroup().addTo(map);

L.control.layers(
 { 'Road map': street, 'Road map OSM': streetFallback, 'Road map topo': streetFallback2, 'Satellite': satellite },
 { 'Satellite labels': satelliteLabels, 'Nearby places': nearbyPlaces },
 { position:'bottomright', collapsed:true }
).addTo(map);

let selectedDestination=null;
let activeRoute=null;
let userLocationMarker=null;
let lastKnownOrigin=null;
let destinationSearchResults=[];

const NavigationControl=L.Control.extend({
 onAdd(){
  const link=L.DomUtil.create('a','buklod-nav-control');
  link.id='buklod-nav-control';
  link.href='#';
  link.setAttribute('aria-disabled','false');
  link.className='buklod-nav-control active';
  link.innerHTML='<strong>🧭 BUKLOD Navigation</strong><span>Tap here to locate yourself, or tap a place pin</span>';
  L.DomEvent.disableClickPropagation(link);
  L.DomEvent.on(link,'click',(event)=>{
    L.DomEvent.preventDefault(event);

    if(!selectedDestination){
      link.className='buklod-nav-control active';
      link.setAttribute('aria-disabled','false');
      link.innerHTML='<strong>🧭 Finding your location…</strong><span>Then tap a place pin for your destination</span>';
      setLiveStatus('Getting your current location…');
      try{
        window.parent.postMessage({type:'BUKLOD_MAP_REQUEST_LOCATION',locateOnly:true},'*');
      }catch{
        setLiveStatus('Could not request your current location.');
      }
      return;
    }

    void startBuklodNavigation(selectedDestination);
  });
  return link;
 }
});
new NavigationControl({position:'topleft'}).addTo(map);

/* BUKLOD_NAV_DESTINATION_SEARCH_R8 */
const DestinationSearchControl=L.Control.extend({
 onAdd(){
  const panel=L.DomUtil.create('div','buklod-destination-search');
  panel.id='buklod-destination-search';
  panel.style.display='none';
  panel.innerHTML=
   '<div class="buklod-destination-search-row">'+
    '<input id="buklod-destination-input" type="search" inputmode="search" autocomplete="off" aria-label="Search destination" placeholder="Search destination…" />'+
    '<button id="buklod-destination-search-button" type="button">SEARCH</button>'+
   '</div>'+
   '<div id="buklod-destination-results" class="buklod-destination-results"></div>';
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);

  const input=panel.querySelector('#buklod-destination-input');
  const button=panel.querySelector('#buklod-destination-search-button');

  const runSearch=()=>{
   void searchDestinationQuery(input&&input.value);
  };

  if(button){
   L.DomEvent.on(button,'click',(event)=>{
    L.DomEvent.preventDefault(event);
    runSearch();
   });
  }

  if(input){
   L.DomEvent.on(input,'keydown',(event)=>{
    if(event&&event.key==='Enter'){
     L.DomEvent.preventDefault(event);
     runSearch();
    }
   });
  }

  return panel;
 }
});
new DestinationSearchControl({position:'topleft'}).addTo(map);

const RoutePanelControl=L.Control.extend({
 onAdd(){
  const panel=L.DomUtil.create('div','buklod-route-panel');
  panel.id='buklod-route-panel';
  panel.style.display='none';
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);
  return panel;
 }
});
new RoutePanelControl({position:'bottomleft'}).addTo(map);

const LiveStatusControl=L.Control.extend({
 onAdd(){
  const status=L.DomUtil.create('div','buklod-live-status');
  status.id='buklod-live-status';
  status.textContent='Road map • loading nearby places…';
  L.DomEvent.disableClickPropagation(status);
  return status;
 }
});
new LiveStatusControl({position:'bottomleft'}).addTo(map);

function setLiveStatus(text){
 const el=document.getElementById('buklod-live-status');
 if(el) el.textContent=text;
}
function showDestinationSearch(){
 const panel=document.getElementById('buklod-destination-search');
 if(panel) panel.style.display='block';
}
function setDestinationResultsHtml(html){
 const results=document.getElementById('buklod-destination-results');
 if(!results) return null;
 results.style.display='block';
 results.innerHTML=html;
 return results;
}
function destinationTitle(item){
 const named=String(item&&item.name||'').trim();
 if(named) return named;
 return String(item&&item.display_name||'Destination').split(',')[0].trim()||'Destination';
}
async function searchDestinationQuery(rawQuery){
 const query=String(rawQuery||'').trim();
 showDestinationSearch();

 if(query.length<2){
  setDestinationResultsHtml('<div class="buklod-destination-note">Type at least 2 letters to search a destination.</div>');
  return;
 }

 setDestinationResultsHtml('<div class="buklod-destination-note">Searching destination…</div>');

 try{
  const url=
   'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&q='+
   encodeURIComponent(query);
  const response=await fetch(url,{headers:{Accept:'application/json'}});
  if(!response.ok) throw new Error('Destination search unavailable');

  const data=await response.json();
  destinationSearchResults=(Array.isArray(data)?data:[])
   .map((item)=>({
    latitude:Number(item&&item.lat),
    longitude:Number(item&&item.lon),
    title:destinationTitle(item),
    subtitle:String(item&&item.display_name||'').trim(),
    kind:'SEARCH',
    category:'search',
   }))
   .filter((item)=>Number.isFinite(item.latitude)&&Number.isFinite(item.longitude));

  if(!destinationSearchResults.length){
   setDestinationResultsHtml('<div class="buklod-destination-note">No matching destination found. Try a more specific place name or tap a map pin.</div>');
   return;
  }

  const results=setDestinationResultsHtml(
   destinationSearchResults.map((item,index)=>
    '<button class="buklod-destination-result" type="button" data-index="'+index+'">'+
     '<strong>'+escapeHtml(item.title)+'</strong>'+
     '<span>'+escapeHtml(item.subtitle)+'</span>'+
    '</button>'
   ).join('')+
   '<div class="buklod-destination-note">Search results © OpenStreetMap contributors</div>'
  );

  if(results){
   results.querySelectorAll('button[data-index]').forEach((button)=>{
    L.DomEvent.on(button,'click',(event)=>{
     L.DomEvent.preventDefault(event);
     const index=Number(button.getAttribute('data-index'));
     const p=destinationSearchResults[index];
     if(!p) return;
     selectNavigationDestination(p);
     renderSelectedSearchDestination(p);
    });
   });
  }
 }catch{
  setDestinationResultsHtml('<div class="buklod-destination-note">Destination search is temporarily unavailable. You can still tap any place pin on the map.</div>');
 }
}
function renderSelectedSearchDestination(p){
 showDestinationSearch();
 const results=setDestinationResultsHtml(
  '<div class="buklod-destination-selected">'+
   '<strong>Destination: '+escapeHtml(p.title)+'</strong>'+
   '<span>'+escapeHtml(p.subtitle||'Tap START to build your route.')+'</span>'+
   '<div class="buklod-destination-selected-actions">'+
    '<button id="buklod-destination-start" type="button">START</button>'+
    '<button id="buklod-destination-change" type="button">CHANGE</button>'+
   '</div>'+
  '</div>'
 );
 if(!results) return;

 const start=results.querySelector('#buklod-destination-start');
 const change=results.querySelector('#buklod-destination-change');

 if(start){
  L.DomEvent.on(start,'click',(event)=>{
   L.DomEvent.preventDefault(event);
   void startBuklodNavigation(p);
  });
 }
 if(change){
  L.DomEvent.on(change,'click',(event)=>{
   L.DomEvent.preventDefault(event);
   const input=document.getElementById('buklod-destination-input');
   setDestinationResultsHtml('<div class="buklod-destination-note">Search another destination above.</div>');
   if(input&&input.focus) input.focus();
  });
 }
 map.setView([p.latitude,p.longitude],16);
 setLiveStatus('Destination selected • tap START');
}
function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
function navigationUrl(p){
 const destination=encodeURIComponent(String(p.latitude)+','+String(p.longitude));
 return 'https://www.google.com/maps/dir/?api=1&destination='+destination+'&travelmode=driving&dir_action=navigate';
}
function isNavigablePoint(p){return String(p.kind||'').toUpperCase()!=='PERSON' && String(p.category||'').toLowerCase()!=='people';}
function formatDistance(meters){
 const km=Number(meters||0)/1000;
 return km<1 ? Math.max(1,Math.round(Number(meters||0)))+' m' : km.toFixed(km<10?1:0)+' km';
}
function formatDuration(seconds){
 const minutes=Math.max(1,Math.round(Number(seconds||0)/60));
 if(minutes<60) return minutes+' min';
 const hours=Math.floor(minutes/60);
 const rest=minutes%60;
 return hours+' hr'+(rest?' '+rest+' min':'');
}
function hideRoutePanel(){
 const panel=document.getElementById('buklod-route-panel');
 if(panel) panel.style.display='none';
}
function clearBuklodRoute(){
 routeLayer.clearLayers();
 activeRoute=null;
 if(userLocationMarker){
  map.removeLayer(userLocationMarker);
  userLocationMarker=null;
 }
 hideRoutePanel();
 const link=document.getElementById('buklod-nav-control');
 if(link&&selectedDestination){
  link.innerHTML='<strong>🧭 BUKLOD Navigation</strong><span>Route to '+escapeHtml(selectedDestination.title)+'</span>';
 }
}
window.__buklodClearRoute=clearBuklodRoute;
window.__buklodNavigateSelected=()=>{
 if(selectedDestination){
  void startBuklodNavigation(selectedDestination);
 }
};

function showRouteFallback(p,message){
 const panel=document.getElementById('buklod-route-panel');
 if(!panel) return;
 panel.style.display='block';
 panel.innerHTML=
  '<div class="buklod-route-title">BUKLOD Navigation</div>'+
  '<div class="buklod-route-meta">'+escapeHtml(message)+'</div>'+
  '<div class="buklod-route-note">You can still continue with external driving directions.</div>'+
  '<div class="buklod-route-actions">'+
   '<a href="'+navigationUrl(p)+'" target="_blank" rel="noopener noreferrer">Open Google Maps</a>'+
   '<button type="button" onclick="window.__buklodClearRoute()">Clear</button>'+
  '</div>';
}

function renderDrivingRoute(origin,p,route){
 routeLayer.clearLayers();

 const line=L.geoJSON(route.geometry,{
  style:{
   color:'#177552',
   weight:7,
   opacity:.92,
   lineCap:'round',
   lineJoin:'round',
  }
 }).addTo(routeLayer);

 const startIcon=L.divIcon({
  className:'',
  html:'<div class="buklod-user-dot"></div>',
  iconSize:[18,18],
  iconAnchor:[9,9],
 });
 userLocationMarker=L.marker(
  [origin.latitude,origin.longitude],
  {icon:startIcon,title:'Your location'}
 ).addTo(map);

 const routeBounds=line.getBounds();
 if(routeBounds.isValid()){
  map.fitBounds(routeBounds,{padding:[42,42],maxZoom:17});
 }

 activeRoute=route;

 const panel=document.getElementById('buklod-route-panel');
 if(panel){
  panel.style.display='block';
  panel.innerHTML=
   '<div class="buklod-route-title">🧭 BUKLOD Navigation</div>'+
   '<div class="buklod-route-meta">'+
    formatDistance(route.distance)+' • '+formatDuration(route.duration)+
    ' to '+escapeHtml(p.title)+
   '</div>'+
   '<div class="buklod-route-note">Driving route shown inside BUKLOD. Keep the map open while travelling. Use Google Maps only if you want external turn-by-turn voice guidance.</div>'+
   '<div class="buklod-route-actions">'+
    '<a href="'+navigationUrl(p)+'" target="_blank" rel="noopener noreferrer">Voice guidance</a>'+
    '<button type="button" onclick="window.__buklodClearRoute()">Clear route</button>'+
   '</div>';
 }

 const link=document.getElementById('buklod-nav-control');
 if(link){
  link.innerHTML='<strong>🧭 Route ready</strong><span>'+formatDistance(route.distance)+' • '+formatDuration(route.duration)+'</span>';
 }
}

async function requestDrivingRoute(origin,p){
 const url=
  'https://router.project-osrm.org/route/v1/driving/'+
  encodeURIComponent(origin.longitude+','+origin.latitude+';'+p.longitude+','+p.latitude)+
  '?overview=full&geometries=geojson&steps=true&alternatives=false';

 const response=await fetch(url);
 if(!response.ok) throw new Error('Driving route unavailable');

 const data=await response.json();
 const route=Array.isArray(data.routes)?data.routes[0]:null;
 if(!route||!route.geometry) throw new Error('No driving route found');

 renderDrivingRoute(origin,p,route);
}

let pendingNavigationDestination=null;

async function startBuklodNavigation(p){
 if(!p||!isNavigablePoint(p)) return;

 if(
  lastKnownOrigin&&
  Number.isFinite(lastKnownOrigin.latitude)&&
  Number.isFinite(lastKnownOrigin.longitude)
 ){
  pendingNavigationDestination=null;
  const link=document.getElementById('buklod-nav-control');
  if(link){
   link.innerHTML='<strong>🧭 BUKLOD Navigation</strong><span>Building route…</span>';
  }
  void requestDrivingRoute(lastKnownOrigin,p).catch(()=>{
   showRouteFallback(p,'Could not build the in-app driving route.');
  });
  return;
 }

 pendingNavigationDestination=p;

 const link=document.getElementById('buklod-nav-control');
 if(link){
  link.innerHTML='<strong>🧭 BUKLOD Navigation</strong><span>Getting your current location…</span>';
 }

 try{
  window.parent.postMessage({type:'BUKLOD_MAP_REQUEST_LOCATION'},'*');
 }catch{
  showRouteFallback(p,'Could not request your current location.');
 }
}

window.addEventListener('message',(event)=>{
 const data=event&&event.data;
 if(!data||data.type!=='BUKLOD_MAP_LOCATION_RESULT') return;

 const p=pendingNavigationDestination;

 if(!data.ok){
  if(p){
   pendingNavigationDestination=null;
   showRouteFallback(p,String(data.message||'Location is unavailable.'));
  }else{
   setLiveStatus(String(data.message||'Location is unavailable.'));
   const link=document.getElementById('buklod-nav-control');
   if(link){
    link.innerHTML='<strong>🧭 BUKLOD Navigation</strong><span>Tap here to retry location, or tap a place pin</span>';
   }
  }
  return;
 }

 const origin={
  latitude:Number(data.latitude),
  longitude:Number(data.longitude),
 };

 if(!Number.isFinite(origin.latitude)||!Number.isFinite(origin.longitude)){
  setLiveStatus('Current location is unavailable.');
  return;
 }

 lastKnownOrigin=origin;

 if(!p||data.locateOnly){
  if(data.locateOnly){
   pendingNavigationDestination=null;
  }
  if(userLocationMarker){
   try{map.removeLayer(userLocationMarker);}catch{}
  }
  const myIcon=L.divIcon({
   className:'',
   html:'<div class="buklod-user-dot"></div>',
   iconSize:[18,18],
   iconAnchor:[9,9],
  });
  userLocationMarker=L.marker(
   [origin.latitude,origin.longitude],
   {icon:myIcon,title:'Your location'}
  ).addTo(map);
  map.setView([origin.latitude,origin.longitude],17);
  showDestinationSearch();
  setLiveStatus('Your location • search or tap a place pin');
  const link=document.getElementById('buklod-nav-control');
  if(link&&!selectedDestination){
   link.className='buklod-nav-control active';
   link.setAttribute('aria-disabled','false');
   link.innerHTML='<strong>🧭 You are here</strong><span>Search destination or tap a place pin</span>';
  }
  const input=document.getElementById('buklod-destination-input');
  if(input&&input.focus) input.focus();
  return;
 }

 pendingNavigationDestination=null;
 void requestDrivingRoute(origin,p).catch(()=>{
  showRouteFallback(p,'Could not build the in-app driving route.');
 });
});

function selectNavigationDestination(p){
 const link=document.getElementById('buklod-nav-control');
 if(!link) return;

 clearBuklodRoute();

 if(!isNavigablePoint(p)){
  selectedDestination=null;
  link.className='buklod-nav-control privacy';
  link.setAttribute('aria-disabled','true');
  link.href='#';
  link.innerHTML='<strong>🛡 Privacy-protected presence</strong><span>People pins are not navigation destinations</span>';
  return;
 }

 selectedDestination=p;
 link.className='buklod-nav-control active';
 link.setAttribute('aria-disabled','false');
 link.href=navigationUrl(p);
 link.target='_blank';
 link.rel='noopener noreferrer';
 link.innerHTML='<strong>🧭 Destination selected</strong><span>'+escapeHtml(p.title)+' • tap here to start</span>';

 if(String(p.kind||'').toUpperCase()==='SEARCH'){
  renderSelectedSearchDestination(p);
 }
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
 if(['hospital','clinic','doctors'].includes(amenity)) return {type:'medical',icon:'H'};
 if(amenity==='pharmacy') return {type:'pharmacy',icon:'+'};
 if(['school','college','university'].includes(amenity)) return {type:'school',icon:'S'};
 if(amenity==='police') return {type:'police',icon:'P'};
 if(amenity==='fire_station') return {type:'fire station',icon:'F'};
 if(amenity==='marketplace') return {type:'market',icon:'M'};
 if(['restaurant','cafe','fast_food'].includes(amenity)) return {type:'food',icon:'R'};
 if(['bank','atm'].includes(amenity)) return {type:'bank',icon:'B'};
 if(amenity==='fuel') return {type:'fuel',icon:'G'};
 if(tourism==='hotel') return {type:'hotel',icon:'H'};
 if(tourism==='attraction') return {type:'attraction',icon:'•'};
 if(shop) return {type:shop.replaceAll('_',' '),icon:'•'};
 if(office) return {type:office.replaceAll('_',' '),icon:'•'};
 return {type:'place',icon:'•'};
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
function poiPhotoUrl(tags){
 const raw=String(tags.image||'').trim();
 /* BUKLOD_NAVIGATION_LOCATION_FULL_R6 */
/* BUKLOD_MAP_SRCDOC_PARSE_FIX_R5
  * Avoid slash-escaped regex inside the outer TS template literal. In the
  * generated srcDoc, \/ escapes are consumed and would produce an invalid
  * regex, aborting the whole map script before L.map() runs.
  */
 const lowerRaw=raw.toLowerCase();
 if(lowerRaw.startsWith('http://')||lowerRaw.startsWith('https://')) return raw;
 const commons=String(tags.wikimedia_commons||'').trim();
 if(/^File:/i.test(commons)){
  return 'https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encodeURIComponent(commons.replace(/^File:/i,''));
 }
 return '';
}
function addNearbyPlace(element){
 const tags=element.tags||{};
 const name=String(tags.name||'').trim();
 if(!name) return false;
 const coords=elementCoordinates(element);
 if(!coords) return false;
 const meta=poiMeta(tags);
 const zoom=map.getZoom();
 const pinSize=zoom>=18?22:(zoom>=16?20:18);
 const icon=L.divIcon({className:'',html:'<div class="poi-pin" style="width:'+pinSize+'px;height:'+pinSize+'px">'+meta.icon+'</div>',iconSize:[pinSize,pinSize],iconAnchor:[pinSize/2,pinSize/2],popupAnchor:[0,-pinSize/2]});
 const marker=L.marker([coords.latitude,coords.longitude],{icon,title:name}).addTo(nearbyPlaces);
 const address=poiAddress(tags);
 const photo=poiPhotoUrl(tags);
 const popup=
   (photo?'<img class="poi-photo" src="'+escapeHtml(photo)+'" alt="" loading="lazy" referrerpolicy="no-referrer" />':'')+
   '<div class="buklod-popup-title">'+escapeHtml(name)+'</div>'+
   '<div class="poi-type">'+escapeHtml(meta.type)+'</div>'+
   (address?'<div class="buklod-popup-sub" style="margin-top:6px">'+escapeHtml(address)+'</div>':'')+
   '<div class="buklod-popup-note">Selected place. Zoom in to reveal more nearby establishments.</div>'+
   '<button class="buklod-popup-nav" type="button" onclick="window.__buklodNavigateSelected()">Navigate</button>';
 marker.bindTooltip(escapeHtml(name),{direction:'top'});
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

/* BUKLOD_PROGRESSIVE_POI_ZOOM_R2 */
let poiTimer=null;
let poiAbort=null;
let lastPoiCenter=null;
let lastPoiZoom=null;
function distanceKm(a,b){
 const rad=Math.PI/180;
 const dLat=(b.lat-a.lat)*rad;
 const dLon=(b.lng-a.lng)*rad;
 const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function poiProfileForZoom(zoom){
 if(zoom<=13) return {radius:6000,limit:14,requeryKm:1.5,detail:0};
 if(zoom<=15) return {radius:3200,limit:28,requeryKm:.8,detail:1};
 if(zoom<=17) return {radius:1400,limit:48,requeryKm:.35,detail:2};
 return {radius:650,limit:72,requeryKm:.16,detail:3};
}
async function loadNearbyPlaces(force=false){
 const c=map.getCenter();
 const zoom=Math.round(map.getZoom());
 const profile=poiProfileForZoom(zoom);
 if(
   !force&&
   lastPoiCenter&&
   lastPoiZoom===zoom&&
   distanceKm(lastPoiCenter,c)<profile.requeryKm
 ) return;

 lastPoiCenter={lat:c.lat,lng:c.lng};
 lastPoiZoom=zoom;

 if(poiAbort) poiAbort.abort();
 poiAbort=new AbortController();

 const radius=profile.radius;
 let query='[out:json][timeout:10];('+
   'nwr(around:'+radius+','+c.lat+','+c.lng+')["amenity"~"hospital|clinic|doctors|pharmacy|police|fire_station|school|college|university|bank|atm|fuel|marketplace"]["name"];';

 if(profile.detail>=1){
   query+='nwr(around:'+radius+','+c.lat+','+c.lng+')["amenity"~"restaurant|cafe|fast_food"]["name"];';
   query+='nwr(around:'+radius+','+c.lat+','+c.lng+')["tourism"~"hotel|attraction"]["name"];';
 }
 if(profile.detail>=2){
   query+='nwr(around:'+radius+','+c.lat+','+c.lng+')["shop"]["name"];';
 }
 if(profile.detail>=3){
   query+='nwr(around:'+radius+','+c.lat+','+c.lng+')["office"]["name"];';
 }

 query+=');out center '+profile.limit+';';

 const endpoints=[
   'https://overpass-api.de/api/interpreter',
   'https://overpass.kumi.systems/api/interpreter'
 ];

 setLiveStatus('Zoom '+zoom+' • loading nearby places…');

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
     nearbyPlaces.clearLayers();
     let count=0;
     for(const element of (data.elements||[])){
       if(addNearbyPlace(element)) count+=1;
       if(count>=profile.limit) break;
     }
     setLiveStatus('Zoom '+zoom+' • '+count+' places • zoom in for more');
     return;
   }catch(error){
     if(error&&error.name==='AbortError') return;
   }
 }
 setLiveStatus('Road map • BUKLOD places online');
}

map.on('moveend',()=>{
 if(poiTimer) clearTimeout(poiTimer);
 poiTimer=setTimeout(()=>{void loadNearbyPlaces(false);},320);
});
setTimeout(()=>{
 map.invalidateSize();
 void loadNearbyPlaces(true);
},160);
}
if(window.L){
 buklodBootLiveMap();
}else{
 var buklodLeafletCss=document.createElement('link');
 buklodLeafletCss.rel='stylesheet';
 buklodLeafletCss.href=${safeJson(BUKLOD_MAP_LEAFLET_CSS_CDN)};
 document.head.appendChild(buklodLeafletCss);
 var buklodLeafletFallback=document.createElement('script');
 buklodLeafletFallback.src=${safeJson(BUKLOD_MAP_LEAFLET_JS_CDN)};
 buklodLeafletFallback.onload=function(){
  if(window.L) buklodBootLiveMap();
  else buklodShowMapEngineError();
 };
 buklodLeafletFallback.onerror=function(){ buklodShowMapEngineError(); };
 document.head.appendChild(buklodLeafletFallback);
}
</script>
</body>
</html>`;
}
