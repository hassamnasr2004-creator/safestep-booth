import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Crosshair } from 'lucide-react';
import { LatLngTuple, LiveBandState } from '../types/safestep';
import {
  DEFAULT_ORIGIN,
  computeGateCoords,
  deriveZoneLabel,
  getEditionById,
  isValidLatLng,
  offsetLatLng,
} from '../data/safestepData';

interface LiveLeafletMapProps {
  band: LiveBandState;
  heightClass?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSafeCoords(band: LiveBandState): {
  parentCoords: LatLngTuple;
  childCoords: LatLngTuple;
  gateCoords: LatLngTuple;
  pathHistory: LatLngTuple[];
} {
  const parentCoords = isValidLatLng(band.parentCoords)
    ? band.parentCoords
    : DEFAULT_ORIGIN;
  const childCoords = isValidLatLng(band.childCoords)
    ? band.childCoords
    : offsetLatLng(parentCoords, 1.5, 1.2);
  const gateCoords = isValidLatLng(band.gateCoords)
    ? band.gateCoords
    : computeGateCoords(parentCoords);
  const validHistory = Array.isArray(band.pathHistory)
    ? band.pathHistory.filter((pt): pt is LatLngTuple => isValidLatLng(pt))
    : [];
  const pathHistory =
    validHistory.length >= 2 ? validHistory : [parentCoords, childCoords];

  return { parentCoords, childCoords, gateCoords, pathHistory };
}

export function LiveLeafletMap({
  band,
  heightClass = 'h-[360px] sm:h-[420px]',
}: LiveLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const layersRef = useRef<{
    safeCircle: L.Circle;
    gateCircle: L.Circle;
    gateMarker: L.Marker;
    trailLine: L.Polyline;
    stepDots: L.LayerGroup;
    tetherLine: L.Polyline;
    midpointMarker: L.Marker;
    parentMarker: L.Marker;
    childMarker: L.Marker;
  } | null>(null);

  const hasAutoFittedRef = useRef(false);

  // Initialize Leaflet Map once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const { parentCoords, childCoords, gateCoords, pathHistory } =
      getSafeCoords(band);

    const map = L.map(el, {
      center: parentCoords,
      zoom: 20,
      maxZoom: 22,
      minZoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxNativeZoom: 19,
        maxZoom: 22,
      }
    ).addTo(map);

    const safeCircle = L.circle(parentCoords, {
      radius: band.safeLimitM || 15,
      color: '#10B981',
      weight: 2,
      dashArray: '6 6',
      fillColor: '#10B981',
      fillOpacity: 0.09,
    }).addTo(map);

    const gateCircle = L.circle(gateCoords, {
      radius: 3.5,
      color: '#EF4444',
      weight: 2,
      dashArray: '5 5',
      fillColor: '#EF4444',
      fillOpacity: 0.14,
    }).addTo(map);

    const gateMarker = L.marker(gateCoords, {
      interactive: false,
      icon: L.divIcon({
        className: '',
        iconSize: [96, 28],
        iconAnchor: [48, 14],
        html: `<div style="display:flex;align-items:center;justify-content:center;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,0.86);backdrop-filter:blur(10px);border:1.5px solid rgba(239,68,68,0.55);color:#DC2626;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(239,68,68,0.16);">بوابة الخروج</div>`,
      }),
    }).addTo(map);

    const trailLine = L.polyline(pathHistory, {
      color: '#0EA5E9',
      weight: 4,
      opacity: 0.72,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    const stepDots = L.layerGroup().addTo(map);

    const tetherLine = L.polyline([parentCoords, childCoords], {
      color: '#10B981',
      weight: 3.5,
      dashArray: '8 8',
      opacity: 0.95,
      className: 'tether-animated-line',
    }).addTo(map);

    const mid: [number, number] = [
      (parentCoords[0] + childCoords[0]) / 2,
      (parentCoords[1] + childCoords[1]) / 2,
    ];

    const midpointMarker = L.marker(mid, {
      interactive: false,
      zIndexOffset: 400,
      icon: L.divIcon({
        className: 'smooth-glide-marker',
        iconSize: [140, 30],
        iconAnchor: [70, 15],
        html: '',
      }),
    }).addTo(map);

    const parentMarker = L.marker(parentCoords, {
      interactive: false,
      zIndexOffset: 500,
      icon: L.divIcon({
        className: 'smooth-glide-marker',
        iconSize: [86, 56],
        iconAnchor: [43, 28],
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
              <span class="beacon-ring" style="position:absolute;inset:0;border-radius:999px;background:rgba(14,165,233,0.4);"></span>
              <span style="position:relative;width:16px;height:16px;border-radius:999px;background:#0284C7;border:3px solid #FFFFFF;box-shadow:0 3px 10px rgba(2,132,199,0.45);"></span>
            </div>
            <span style="margin-top:4px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.88);backdrop-filter:blur(10px);border:1px solid rgba(14,165,233,0.35);color:#0F172A;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 4px 10px rgba(15,23,42,0.08);">ولي الأمر</span>
          </div>
        `,
      }),
    }).addTo(map);

    const childMarker = L.marker(childCoords, {
      interactive: false,
      zIndexOffset: 700,
      icon: L.divIcon({
        className: 'smooth-glide-marker',
        iconSize: [128, 66],
        iconAnchor: [64, 33],
        html: '',
      }),
    }).addTo(map);

    mapRef.current = map;
    layersRef.current = {
      safeCircle,
      gateCircle,
      gateMarker,
      trailLine,
      stepDots,
      tetherLine,
      midpointMarker,
      parentMarker,
      childMarker,
    };

    // Fit cleanly on initial load
    const initBounds = L.latLngBounds([parentCoords, childCoords, gateCoords]);
    map.fitBounds(initBounds.pad(0.45), { maxZoom: 20, animate: false });
    hasAutoFittedRef.current = true;

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive Layer Updates on every step / GPS / alert / reset change
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    const { parentCoords, childCoords, gateCoords, pathHistory } =
      getSafeCoords(band);
    const safeLimitM = band.safeLimitM || 15;
    const edition = getEditionById(band.editionId);
    const zoneInfo = deriveZoneLabel(
      childCoords,
      parentCoords,
      gateCoords,
      safeLimitM
    );
    const dist = zoneInfo.distParent;

    const isCritical =
      band.activeAlert?.type === 'TAMPER_ATTEMPT' ||
      band.activeAlert?.type === 'GATE_PROXIMITY' ||
      zoneInfo.nearGate ||
      dist > safeLimitM;
    const isWarn = !isCritical && dist > safeLimitM * 0.7;

    const tetherColor = isCritical
      ? '#EF4444'
      : isWarn
      ? '#F59E0B'
      : '#10B981';

    const pillBorder = isCritical
      ? 'rgba(239,68,68,0.65)'
      : isWarn
      ? 'rgba(245,158,11,0.6)'
      : 'rgba(16,185,129,0.5)';
    const pillText = isCritical
      ? '#DC2626'
      : isWarn
      ? '#D97706'
      : '#059669';
    const pillStatus = isCritical
      ? zoneInfo.nearGate
        ? 'بوابة الخروج'
        : 'خارج النطاق'
      : isWarn
      ? 'قرب الحد'
      : 'متصل';

    // 1. Safe Radius Ring around Parent
    layers.safeCircle.setLatLng(parentCoords);
    layers.safeCircle.setRadius(safeLimitM);
    layers.safeCircle.setStyle({
      color: isCritical ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981',
      fillColor: isCritical ? '#EF4444' : '#10B981',
      fillOpacity: isCritical ? 0.08 : 0.09,
    });

    // 2. Virtual Exit Gate Geofence
    layers.gateCircle.setLatLng(gateCoords);
    layers.gateCircle.setStyle({
      fillOpacity: zoneInfo.nearGate ? 0.34 : 0.14,
      weight: zoneInfo.nearGate ? 3 : 2,
    });
    layers.gateMarker.setLatLng(gateCoords);

    // 3. Breadcrumb Path + Step Dots
    layers.trailLine.setLatLngs(pathHistory);
    layers.stepDots.clearLayers();
    pathHistory.slice(0, -1).forEach((pt, idx) => {
      if (idx === 0) return;
      L.circleMarker(pt, {
        radius: 3,
        color: '#FFFFFF',
        weight: 1.5,
        fillColor: '#0EA5E9',
        fillOpacity: 0.85,
      }).addTo(layers.stepDots);
    });

    // 4. Animated Live Connection Tether + Midpoint Distance Pill
    layers.tetherLine.setLatLngs([parentCoords, childCoords]);
    layers.tetherLine.setStyle({
      color: tetherColor,
      weight: isCritical ? 4 : 3.5,
    });

    const mid: [number, number] = [
      (parentCoords[0] + childCoords[0]) / 2,
      (parentCoords[1] + childCoords[1]) / 2,
    ];
    layers.midpointMarker.setLatLng(mid);
    layers.midpointMarker.setIcon(
      L.divIcon({
        className: 'smooth-glide-marker',
        iconSize: [148, 30],
        iconAnchor: [74, 15],
        html: `<div style="display:flex;align-items:center;justify-content:center;gap:5px;padding:4px 11px;border-radius:999px;background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);border:1.5px solid ${pillBorder};color:${pillText};font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 6px 18px rgba(15,23,42,0.12);font-variant-numeric:tabular-nums;">
          <span style="width:7px;height:7px;border-radius:999px;background:${tetherColor};"></span>
          <span>${dist.toFixed(1)} متر • ${pillStatus}</span>
        </div>`,
      })
    );

    // 5. Parent Marker
    layers.parentMarker.setLatLng(parentCoords);

    // 6. Child Avatar Glass Marker
    const safeName = escapeHtml(band.childName);
    layers.childMarker.setLatLng(childCoords);
    layers.childMarker.setIcon(
      L.divIcon({
        className: 'smooth-glide-marker',
        iconSize: [140, 68],
        iconAnchor: [70, 34],
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
              ${
                isCritical || isWarn
                  ? `<span class="beacon-ring" style="position:absolute;inset:-4px;border-radius:999px;background:${tetherColor};opacity:0.45;"></span>`
                  : ''
              }
              <div style="position:relative;width:34px;height:34px;border-radius:12px;overflow:hidden;border:2.5px solid ${tetherColor};background:#FFFFFF;box-shadow:0 6px 16px rgba(15,23,42,0.18);">
                <img src="${edition.imageUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
              </div>
            </div>
            <span style="margin-top:4px;padding:2px 9px;border-radius:999px;background:rgba(15,23,42,0.88);backdrop-filter:blur(10px);color:#FFFFFF;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(15,23,42,0.2);">الطفل - ${safeName}</span>
          </div>
        `,
      })
    );

    // Keep child smoothly inside viewport if they walk near edges
    if (!map.getBounds().pad(-0.15).contains(childCoords)) {
      const nextBounds = L.latLngBounds([parentCoords, childCoords]);
      map.fitBounds(nextBounds.pad(0.35), { maxZoom: 20, animate: true });
    }
  }, [band]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    const { parentCoords, childCoords, gateCoords } = getSafeCoords(band);
    const bounds = L.latLngBounds([parentCoords, childCoords, gateCoords]);
    map.fitBounds(bounds.pad(0.4), { maxZoom: 20, animate: true });
  };

  return (
    <div className="relative glass-card rounded-2xl p-2 overflow-hidden">
      <div
        ref={containerRef}
        className={`w-full ${heightClass} rounded-xl overflow-hidden`}
      />

      {/* Floating Frosted Recenter Control */}
      <button
        type="button"
        onClick={handleRecenter}
        aria-label="توسيط الخريطة"
        className="absolute top-4 left-4 z-[400] px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white backdrop-blur-md border border-white/90 shadow-md text-xs font-bold text-[#0F172A] inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
      >
        <Crosshair className="w-3.5 h-3.5 text-[#0284C7]" strokeWidth={2} />
        <span>توسيط</span>
      </button>
    </div>
  );
}
