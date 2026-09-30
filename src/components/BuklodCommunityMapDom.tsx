'use dom';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Coordinate = {
  latitude: number;
  longitude: number;
};

type MapPoint = Coordinate & {
  id: string;
  kind?: string | null;
  title: string;
  subtitle?: string | null;
  category?: string | null;
  verified?: boolean;
  isMe?: boolean;
};

type HomePoint = Coordinate & {
  localityLabel?: string | null;
};

type LocationResult =
  | (Coordinate & { ok: true })
  | { ok: false; message: string };

type Destination = Coordinate & {
  title: string;
  subtitle?: string | null;
  kind?: string | null;
  category?: string | null;
};

type RouteSummary = {
  distance: string;
  duration: string;
};

type Props = {
  points: MapPoint[];
  center: Coordinate;
  home?: HomePoint | null;
  interactive: boolean;
  requestLocation: () => Promise<LocationResult>;
  openNavigation: (destination: Destination) => Promise<boolean>;
  openHome: () => Promise<boolean>;
  dom?: import('expo/dom').DOMProps;
};

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

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_PRIMARY = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_JS_FALLBACK = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';

function formatDistance(meters: number) {
  const km = Number(meters || 0) / 1000;
  return km < 1
    ? `${Math.max(1, Math.round(Number(meters || 0)))} m`
    : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(Number(seconds || 0) / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} hr${rest ? ` ${rest} min` : ''}`;
}

function finitePoint(value: any): value is Coordinate {
  return (
    value &&
    Number.isFinite(Number(value.latitude)) &&
    Number.isFinite(Number(value.longitude))
  );
}

function isNavigable(point: MapPoint | Destination) {
  return (
    String(point.kind || '').toUpperCase() !== 'PERSON' &&
    String(point.category || '').toLowerCase() !== 'people'
  );
}

function injectCustomCss() {
  if (document.getElementById('buklod-map-dom-r3-style')) return;

  const style = document.createElement('style');
  style.id = 'buklod-map-dom-r3-style';
  style.textContent = `
    html,body,#root{height:100%;margin:0;padding:0;background:#eef2f4}
    *{box-sizing:border-box}
    .leaflet-control-attribution{font-size:8px!important}
    .buklod-map-pin{
      width:30px;height:30px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);border:3px solid #fff;
      box-shadow:0 3px 10px rgba(0,0,0,.34);
      display:flex;align-items:center;justify-content:center
    }
    .buklod-map-pin span{
      transform:rotate(45deg);color:#fff;font-size:12px;font-weight:900
    }
    .buklod-user-dot{
      width:18px;height:18px;border-radius:50%;background:#1677ff;
      border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.34)
    }
    .buklod-home{
      width:44px;height:44px;border-radius:14px;background:#fff;
      border:3px solid #177552;display:flex;align-items:center;
      justify-content:center;font-size:24px;box-shadow:0 3px 12px rgba(0,0,0,.3)
    }
    .buklod-poi{
      width:22px;height:22px;border-radius:50%;background:#fff;
      border:2px solid #1f6d5b;color:#205b4d;font:900 10px/18px system-ui;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 7px rgba(0,0,0,.28)
    }
    .buklod-route-line{stroke-linecap:round;stroke-linejoin:round}
  `;
  document.head.appendChild(style);
}

function ensureLeafletCss() {
  if (document.querySelector('link[data-buklod-leaflet]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS;
  link.setAttribute('data-buklod-leaflet', '1');
  document.head.appendChild(link);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-buklod-leaflet-src="${src}"]`,
    ) as HTMLScriptElement | null;

    if (existing) {
      if ((window as any).L) resolve();
      else existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute('data-buklod-leaflet-src', src);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureLeaflet() {
  if ((window as any).L) return (window as any).L;

  ensureLeafletCss();
  injectCustomCss();

  try {
    await loadScript(LEAFLET_JS_PRIMARY);
  } catch {
    await loadScript(LEAFLET_JS_FALLBACK);
  }

  if (!(window as any).L) {
    throw new Error('Leaflet engine unavailable');
  }

  return (window as any).L;
}

function poiMeta(tags: Record<string, any>) {
  const amenity = String(tags.amenity || '').toLowerCase();
  const shop = String(tags.shop || '').toLowerCase();
  const office = String(tags.office || '').toLowerCase();
  const tourism = String(tags.tourism || '').toLowerCase();

  if (['hospital', 'clinic', 'doctors'].includes(amenity)) {
    return { type: 'medical', icon: 'H' };
  }
  if (amenity === 'pharmacy') return { type: 'pharmacy', icon: '+' };
  if (['school', 'college', 'university'].includes(amenity)) {
    return { type: 'school', icon: 'S' };
  }
  if (amenity === 'police') return { type: 'police', icon: 'P' };
  if (amenity === 'fire_station') return { type: 'fire station', icon: 'F' };
  if (amenity === 'marketplace') return { type: 'market', icon: 'M' };
  if (['restaurant', 'cafe', 'fast_food'].includes(amenity)) {
    return { type: 'food', icon: 'R' };
  }
  if (['bank', 'atm'].includes(amenity)) return { type: 'bank', icon: 'B' };
  if (amenity === 'fuel') return { type: 'fuel', icon: 'G' };
  if (tourism === 'hotel') return { type: 'hotel', icon: 'H' };
  if (tourism === 'attraction') return { type: 'attraction', icon: 'A' };
  if (shop) return { type: shop.replaceAll('_', ' '), icon: '•' };
  if (office) return { type: office.replaceAll('_', ' '), icon: '•' };
  return { type: 'place', icon: '•' };
}

function elementCoordinates(element: any) {
  const latitude = Number(element?.lat ?? element?.center?.lat);
  const longitude = Number(element?.lon ?? element?.center?.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

export default function BuklodCommunityMapDom({
  points,
  center,
  home = null,
  interactive,
  requestLocation,
  openNavigation,
  openHome,
}: Props) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const baseLayersRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const poiLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const selectedMarkerRef = useRef<any>(null);
  const poiAbortRef = useRef<AbortController | null>(null);
  const poiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [engineReady, setEngineReady] = useState(false);
  const [layerMode, setLayerMode] = useState<'road' | 'satellite'>('road');
  const [status, setStatus] = useState(
    interactive ? 'Road map • loading places…' : 'BUKLOD map',
  );
  const [destination, setDestination] = useState<Destination | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [query, setQuery] = useState('');
  const [searchRows, setSearchRows] = useState<Destination[]>([]);
  const [searching, setSearching] = useState(false);

  const cleanPoints = useMemo(
    () => (Array.isArray(points) ? points.filter(finitePoint) : []),
    [points],
  );

  useEffect(() => {
    let cancelled = false;
    let moveHandler: (() => void) | null = null;

    const boot = async () => {
      if (!mapNodeRef.current) return;

      setEngineReady(false);

      try {
        const L = await ensureLeaflet();
        if (cancelled || !mapNodeRef.current) return;

        if (mapRef.current) {
          try {
            mapRef.current.remove();
          } catch {}
          mapRef.current = null;
        }

        const map = L.map(mapNodeRef.current, {
          zoomControl: interactive,
          attributionControl: true,
          dragging: interactive,
          touchZoom: interactive,
          doubleClickZoom: interactive,
          scrollWheelZoom: interactive,
          boxZoom: interactive,
          keyboard: interactive,
          tap: interactive,
          preferCanvas: true,
          maxZoom: 19,
        }).setView(
          [Number(center.latitude), Number(center.longitude)],
          interactive ? 14 : 13,
        );

        mapRef.current = map;

        const road = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            maxNativeZoom: 19,
            keepBuffer: 4,
            attribution: 'Tiles © Esri and contributors',
          },
        );

        const roadFallback = L.tileLayer(
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            maxZoom: 19,
            maxNativeZoom: 19,
            keepBuffer: 4,
            attribution: '© OpenStreetMap contributors',
          },
        );

        const satellite = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            maxNativeZoom: 19,
            keepBuffer: 4,
            attribution:
              'Tiles © Esri, Maxar, Earthstar Geographics, GIS User Community',
          },
        );

        const labels = L.tileLayer(
          'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            maxNativeZoom: 19,
            keepBuffer: 4,
            attribution: 'Reference © Esri',
          },
        );

        road.addTo(map);

        let roadLoaded = false;
        road.once('tileload', () => {
          roadLoaded = true;
          if (!cancelled && interactive) {
            setStatus('Road map • zoom in for nearby places');
          }
        });

        road.on('tileerror', () => {
          if (roadLoaded) return;
          try {
            map.removeLayer(road);
          } catch {}
          if (!map.hasLayer(roadFallback)) {
            roadFallback.addTo(map);
          }
          if (!cancelled && interactive) {
            setStatus('Road map • OSM fallback');
          }
        });

        baseLayersRef.current = {
          road,
          roadFallback,
          satellite,
          labels,
        };

        routeLayerRef.current = L.layerGroup().addTo(map);
        poiLayerRef.current = L.layerGroup().addTo(map);

        const bounds: [number, number][] = [];

        cleanPoints.forEach(point => {
          const category = String(point.category || 'community').toLowerCase();
          const color = CATEGORY_COLORS[category] || '#35679D';
          const initial = point.isMe
            ? 'M'
            : String(category || 'C').charAt(0).toUpperCase();

          const icon = L.divIcon({
            className: '',
            html:
              `<div class="buklod-map-pin" style="background:${color}">` +
              `<span>${initial}</span></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -28],
          });

          const marker = L.marker(
            [point.latitude, point.longitude],
            { icon, title: point.title },
          ).addTo(map);

          marker.bindPopup(
            `<div style="font:800 13px/17px system-ui;color:#183047">${String(
              point.title || 'BUKLOD place',
            )}</div>` +
              `<div style="margin-top:3px;font:600 10px/14px system-ui;color:#60768a">${String(
                point.subtitle || '',
              )}</div>`,
          );

          if (interactive) {
            marker.on('click', () => {
              if (!isNavigable(point)) {
                setDestination(null);
                setStatus('Privacy-protected presence • not a destination');
                return;
              }

              setDestination({
                latitude: point.latitude,
                longitude: point.longitude,
                title: point.title || 'BUKLOD place',
                subtitle: point.subtitle || '',
                kind: point.kind,
                category: point.category,
              });
              setRouteSummary(null);
              setStatus(`Destination selected • ${point.title || 'BUKLOD place'}`);
            });
          }

          bounds.push([point.latitude, point.longitude]);
        });

        if (home && finitePoint(home)) {
          const homeIcon = L.divIcon({
            className: '',
            html: '<div class="buklod-home">⌂</div>',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });

          const homeMarker = L.marker(
            [home.latitude, home.longitude],
            { icon: homeIcon, zIndexOffset: 1000, title: 'My BUKLOD Home' },
          ).addTo(map);

          homeMarker.bindTooltip(
            home.localityLabel
              ? `My BUKLOD Home • ${home.localityLabel}`
              : 'My BUKLOD Home',
            { direction: 'top' },
          );

          if (interactive) {
            homeMarker.on('click', () => {
              void openHome();
            });
          }

          bounds.push([home.latitude, home.longitude]);
        }

        if (bounds.length > 1) {
          map.fitBounds(bounds, {
            padding: [34, 34],
            maxZoom: interactive ? 15 : 14,
          });
        } else if (bounds.length === 1) {
          map.setView(bounds[0], interactive ? 15 : 14);
        }

        const addNearbyPlace = (element: any) => {
          const tags = element?.tags || {};
          const name = String(tags.name || '').trim();
          if (!name) return false;

          const coords = elementCoordinates(element);
          if (!coords) return false;

          const meta = poiMeta(tags);
          const icon = L.divIcon({
            className: '',
            html: `<div class="buklod-poi">${meta.icon}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
            popupAnchor: [0, -11],
          });

          const marker = L.marker(
            [coords.latitude, coords.longitude],
            { icon, title: name },
          ).addTo(poiLayerRef.current);

          marker.bindPopup(
            `<div style="font:800 12px/16px system-ui;color:#183047">${name}</div>` +
              `<div style="margin-top:4px;font:700 9px/12px system-ui;color:#177552">${meta.type}</div>`,
          );

          marker.on('click', () => {
            const next: Destination = {
              latitude: coords.latitude,
              longitude: coords.longitude,
              title: name,
              subtitle: meta.type,
              kind: 'POI',
              category: meta.type,
            };
            setDestination(next);
            setRouteSummary(null);
            setStatus(`Destination selected • ${name}`);
          });

          return true;
        };

        const loadNearbyPlaces = async (force = false) => {
          if (!interactive || cancelled || !mapRef.current) return;

          const zoom = Math.round(map.getZoom());
          if (zoom < 13 && !force) {
            setStatus('Road map • zoom in for nearby places');
            return;
          }

          poiAbortRef.current?.abort();
          const controller = new AbortController();
          poiAbortRef.current = controller;

          const c = map.getCenter();
          const radius = zoom >= 17 ? 1800 : zoom >= 15 ? 3200 : 4500;
          const limit = zoom >= 17 ? 120 : zoom >= 15 ? 90 : 65;

          const queryText =
            '[out:json][timeout:10];(' +
            `nwr(around:${radius},${c.lat},${c.lng})["amenity"~"hospital|clinic|doctors|pharmacy|police|fire_station|school|college|university|bank|atm|fuel|marketplace|restaurant|cafe|fast_food"]["name"];` +
            `nwr(around:${radius},${c.lat},${c.lng})["tourism"~"hotel|attraction"]["name"];` +
            `nwr(around:${radius},${c.lat},${c.lng})["shop"]["name"];` +
            ');out center ' +
            limit +
            ';';

          const endpoints = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
          ];

          setStatus(`Zoom ${zoom} • loading nearby places…`);

          for (const endpoint of endpoints) {
            try {
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/x-www-form-urlencoded;charset=UTF-8',
                  Accept: 'application/json',
                },
                body: `data=${encodeURIComponent(queryText)}`,
                signal: controller.signal,
              });

              if (!response.ok) continue;

              const data = await response.json();
              if (cancelled || controller.signal.aborted) return;

              poiLayerRef.current?.clearLayers();

              let count = 0;
              for (const element of data?.elements || []) {
                if (addNearbyPlace(element)) count += 1;
                if (count >= limit) break;
              }

              setStatus(`Zoom ${zoom} • ${count} nearby places`);
              return;
            } catch (error: any) {
              if (error?.name === 'AbortError') return;
            }
          }

          if (!cancelled) {
            setStatus('Road map • BUKLOD places online');
          }
        };

        if (interactive) {
          moveHandler = () => {
            if (poiTimerRef.current) {
              clearTimeout(poiTimerRef.current);
            }

            poiTimerRef.current = setTimeout(() => {
              void loadNearbyPlaces(false);
            }, 450);
          };

          map.on('moveend', moveHandler);
          void loadNearbyPlaces(true);
        }

        setTimeout(() => {
          if (!cancelled) {
            try {
              map.invalidateSize();
            } catch {}
          }
        }, 120);

        if (!cancelled) {
          setEngineReady(true);
        }
      } catch {
        if (!cancelled) {
          setStatus('BUKLOD map engine could not load • check connection');
          setEngineReady(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;

      poiAbortRef.current?.abort();

      if (poiTimerRef.current) {
        clearTimeout(poiTimerRef.current);
      }

      const map = mapRef.current;
      if (map && moveHandler) {
        try {
          map.off('moveend', moveHandler);
        } catch {}
      }

      if (map) {
        try {
          map.remove();
        } catch {}
      }

      mapRef.current = null;
      baseLayersRef.current = null;
      routeLayerRef.current = null;
      poiLayerRef.current = null;
      userMarkerRef.current = null;
      selectedMarkerRef.current = null;
    };
  }, [
    center.latitude,
    center.longitude,
    cleanPoints,
    home?.latitude,
    home?.longitude,
    home?.localityLabel,
    interactive,
    openHome,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = baseLayersRef.current;

    if (!map || !layers) return;

    try {
      for (const layer of [
        layers.road,
        layers.roadFallback,
        layers.satellite,
        layers.labels,
      ]) {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      }

      if (layerMode === 'satellite') {
        layers.satellite.addTo(map);
        layers.labels.addTo(map);
        setStatus('Satellite • BUKLOD map');
      } else {
        layers.road.addTo(map);
        setStatus('Road map • BUKLOD map');
      }

      if (poiLayerRef.current) {
        poiLayerRef.current.bringToFront?.();
      }
      if (routeLayerRef.current) {
        routeLayerRef.current.bringToFront?.();
      }
    } catch {}
  }, [layerMode, engineReady]);

  const clearRoute = () => {
    try {
      routeLayerRef.current?.clearLayers();
    } catch {}

    if (userMarkerRef.current && mapRef.current) {
      try {
        mapRef.current.removeLayer(userMarkerRef.current);
      } catch {}
      userMarkerRef.current = null;
    }

    setRouteSummary(null);
    setStatus(
      destination
        ? `Destination selected • ${destination.title}`
        : 'Road map • BUKLOD map',
    );
  };

  const locateMe = async () => {
    const result = await requestLocation();

    if (!result.ok) {
      setStatus(result.message || 'Location permission is needed');
      return null;
    }

    const map = mapRef.current;
    const L = (window as any).L;

    if (!map || !L) return result;

    if (userMarkerRef.current) {
      try {
        map.removeLayer(userMarkerRef.current);
      } catch {}
    }

    const icon = L.divIcon({
      className: '',
      html: '<div class="buklod-user-dot"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    userMarkerRef.current = L.marker(
      [result.latitude, result.longitude],
      { icon, title: 'Your location' },
    ).addTo(map);

    map.setView([result.latitude, result.longitude], 17);
    setStatus('Your location • search or tap a place pin');

    return result;
  };

  const startRoute = async () => {
    if (!destination || !isNavigable(destination)) return;

    setStatus('Getting your current location…');
    const origin = await locateMe();
    if (!origin?.ok) return;

    const map = mapRef.current;
    const L = (window as any).L;

    if (!map || !L) return;

    setStatus('Building route…');

    try {
      const url =
        'https://router.project-osrm.org/route/v1/driving/' +
        encodeURIComponent(
          `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`,
        ) +
        '?overview=full&geometries=geojson&steps=true&alternatives=false';

      const response = await fetch(url);
      if (!response.ok) throw new Error('route unavailable');

      const data = await response.json();
      const route = Array.isArray(data?.routes) ? data.routes[0] : null;

      if (!route?.geometry) throw new Error('no route');

      routeLayerRef.current?.clearLayers();
      const line = L.geoJSON(route.geometry, {
        style: {
          color: '#177552',
          weight: 7,
          opacity: 0.92,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'buklod-route-line',
        },
      }).addTo(routeLayerRef.current);

      const bounds = line.getBounds();
      if (bounds?.isValid?.()) {
        map.fitBounds(bounds, {
          padding: [42, 42],
          maxZoom: 17,
        });
      }

      const summary = {
        distance: formatDistance(Number(route.distance || 0)),
        duration: formatDuration(Number(route.duration || 0)),
      };

      setRouteSummary(summary);
      setStatus(
        `Route ready • ${summary.distance} • ${summary.duration}`,
      );
    } catch {
      setRouteSummary(null);
      setStatus(
        'Could not build in-app route • use Voice guidance',
      );
    }
  };

  const searchDestination = async () => {
    const q = query.trim();

    if (q.length < 2) {
      setSearchRows([]);
      setStatus('Type at least 2 letters to search');
      return;
    }

    setSearching(true);
    setStatus('Searching destination…');

    try {
      const url =
        'https://nominatim.openstreetmap.org/search?format=jsonv2' +
        '&limit=6&addressdetails=1&q=' +
        encodeURIComponent(q);

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) throw new Error('search unavailable');

      const data = await response.json();

      const rows: Destination[] = (Array.isArray(data) ? data : [])
        .map((item: any) => {
          const display = String(item?.display_name || '').trim();
          const title =
            String(item?.name || '').trim() ||
            display.split(',')[0] ||
            'Destination';

          return {
            latitude: Number(item?.lat),
            longitude: Number(item?.lon),
            title,
            subtitle: display,
            kind: 'SEARCH',
            category: 'search',
          };
        })
        .filter(finitePoint);

      setSearchRows(rows);
      setStatus(
        rows.length
          ? `${rows.length} destination result${rows.length === 1 ? '' : 's'}`
          : 'No matching destination found',
      );
    } catch {
      setSearchRows([]);
      setStatus('Destination search is temporarily unavailable');
    } finally {
      setSearching(false);
    }
  };

  const chooseSearchDestination = (item: Destination) => {
    setDestination(item);
    setSearchRows([]);
    setQuery(item.title);
    setRouteSummary(null);
    setStatus(`Destination selected • ${item.title}`);

    const map = mapRef.current;
    const L = (window as any).L;

    if (!map || !L) return;

    if (selectedMarkerRef.current) {
      try {
        map.removeLayer(selectedMarkerRef.current);
      } catch {}
    }

    selectedMarkerRef.current = L.marker(
      [item.latitude, item.longitude],
      { title: item.title },
    ).addTo(map);

    map.setView([item.latitude, item.longitude], 16);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#eef2f4',
        fontFamily:
          'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      }}
    >
      <div
        ref={mapNodeRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: '#eef2f4',
        }}
      />

      {!engineReady ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            textAlign: 'center',
            color: '#49616f',
            background: '#eef2f4',
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {status}
        </div>
      ) : null}

      {interactive && engineReady ? (
        <>
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              right: 58,
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              pointerEvents: 'none',
            }}
          >
            <button
              type="button"
              onClick={() => void (destination ? startRoute() : locateMe())}
              style={{
                pointerEvents: 'auto',
                alignSelf: 'flex-start',
                maxWidth: '100%',
                border: '1px solid #cfe0d7',
                borderRadius: 14,
                padding: '9px 11px',
                background: 'rgba(255,255,255,.97)',
                boxShadow: '0 7px 22px rgba(0,0,0,.22)',
                color: '#177552',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              🧭{' '}
              {destination
                ? `START • ${destination.title}`
                : 'BUKLOD Navigation • locate me'}
            </button>

            <div
              style={{
                pointerEvents: 'auto',
                width: 'min(340px, 100%)',
                border: '1px solid #cfe0d7',
                borderRadius: 14,
                padding: 8,
                background: 'rgba(255,255,255,.97)',
                boxShadow: '0 7px 22px rgba(0,0,0,.20)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      void searchDestination();
                    }
                  }}
                  placeholder="Search destination…"
                  style={{
                    minWidth: 0,
                    flex: 1,
                    border: '1px solid #c6d8cf',
                    borderRadius: 10,
                    padding: '8px 9px',
                    background: '#fff',
                    color: '#183047',
                    fontSize: 10,
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => void searchDestination()}
                  disabled={searching}
                  style={{
                    border: 0,
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: '#177552',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 900,
                  }}
                >
                  {searching ? '...' : 'SEARCH'}
                </button>
              </div>

              {searchRows.length ? (
                <div
                  style={{
                    marginTop: 7,
                    maxHeight: 180,
                    overflowY: 'auto',
                    borderTop: '1px solid #e1ebe6',
                  }}
                >
                  {searchRows.map((item, index) => (
                    <button
                      key={`${item.latitude}-${item.longitude}-${index}`}
                      type="button"
                      onClick={() => chooseSearchDestination(item)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        border: 0,
                        borderBottom: '1px solid #edf2ef',
                        background: '#fff',
                        color: '#284655',
                        padding: '7px 5px',
                      }}
                    >
                      <strong
                        style={{
                          display: 'block',
                          fontSize: 10,
                          lineHeight: '13px',
                          color: '#1f4f3d',
                        }}
                      >
                        {item.title}
                      </strong>
                      <span
                        style={{
                          display: 'block',
                          marginTop: 2,
                          fontSize: 8,
                          lineHeight: '11px',
                          color: '#71828d',
                        }}
                      >
                        {item.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={() => setLayerMode('road')}
              style={{
                width: 42,
                minHeight: 34,
                borderRadius: 10,
                border: '1px solid #d5e1e5',
                background:
                  layerMode === 'road' ? '#177552' : 'rgba(255,255,255,.97)',
                color: layerMode === 'road' ? '#fff' : '#214A5D',
                fontSize: 8,
                fontWeight: 900,
              }}
            >
              ROAD
            </button>
            <button
              type="button"
              onClick={() => setLayerMode('satellite')}
              style={{
                width: 42,
                minHeight: 34,
                borderRadius: 10,
                border: '1px solid #d5e1e5',
                background:
                  layerMode === 'satellite'
                    ? '#177552'
                    : 'rgba(255,255,255,.97)',
                color: layerMode === 'satellite' ? '#fff' : '#214A5D',
                fontSize: 7,
                fontWeight: 900,
              }}
            >
              SAT
            </button>
          </div>

          <div
            style={{
              position: 'absolute',
              left: 10,
              bottom: destination ? 90 : 14,
              maxWidth: '70%',
              padding: '6px 9px',
              borderRadius: 11,
              background: 'rgba(10,25,36,.84)',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,.3)',
              fontSize: 9,
              lineHeight: '12px',
              fontWeight: 800,
            }}
          >
            {status}
          </div>

          {destination ? (
            <div
              style={{
                position: 'absolute',
                left: 10,
                right: 10,
                bottom: 10,
                minHeight: 68,
                padding: '10px 11px',
                borderRadius: 16,
                background: 'rgba(255,255,255,.98)',
                border: '1px solid #cfe0d7',
                boxShadow: '0 8px 24px rgba(0,0,0,.22)',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: '#177552',
                    fontSize: 9,
                    fontWeight: 900,
                  }}
                >
                  BUKLOD NAVIGATION
                </div>
                <div
                  style={{
                    marginTop: 2,
                    color: '#183047',
                    fontSize: 11,
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {destination.title}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    color: '#617987',
                    fontSize: 8,
                    fontWeight: 700,
                  }}
                >
                  {routeSummary
                    ? `${routeSummary.distance} • ${routeSummary.duration}`
                    : 'Tap START for in-app route'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void startRoute()}
                style={{
                  border: 0,
                  borderRadius: 11,
                  padding: '9px 10px',
                  background: '#177552',
                  color: '#fff',
                  fontSize: 8,
                  fontWeight: 900,
                }}
              >
                START
              </button>

              <button
                type="button"
                onClick={() => void openNavigation(destination)}
                style={{
                  border: '1px solid #bcd3c8',
                  borderRadius: 11,
                  padding: '9px 10px',
                  background: '#edf6f2',
                  color: '#246653',
                  fontSize: 8,
                  fontWeight: 900,
                }}
              >
                VOICE
              </button>

              {routeSummary ? (
                <button
                  type="button"
                  onClick={clearRoute}
                  style={{
                    border: '1px solid #d6e2e8',
                    borderRadius: 11,
                    padding: '9px 9px',
                    background: '#fff',
                    color: '#617987',
                    fontSize: 8,
                    fontWeight: 900,
                  }}
                >
                  CLEAR
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
