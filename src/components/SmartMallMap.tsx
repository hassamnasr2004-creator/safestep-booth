import React, { useRef, useState } from 'react';
import { Eraser, MapPin } from 'lucide-react';
import { LiveBandState, MallPoint } from '../types/safestep';
import {
  MALL_GATES,
  MALL_HEIGHT_M,
  MALL_WIDTH_M,
  MALL_ZONES,
  clampMallPoint,
  evaluateMallPosition,
  getEditionById,
} from '../data/safestepData';

interface SmartMallMapProps {
  band: LiveBandState;
  allowDragChild?: boolean;
  allowDragParent?: boolean;
  onDragChild?: (pos: MallPoint) => void;
  onDragParent?: (pos: MallPoint) => void;
  onClearTrail?: () => void;
}

const SCALE = 10; // 1 meter = 10 SVG units (1000 x 640 viewBox)

export function SmartMallMap({
  band,
  allowDragChild = true,
  allowDragParent = true,
  onDragChild,
  onDragParent,
  onClearTrail,
}: SmartMallMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<'child' | 'parent' | null>(null);

  const edition = getEditionById(band.editionId);
  const evalInfo = evaluateMallPosition(
    band.childPos,
    band.parentPos,
    band.safeLimitM
  );
  const dist = evalInfo.distParent;

  const isCritical =
    band.activeAlert?.type === 'TAMPER_ATTEMPT' ||
    band.activeAlert?.type === 'GATE_PROXIMITY' ||
    evalInfo.nearGate ||
    evalInfo.outsideSafe;
  const isWarn = !isCritical && dist > band.safeLimitM * 0.72;

  const tetherColor = isCritical
    ? '#EF4444'
    : isWarn
    ? '#F59E0B'
    : '#10B981';

  const pillText = isCritical
    ? evalInfo.nearGate && evalInfo.nearestGate
      ? `بوابة ${evalInfo.nearestGate.id}`
      : band.activeAlert?.type === 'TAMPER_ATTEMPT'
      ? 'محاولة فك'
      : 'خارج النطاق'
    : isWarn
    ? 'قرب الحد'
    : 'آمن';

  const parentSvgX = band.parentPos.x * SCALE;
  const parentSvgY = band.parentPos.y * SCALE;
  const childSvgX = band.childPos.x * SCALE;
  const childSvgY = band.childPos.y * SCALE;
  const safeRadiusSvg = band.safeLimitM * SCALE;

  const midX = (parentSvgX + childSvgX) / 2;
  const midY = (parentSvgY + childSvgY) / 2;
  // Clamp midpoint label cleanly inside SVG frame
  const clampedMidX = Math.max(96, Math.min(MALL_WIDTH_M * SCALE - 96, midX));
  const clampedMidY = Math.max(30, Math.min(MALL_HEIGHT_M * SCALE - 30, midY));

  const trailPointsStr = band.pathHistory
    .map((pt) => `${(pt.x * SCALE).toFixed(1)},${(pt.y * SCALE).toFixed(1)}`)
    .join(' ');

  const clientToMallPoint = (clientX: number, clientY: number): MallPoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const svgX = ((clientX - rect.left) / rect.width) * (MALL_WIDTH_M * SCALE);
    const svgY = ((clientY - rect.top) / rect.height) * (MALL_HEIGHT_M * SCALE);
    return clampMallPoint({ x: svgX / SCALE, y: svgY / SCALE });
  };

  const handlePointerDownPin = (
    which: 'child' | 'parent',
    e: React.PointerEvent<SVGGElement>
  ) => {
    if (which === 'child' && !allowDragChild) return;
    if (which === 'parent' && !allowDragParent) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(which);
  };

  const handlePointerMoveSvg = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const pt = clientToMallPoint(e.clientX, e.clientY);
    if (!pt) return;
    if (dragging === 'child' && onDragChild) {
      onDragChild(pt);
    } else if (dragging === 'parent' && onDragParent) {
      onDragParent(pt);
    }
  };

  const handlePointerUpSvg = () => {
    if (dragging) {
      setDragging(null);
    }
  };

  const activeGateId =
    evalInfo.nearGate && evalInfo.nearestGate
      ? evalInfo.nearestGate.id
      : band.activeAlert?.type === 'GATE_PROXIMITY'
      ? band.activeAlert.gateNumber ?? null
      : null;

  return (
    <div className="glass-panel rounded-3xl p-3 sm:p-4 space-y-3">
      {/* Map Header: Current Mall Zone Pill + Clear Trail Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/85 border border-white shadow-xs">
          <MapPin
            className={`w-3.5 h-3.5 shrink-0 ${
              isCritical
                ? 'text-[#DC2626]'
                : isWarn
                ? 'text-[#D97706]'
                : 'text-[#059669]'
            }`}
            strokeWidth={2.2}
          />
          <span className="text-xs font-bold text-[#0F172A]">
            الطفل الآن في:{' '}
            <span
              className={
                isCritical
                  ? 'text-[#DC2626]'
                  : isWarn
                  ? 'text-[#D97706]'
                  : 'text-[#0284C7]'
              }
            >
              {evalInfo.zoneName}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(allowDragChild || allowDragParent) && (
            <span className="hidden sm:inline text-[11px] font-semibold text-[#64748B]">
              اسحب أيقونة الطفل أو ولي الأمر مباشرة على المخطط
            </span>
          )}
          {onClearTrail && (
            <button
              type="button"
              onClick={onClearTrail}
              className="px-3 py-1.5 rounded-xl bg-white/85 hover:bg-white border border-white shadow-xs text-[11px] font-bold text-[#334155] hover:text-[#0F172A] inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
            >
              <Eraser className="w-3.5 h-3.5 text-[#0284C7]" strokeWidth={2} />
              <span>مسح المسار</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive 2.5D Architectural Frosted-Glass Mall Floorplan */}
      <div className="relative rounded-2xl overflow-hidden border border-white/90 bg-gradient-to-br from-[#F1F5F9] via-[#F8FAFC] to-[#E2E8F0]/70 shadow-inner">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MALL_WIDTH_M * SCALE} ${MALL_HEIGHT_M * SCALE}`}
          className="w-full h-auto block select-none touch-none"
          onPointerMove={handlePointerMoveSvg}
          onPointerUp={handlePointerUpSvg}
          onPointerCancel={handlePointerUpSvg}
          onPointerLeave={handlePointerUpSvg}
          role="img"
          aria-label="مخطط المول الذكي التفاعلي"
        >
          <defs>
            {/* Architectural 5m Floor Tile Grid */}
            <pattern
              id="mallFloorGrid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke="rgba(148, 163, 184, 0.16)"
                strokeWidth="1"
              />
            </pattern>

            {/* Glowing Red Geo-Fence Laser Filter */}
            <filter id="laserGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Soft 2.5D Card Elevation Shadow */}
            <filter id="zoneShadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow
                dx="0"
                dy="6"
                stdDeviation="5"
                floodColor="#0F172A"
                floodOpacity="0.07"
              />
            </filter>

            {/* Pin Elevation Shadow */}
            <filter id="pinShadow" x="-30%" y="-30%" width="160%" height="170%">
              <feDropShadow
                dx="0"
                dy="4"
                stdDeviation="4"
                floodColor="#0F172A"
                floodOpacity="0.18"
              />
            </filter>

            {/* Circular Clip for Child Avatar */}
            <clipPath id={`childClip-${band.bandId}`}>
              <rect x="-18" y="-18" width="36" height="36" rx="11" />
            </clipPath>
          </defs>

          {/* Outer Architectural Mall Perimeter Slab */}
          <rect
            x="38"
            y="38"
            width="924"
            height="564"
            rx="28"
            fill="#F8FAFC"
            stroke="#CBD5E1"
            strokeWidth="3"
          />
          <rect
            x="40"
            y="40"
            width="920"
            height="560"
            rx="26"
            fill="url(#mallFloorGrid)"
          />

          {/* Main Architectural Cross Corridors */}
          <rect
            x="44"
            y="274"
            width="912"
            height="92"
            rx="14"
            fill="rgba(255, 255, 255, 0.72)"
            stroke="rgba(203, 213, 225, 0.55)"
            strokeWidth="1.5"
          />
          <rect
            x="394"
            y="44"
            width="212"
            height="552"
            rx="14"
            fill="rgba(255, 255, 255, 0.72)"
            stroke="rgba(203, 213, 225, 0.55)"
            strokeWidth="1.5"
          />

          {/* Subtle Corridor Center Wayfinding Lines */}
          <line
            x1="90"
            y1="320"
            x2="910"
            y2="320"
            stroke="rgba(148, 163, 184, 0.28)"
            strokeWidth="2"
            strokeDasharray="10 10"
          />
          <line
            x1="500"
            y1="82"
            x2="500"
            y2="558"
            stroke="rgba(148, 163, 184, 0.28)"
            strokeWidth="2"
            strokeDasharray="10 10"
          />

          {/* 5 Architectural 2.5D Mall Zones */}
          {MALL_ZONES.map((z) => {
            const x = z.x * SCALE;
            const y = z.y * SCALE;
            const w = z.w * SCALE;
            const h = z.h * SCALE;
            const isAtrium = z.id === 'smart_booth';
            return (
              <g key={z.id} filter="url(#zoneShadow)">
                {/* 2.5D Extruded Lower Wall Rim */}
                <rect
                  x={x}
                  y={y + 6}
                  width={w}
                  height={h}
                  rx={isAtrium ? 22 : 18}
                  fill="rgba(148, 163, 184, 0.25)"
                />
                {/* Frosted Glass Zone Surface */}
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={isAtrium ? 22 : 18}
                  fill={z.fill}
                  stroke={z.stroke}
                  strokeWidth={isAtrium ? 2.2 : 1.8}
                />
                {/* Top Inner Architectural Specular Highlight */}
                <rect
                  x={x + 6}
                  y={y + 5}
                  width={w - 12}
                  height={h - 10}
                  rx={isAtrium ? 17 : 13}
                  fill="none"
                  stroke="rgba(255,255,255,0.68)"
                  strokeWidth="1.2"
                />

                {isAtrium && (
                  <circle
                    cx={x + w / 2}
                    cy={y + h / 2}
                    r="42"
                    fill="rgba(14, 165, 233, 0.06)"
                    stroke="rgba(14, 165, 233, 0.22)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                )}

                <text
                  x={x + w / 2}
                  y={isAtrium ? y + h / 2 - 4 : y + 36}
                  textAnchor="middle"
                  fill={z.labelColor}
                  fontSize={isAtrium ? '13.5' : '15'}
                  fontWeight="700"
                >
                  {z.nameAr}
                </text>
                <text
                  x={x + w / 2}
                  y={isAtrium ? y + h / 2 + 16 : y + 56}
                  textAnchor="middle"
                  fill="rgba(71, 85, 105, 0.72)"
                  fontSize="11"
                  fontWeight="600"
                >
                  {z.subtitleEn}
                </text>
              </g>
            );
          })}

          {/* 4 Perimeter Exit Gates with Glowing Red Geo-Fence Laser Lines */}
          {MALL_GATES.map((gate) => {
            const x1 = gate.x1 * SCALE;
            const y1 = gate.y1 * SCALE;
            const x2 = gate.x2 * SCALE;
            const y2 = gate.y2 * SCALE;
            const isGateHot = activeGateId === gate.id;

            return (
              <g key={gate.id}>
                {/* Gate Danger Halo */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isGateHot ? 'rgba(239, 68, 68, 0.42)' : 'rgba(239, 68, 68, 0.16)'}
                  strokeWidth={isGateHot ? 26 : 14}
                  strokeLinecap="round"
                />
                {/* Glowing Red Geo-Fence Laser Beam */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#EF4444"
                  strokeLinecap="round"
                  filter="url(#laserGlow)"
                  className={
                    isGateHot ? 'gate-laser-critical' : 'gate-laser-idle'
                  }
                />
                {/* Gate Pillars */}
                <circle cx={x1} cy={y1} r="5.5" fill="#DC2626" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx={x2} cy={y2} r="5.5" fill="#DC2626" stroke="#FFFFFF" strokeWidth="2" />

                {/* Clean Gate Badge */}
                <g
                  transform={`translate(${gate.labelX * SCALE}, ${
                    gate.labelY * SCALE
                  })`}
                >
                  <rect
                    x="-34"
                    y="-12"
                    width="68"
                    height="24"
                    rx="12"
                    fill={isGateHot ? '#DC2626' : 'rgba(255, 255, 255, 0.94)'}
                    stroke={isGateHot ? '#991B1B' : 'rgba(239, 68, 68, 0.5)'}
                    strokeWidth="1.5"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill={isGateHot ? '#FFFFFF' : '#DC2626'}
                    fontSize="11.5"
                    fontWeight="700"
                  >
                    {gate.nameAr}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 1. DYNAMIC SAFE RADIUS CIRCLE CENTERED ON PARENT */}
          <g style={{ transition: 'all 140ms linear' }}>
            <circle
              cx={parentSvgX}
              cy={parentSvgY}
              r={safeRadiusSvg}
              fill={
                isCritical
                  ? 'rgba(239, 68, 68, 0.08)'
                  : isWarn
                  ? 'rgba(245, 158, 11, 0.09)'
                  : 'rgba(16, 185, 129, 0.11)'
              }
              stroke={tetherColor}
              strokeWidth={isCritical ? 2.8 : 2.2}
              strokeDasharray="9 7"
            />
            <text
              x={parentSvgX}
              y={Math.max(58, parentSvgY - safeRadiusSvg + 18)}
              textAnchor="middle"
              fill={isCritical ? '#DC2626' : '#059669'}
              fontSize="11"
              fontWeight="700"
              opacity="0.85"
            >
              نطاق الأمان {band.safeLimitM} متر
            </text>
          </g>

          {/* 3. LIVE FOOTSTEPS TRAIL + BREADCRUMB STEP NODES */}
          {band.pathHistory.length >= 2 && (
            <g>
              <polyline
                points={trailPointsStr}
                fill="none"
                stroke="rgba(14, 165, 233, 0.25)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={trailPointsStr}
                fill="none"
                stroke="#0EA5E9"
                strokeWidth="3.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {band.pathHistory.slice(1, -1).map((pt, idx) => (
                <circle
                  key={`${idx}-${pt.x}-${pt.y}`}
                  cx={pt.x * SCALE}
                  cy={pt.y * SCALE}
                  r="4"
                  fill="#0EA5E9"
                  stroke="#FFFFFF"
                  strokeWidth="1.8"
                />
              ))}
            </g>
          )}

          {/* 2. LIVE ELASTIC TETHER LINE BETWEEN PARENT & CHILD */}
          <g>
            <line
              x1={parentSvgX}
              y1={parentSvgY}
              x2={childSvgX}
              y2={childSvgY}
              stroke={tetherColor}
              strokeOpacity="0.24"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <line
              x1={parentSvgX}
              y1={parentSvgY}
              x2={childSvgX}
              y2={childSvgY}
              stroke={tetherColor}
              strokeWidth={isCritical ? 4.5 : 3.6}
              strokeDasharray="10 8"
              strokeLinecap="round"
              className="tether-animated-line"
            />

            {/* Midpoint Frosted Glass Distance Pill */}
            <g
              transform={`translate(${clampedMidX}, ${clampedMidY})`}
              filter="url(#pinShadow)"
            >
              <rect
                x="-78"
                y="-16"
                width="156"
                height="32"
                rx="16"
                fill="rgba(255, 255, 255, 0.96)"
                stroke={tetherColor}
                strokeWidth="2"
              />
              <circle cx="62" cy="0" r="4.5" fill={tetherColor} />
              <text
                x="-6"
                y="4.5"
                textAnchor="middle"
                fill={isCritical ? '#DC2626' : isWarn ? '#B45309' : '#059669'}
                fontSize="12"
                fontWeight="700"
              >
                {dist.toFixed(1)} متر • {pillText}
              </text>
            </g>
          </g>

          {/* PARENT BEACON PIN (Draggable) */}
          <g
            transform={`translate(${parentSvgX}, ${parentSvgY})`}
            onPointerDown={(e) => handlePointerDownPin('parent', e)}
            style={{
              cursor: allowDragParent
                ? dragging === 'parent'
                  ? 'grabbing'
                  : 'grab'
                : 'default',
            }}
            filter="url(#pinShadow)"
          >
            <circle
              cx="0"
              cy="0"
              r="17"
              fill="rgba(14, 165, 233, 0.35)"
              className="beacon-ring"
            />
            <circle
              cx="0"
              cy="0"
              r="14"
              fill="#0284C7"
              stroke="#FFFFFF"
              strokeWidth="3.5"
            />
            <circle cx="0" cy="0" r="4.5" fill="#FFFFFF" />
            <g transform="translate(0, 29)">
              <rect
                x="-36"
                y="-11"
                width="72"
                height="22"
                rx="11"
                fill="rgba(255, 255, 255, 0.95)"
                stroke="rgba(2, 132, 199, 0.45)"
                strokeWidth="1.4"
              />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill="#0F172A"
                fontSize="11.5"
                fontWeight="700"
              >
                ولي الأمر
              </text>
            </g>
          </g>

          {/* CHILD AVATAR PIN (Draggable) */}
          <g
            transform={`translate(${childSvgX}, ${childSvgY})`}
            onPointerDown={(e) => handlePointerDownPin('child', e)}
            style={{
              cursor: allowDragChild
                ? dragging === 'child'
                  ? 'grabbing'
                  : 'grab'
                : 'default',
            }}
            filter="url(#pinShadow)"
          >
            {(isCritical || isWarn) && (
              <circle
                cx="0"
                cy="0"
                r="24"
                fill={tetherColor}
                fillOpacity="0.4"
                className="beacon-ring"
              />
            )}
            <rect
              x="-21"
              y="-21"
              width="42"
              height="42"
              rx="13"
              fill="#FFFFFF"
              stroke={tetherColor}
              strokeWidth="3.2"
            />
            <image
              href={edition.imageUrl}
              x="-18"
              y="-18"
              width="36"
              height="36"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#childClip-${band.bandId})`}
            />
            <g transform="translate(0, 34)">
              <rect
                x="-52"
                y="-11"
                width="104"
                height="23"
                rx="11.5"
                fill="#0F172A"
              />
              <text
                x="0"
                y="4.5"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="11.5"
                fontWeight="700"
              >
                الطفل - {band.childName}
              </text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
