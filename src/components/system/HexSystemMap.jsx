import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Atom, History, Sparkles, FileText, MessageSquare } from 'lucide-react';

// System Architecture Map — a 6-way symmetric hexagonal network radiating from
// the COGNOS core into its cognitive faculties. Each module node is a live
// navigation surface (tap to enter). Black canvas, glowing connectors, flat-top
// hex geometry — the bloom aesthetic of the reference, driven by real routes.

const MODULES = [
  { label: 'Chat', Icon: MessageSquare, path: '/', desc: 'Reasoning interface' },
  { label: 'Memory', Icon: Brain, path: '/memory', desc: 'Persistent knowledge' },
  { label: 'Beliefs', Icon: Atom, path: '/beliefs', desc: 'Derived beliefs' },
  { label: 'Dynamics', Icon: History, path: '/dynamics', desc: 'Event ledger' },
  { label: 'Insights', Icon: Sparkles, path: '/insights', desc: 'Council research' },
  { label: 'Documents', Icon: FileText, path: '/documents', desc: 'Evidence archive' }
];

const SIZE = 600;
const C = SIZE / 2;
const R_MODULE = 205, R_INNER = 105, R_OUTER = 250, R_FLANK = 168;

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export default function HexSystemMap() {
  const navigate = useNavigate();
  const [hover, setHover] = useState(null);

  const mods = MODULES.map((m, i) => {
    const ang = (i * 60 - 90) * Math.PI / 180;
    const pt = (r) => [C + r * Math.cos(ang), C + r * Math.sin(ang)];
    const [ix, iy] = pt(R_INNER);
    const [x, y] = pt(R_MODULE);
    const [ox, oy] = pt(R_OUTER);
    const fa1 = ang - 18 * Math.PI / 180;
    const fa2 = ang + 18 * Math.PI / 180;
    return {
      ...m, ang, x, y, ix, iy, ox, oy,
      f1x: C + R_FLANK * Math.cos(fa1), f1y: C + R_FLANK * Math.sin(fa1),
      f2x: C + R_FLANK * Math.cos(fa2), f2y: C + R_FLANK * Math.sin(fa2),
      active: hover === i
    };
  });

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-auto max-w-[560px] mx-auto select-none" role="img" aria-label="COGNOS system architecture map">
      <defs>
        <filter id="h-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="h-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#E0F7FF" />
          <stop offset="100%" stopColor="#4A90E2" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={SIZE} height={SIZE} fill="#000" />

      {/* faint concentric hub rings */}
      <polygon points={hexPoints(C, C, 70)} fill="none" stroke="#1A2A4A" strokeWidth="1" opacity="0.5" />
      <polygon points={hexPoints(C, C, 58)} fill="none" stroke="#1A2A4A" strokeWidth="1" opacity="0.6" />

      {/* outer junction ring */}
      <polygon points={mods.map(m => `${m.ox},${m.oy}`).join(' ')} fill="none" stroke="#1A2A4A" strokeWidth="1" opacity="0.45" />

      {/* branches: hub → inner junction → module, plus flanks + outer */}
      {mods.map((m, i) => (
        <g key={'b' + i}>
          <line x1={C} y1={C} x2={m.ix} y2={m.iy} stroke="#87CEEB" strokeWidth="1.4" opacity="0.65" filter="url(#h-glow)" />
          <line x1={m.ix} y1={m.iy} x2={m.x} y2={m.y} stroke={m.active ? '#ffffff' : '#87CEEB'} strokeWidth="1.4" opacity="0.85" filter="url(#h-glow)" />
          <line x1={m.x} y1={m.y} x2={m.f1x} y2={m.f1y} stroke="#87CEEB" strokeWidth="1" opacity="0.45" />
          <line x1={m.x} y1={m.y} x2={m.f2x} y2={m.f2y} stroke="#87CEEB" strokeWidth="1" opacity="0.45" />
          <line x1={m.x} y1={m.y} x2={m.ox} y2={m.oy} stroke="#87CEEB" strokeWidth="1" opacity="0.4" />
        </g>
      ))}

      {/* junction hexes */}
      {mods.map((m, i) => (
        <g key={'j' + i}>
          <polygon points={hexPoints(m.ix, m.iy, 6)} fill="#1A2A4A" stroke="#4A90E2" strokeWidth="1" filter="url(#h-glow)" />
          <polygon points={hexPoints(m.ox, m.oy, 5)} fill="#0d1b2a" stroke="#4A90E2" strokeWidth="1" opacity="0.7" />
          <polygon points={hexPoints(m.f1x, m.f1y, 4)} fill="#1A2A4A" stroke="#87CEEB" strokeWidth="0.8" opacity="0.6" />
          <polygon points={hexPoints(m.f2x, m.f2y, 4)} fill="#1A2A4A" stroke="#87CEEB" strokeWidth="0.8" opacity="0.6" />
        </g>
      ))}

      {/* central hub */}
      <g className="cursor-pointer" onClick={() => navigate('/')}>
        <polygon points={hexPoints(C, C, 46)} fill="#1A2A4A" stroke="#4A90E2" strokeWidth="1.5" filter="url(#h-glow)" />
        <polygon points={hexPoints(C, C, 34)} fill="#0d1b2a" stroke="#87CEEB" strokeWidth="1.2" filter="url(#h-glow)" />
        <circle cx={C} cy={C} r={18} fill="url(#h-core)" className="animate-pulse" />
        <text x={C} y={C + 62} textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="600" letterSpacing="2">COGNOS</text>
      </g>

      {/* module nodes */}
      {mods.map((m, i) => {
        const Icon = m.Icon;
        return (
          <g
            key={'m' + i}
            className="cursor-pointer"
            onClick={() => navigate(m.path)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <polygon
              points={hexPoints(m.x, m.y, 25)}
              fill={m.active ? '#243b6e' : '#1A2A4A'}
              stroke={m.active ? '#ffffff' : '#4A90E2'}
              strokeWidth="1.5"
              filter="url(#h-glow)"
            />
            <g transform={`translate(${m.x - 10}, ${m.y - 10})`}>
              <Icon size={20} color="#E0F7FF" />
            </g>
            <text x={m.x} y={m.y + 40} textAnchor="middle" fill={m.active ? '#ffffff' : '#d1d5db'} fontSize="12" fontWeight="500">{m.label}</text>
            <text x={m.x} y={m.y + 54} textAnchor="middle" fill="#6b7280" fontSize="9">{m.desc}</text>
          </g>
        );
      })}
    </svg>
  );
}