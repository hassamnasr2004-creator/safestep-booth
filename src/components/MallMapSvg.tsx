import { LiveBandState } from '../types/safestep';
import {
  MALL_MAP_HEIGHT,
  MALL_MAP_WIDTH,
  MALL_ZONES,
  computeEffectiveDistance,
  detectZone,
} from '../data/safestepData';

interface MallMapSvgProps {
  band: LiveBandState;
}

export function MallMapSvg({ band }: MallMapSvgProps) {
  const currentZone = detectZone(band.mapPos);
  const { meters } = computeEffectiveDistance(band);
  const isRed =
    band.activeAlert?.type === 'gate' ||
    band.activeAlert?.type === 'tamper' ||
    currentZone.type === 'exit';
  const isAmber = !isRed && meters > band.safeLimitM;

  const markerColor = isRed ? '#DC2626' : isAmber ? '#D97706' : '#0D9488';
  const trailPoints = band.pathHistory.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-2.5 sm:p-3">
      <svg
        viewBox={`0 0 ${MALL_MAP_WIDTH} ${MALL_MAP_HEIGHT}`}
        className="w-full h-auto bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] select-none"
        role="img"
        aria-label="خريطة المول الحية"
      >
        <rect
          x="88"
          y="70"
          width="624"
          height="360"
          rx="8"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="2"
        />

        {MALL_ZONES.filter((z) => z.type === 'interior').map((z) => {
          const isCurrent = currentZone.id === z.id;
          return (
            <g key={z.id}>
              <rect
                x={z.bounds.x}
                y={z.bounds.y}
                width={z.bounds.width}
                height={z.bounds.height}
                rx="6"
                fill={isCurrent ? '#F0FDFA' : '#F8FAFC'}
                stroke={isCurrent ? '#0D9488' : '#CBD5E1'}
                strokeWidth={isCurrent ? '2' : '1.25'}
              />
              <text
                x={z.center.x}
                y={z.bounds.y + 30}
                textAnchor="middle"
                fill="#0F172A"
                fontSize="16"
                fontWeight="700"
                fontFamily="Alexandria, sans-serif"
              >
                {z.nameAr}
              </text>
            </g>
          );
        })}

        {MALL_ZONES.filter((z) => z.type === 'exit').map((gate) => {
          const triggered = currentZone.id === gate.id;
          return (
            <g key={gate.id}>
              {triggered && (
                <rect
                  x={gate.bounds.x - 6}
                  y={gate.bounds.y - 6}
                  width={gate.bounds.width + 12}
                  height={gate.bounds.height + 12}
                  rx="8"
                  fill="#DC2626"
                  fillOpacity="0.18"
                  stroke="#DC2626"
                  strokeWidth="2.5"
                >
                  <animate
                    attributeName="fill-opacity"
                    values="0.1;0.32;0.1"
                    dur="0.9s"
                    repeatCount="indefinite"
                  />
                </rect>
              )}
              <rect
                x={gate.bounds.x}
                y={gate.bounds.y}
                width={gate.bounds.width}
                height={gate.bounds.height}
                rx="5"
                fill={triggered ? '#FEF2F2' : '#FFFFFF'}
                stroke="#DC2626"
                strokeWidth={triggered ? '2.5' : '1.5'}
                strokeDasharray="6 4"
              />
              <text
                x={gate.center.x}
                y={gate.center.y + 5}
                textAnchor="middle"
                fill="#DC2626"
                fontSize="14"
                fontWeight="700"
                fontFamily="Alexandria, sans-serif"
              >
                {gate.nameAr}
              </text>
            </g>
          );
        })}

        {band.pathHistory.length > 1 && (
          <polyline
            points={trailPoints}
            fill="none"
            stroke="#1E3A8A"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.45"
          />
        )}

        <line
          x1={band.parentMapPos.x}
          y1={band.parentMapPos.y}
          x2={band.mapPos.x}
          y2={band.mapPos.y}
          stroke={markerColor}
          strokeWidth="2"
          strokeDasharray="5 5"
        />

        <g transform={`translate(${band.parentMapPos.x}, ${band.parentMapPos.y})`}>
          <circle r="11" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2.5" />
          <text
            x="0"
            y="26"
            textAnchor="middle"
            fill="#0F172A"
            fontSize="12"
            fontWeight="700"
            fontFamily="Alexandria, sans-serif"
          >
            أنت
          </text>
        </g>

        <g transform={`translate(${band.mapPos.x}, ${band.mapPos.y})`}>
          {(isRed || isAmber) && (
            <circle r="28" fill={markerColor} fillOpacity="0.2">
              <animate
                attributeName="r"
                values="18;32;18"
                dur="1.1s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="fill-opacity"
                values="0.32;0.05;0.32"
                dur="1.1s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          <circle r="14" fill={markerColor} stroke="#FFFFFF" strokeWidth="3" />
          <circle r="4.5" fill="#FFFFFF" />
          <rect x="-38" y="-38" width="76" height="22" rx="4" fill="#0F172A" />
          <text
            x="0"
            y="-23"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="12"
            fontWeight="700"
            fontFamily="Alexandria, sans-serif"
          >
            {band.childName}
          </text>
        </g>
      </svg>
    </div>
  );
}
