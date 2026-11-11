import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, continueRender, delayRender,
  interpolate, Easing, spring,
} from 'remotion';
import FACE from './face.json';

const FPS = 25, W = 1080, H = 1920;
const ACC = '#FF6A1A';      // warm accent
const CREAM = '#F4EBDD';
const RED = '#FF3B30';
const AR = "'Cairo', sans-serif";
const MONO = "'JBMono', 'Cairo', monospace";

// word timings on the edited timeline (seconds)
const WORDS = [
  { w: 'مش', s: 0.18, e: 0.55 }, { w: 'هعرف', s: 0.55, e: 1.10 },
  { w: 'ولا', s: 1.10, e: 1.50 }, { w: 'نفضل', s: 1.50, e: 1.95 }, { w: 'مقرّب', s: 1.95, e: 2.25 },
  { w: 'من', s: 2.25, e: 2.36 }, { w: 'الكاميرا', s: 2.36, e: 2.82 }, { w: 'كده؟', s: 2.82, e: 3.10 },
  { w: 'يعني', s: 3.25, e: 3.55 }, { w: 'أقعد', s: 4.05, e: 4.42 }, { w: 'كده', s: 4.42, e: 4.78 }, { w: 'شوية', s: 4.78, e: 5.15 },
  { w: 'مش', s: 5.30, e: 5.90 }, { w: 'هعرف', s: 6.30, e: 6.75 },
];
const GROUPS = [[2, 3, 4], [5, 6, 7], [8, 9, 10, 11]];
const CUT = 5.25;           // jump cut between the two takes

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const eio = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const eout = (k: number) => 1 - Math.pow(1 - k, 3);
const ramp = (t: number, a: number, b: number, ease = eio) => ease(clamp((t - a) / (b - a)));
const win = (t: number, a: number, b: number, fi = 0.18, fo = 0.18) =>
  Math.min(ramp(t, a, a + fi, eout), 1 - ramp(t, b - fo, b, eio));
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// camera zoom keyframes [t, zoom]
const ZK: [number, number][] = [
  [0, 1.0], [1.9, 1.035], [2.3, 1.28], [3.2, 1.30], [3.7, 1.13], [5.249, 1.15],
  [5.25, 1.06], [6.26, 1.09], [6.42, 1.24], [7.6, 1.27],
];
const zoomAt = (t: number) => {
  for (let i = 0; i < ZK.length - 1; i++) {
    const [t0, z0] = ZK[i], [t1, z1] = ZK[i + 1];
    if (t >= t0 && t <= t1) return lerp(z0, z1, eio((t - t0) / Math.max(1e-6, t1 - t0)));
  }
  return ZK[ZK.length - 1][1];
};
const FX = 540, FY = 1000; // zoom focal point (around his face)

// ---------- fonts ----------
const useFonts = () => {
  const [h] = useState(() => delayRender('fonts'));
  useEffect(() => {
    const fs = [
      new FontFace('Cairo', `url(${staticFile('fonts/cairo-ar.woff2')})`, { weight: '200 1000', unicodeRange: 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+200C-200E, U+FB50-FDFF, U+FE70-FEFC' }),
      new FontFace('Cairo', `url(${staticFile('fonts/cairo-lat.woff2')})`, { weight: '200 1000', unicodeRange: 'U+0000-00FF, U+2000-206F, U+2190-21FF, U+2212' }),
      new FontFace('JBMono', `url(${staticFile('fonts/mono.woff2')})`, { weight: '700' }),
    ];
    Promise.all(fs.map((f) => f.load().then((ff) => (document as any).fonts.add(ff)))).then(() => continueRender(h));
  }, []);
};

// ---------- background studio wall ----------
const Background: React.FC<{ t: number }> = ({ t }) => {
  const drift = Math.sin(t * 0.8) * 6;
  const bokeh = [
    { x: 120, y: 330, r: 70, c: 'rgba(255,170,90,.55)' }, { x: 960, y: 260, r: 90, c: 'rgba(255,150,70,.45)' },
    { x: 900, y: 520, r: 46, c: 'rgba(120,200,210,.35)' }, { x: 210, y: 620, r: 38, c: 'rgba(255,200,140,.45)' },
    { x: 60, y: 1020, r: 60, c: 'rgba(110,180,200,.30)' }, { x: 1010, y: 980, r: 54, c: 'rgba(255,160,80,.40)' },
  ];
  return (
    <AbsoluteFill style={{ filter: 'blur(3px)' }}>
      {/* cool base wall */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 42%, #3d525b 0%, #22313a 45%, #11181d 100%)' }} />
      {/* walnut acoustic slats */}
      <AbsoluteFill style={{
        background: 'repeating-linear-gradient(90deg, #6b4630 0px, #7d5438 18px, #6b4630 40px, #1a1210 40px, #1a1210 52px)',
        opacity: 0.55, mixBlendMode: 'multiply',
      }} />
      <AbsoluteFill style={{
        background: 'repeating-linear-gradient(90deg, rgba(255,210,160,.10) 0px, rgba(255,210,160,0) 22px, rgba(255,210,160,0) 52px)',
      }} />
      {/* warm backlight behind his head (separation from dark hair / navy hoodie) */}
      <AbsoluteFill style={{ background: 'radial-gradient(circle 520px at 50% 40%, rgba(255,165,95,.42) 0%, rgba(255,140,70,.16) 45%, rgba(0,0,0,0) 75%)' }} />
      {/* LED strip on the left, floating shelf on the right */}
      <div style={{ position: 'absolute', left: 92, top: 260, width: 10, height: 1150, borderRadius: 6, background: '#ffcf9e', boxShadow: '0 0 30px 10px rgba(255,140,60,.55), 0 0 90px 30px rgba(255,120,40,.25)' }} />
      <div style={{ position: 'absolute', left: 760, top: 610, width: 360, height: 18, background: '#3a281d', boxShadow: '0 16px 40px 6px rgba(255,150,70,.35)' }} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ position: 'absolute', left: 800 + i * 34, top: 610 - (120 + (i % 2) * 22), width: 28, height: 120 + (i % 2) * 22, background: ['#b8532c', '#e9d9c0', '#2f5a63', '#c9a46a'][i], borderRadius: 3 }} />
      ))}
      <div style={{ position: 'absolute', left: 960, top: 520, width: 80, height: 90, borderRadius: '40px 40px 14px 14px', background: '#d8cbb8' }} />
      {bokeh.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', left: b.x - b.r + drift * (i % 2 ? 1 : -1), top: b.y - b.r, width: b.r * 2, height: b.r * 2,
          borderRadius: '50%', background: `radial-gradient(circle, ${b.c} 0%, rgba(0,0,0,0) 70%)`,
        }} />
      ))}
      {/* vignette */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 65% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)' }} />
    </AbsoluteFill>
  );
};

// ---------- clean desk ----------
const Desk: React.FC = () => (
  <div style={{ position: 'absolute', left: -200, top: 1488, width: W + 400, height: 900 }}>
    <div style={{ position: 'absolute', inset: 0, boxShadow: '0 -18px 50px rgba(0,0,0,.45)' }} />
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(180deg, #8c7d6b 0%, #ad9f8b 5%, #c9bca9 28%, #d6cbba 100%)',
    }} />
    {/* subtle wood grain */}
    <div style={{ position: 'absolute', inset: 0, opacity: 0.10, background: 'repeating-linear-gradient(179deg, rgba(120,90,60,.35) 0px, rgba(120,90,60,0) 2px, rgba(120,90,60,0) 23px, rgba(120,90,60,.25) 25px, rgba(120,90,60,0) 27px, rgba(120,90,60,0) 41px)' }} />
    {/* warm reflection of the backlight */}
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 40% 30% at 50% 0%, rgba(255,170,100,.25), rgba(0,0,0,0) 100%)' }} />
    {/* light fall-off: key light hits the middle, sides drop into shade */}
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 75% at 50% 35%, rgba(0,0,0,0) 40%, rgba(20,12,6,.38) 100%)' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: 'rgba(255,240,220,.35)' }} />
  </div>
);

// ---------- film grain on the CG parts so they match the phone camera ----------
const Grain: React.FC<{ f: number }> = ({ f }) => (
  <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, opacity: 0.16, mixBlendMode: 'overlay' }}>
    <filter id={`gr${f}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={f} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" /></filter>
    <rect width={W} height={H} filter={`url(#gr${f})`} />
  </svg>
);

// ---------- realism layers built per frame from the matte ----------
const Shadow: React.FC<{ f: number }> = ({ f }) => (
  <Img src={staticFile(`sh/s${String(f).padStart(4, '0')}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} />
);
const Wrap: React.FC<{ f: number }> = ({ f }) => (
  <Img src={staticFile(`wr/w${String(f).padStart(4, '0')}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, mixBlendMode: 'screen' }} />
);

// ---------- the person cut-out ----------
const Person: React.FC<{ f: number }> = ({ f }) => (
  <Img src={staticFile(`p/p${String(f).padStart(4, '0')}.png`)}
    style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} />
);

// ---------- hook: big text behind his head ----------
const HookText: React.FC<{ t: number }> = ({ t }) => {
  const k1 = ramp(t, 0.16, 0.34, eout), k2 = ramp(t, 0.53, 0.71, eout);
  const out = ramp(t, 1.02, 1.22, eio);
  if (t > 1.25) return null;
  const word = (k: number, txt: string, color: string, x: number) => (
    <span style={{
      display: 'inline-block', color, opacity: k * (1 - out),
      transform: `translateY(${(1 - k) * -40 - out * 120}px) scale(${lerp(1.5, 1, k)})`,
      filter: `blur(${(1 - k) * 14 + out * 10}px)`, margin: `0 ${x}px`,
    }}>{txt}</span>
  );
  return (
    <div style={{
      position: 'absolute', left: -40, right: -40, top: 616, textAlign: 'center', direction: 'rtl', whiteSpace: 'nowrap',
      fontFamily: AR, fontWeight: 1000, fontSize: 176, lineHeight: 1.1, letterSpacing: -2,
      textShadow: '0 8px 30px rgba(0,0,0,.25)',
    }}>
      {word(k1, 'مش', CREAM, 10)}{word(k2, 'هعرف', ACC, 10)}
    </div>
  );
};

// ---------- rule-of-thirds grid (behind him) ----------
const Grid: React.FC<{ t: number }> = ({ t }) => {
  const k = ramp(t, 3.25, 3.75, eout), o = 1 - ramp(t, 4.95, 5.2);
  if (k <= 0 || o <= 0) return null;
  const line = (v: boolean, p: number, i: number) => {
    const kk = clamp(k * 1.3 - i * 0.1);
    return <div key={`${v}${i}`} style={{
      position: 'absolute', background: 'rgba(255,255,255,.28)', opacity: o,
      ...(v ? { left: p, top: 0, width: 3, height: H * kk } : { top: p, left: 0, height: 3, width: W * kk }),
    }} />;
  };
  return <AbsoluteFill>{[line(true, 360, 0), line(true, 720, 1), line(false, 640, 2), line(false, 1280, 3)]}</AbsoluteFill>;
};

// ---------- glass pill ----------
const glass: React.CSSProperties = {
  background: 'rgba(14,18,22,.74)', border: '1.5px solid rgba(255,255,255,.14)',
  boxShadow: '0 18px 50px rgba(0,0,0,.45)', backdropFilter: 'blur(14px)',
};

// ---------- viewfinder HUD ----------
const HUD: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const k = ramp(t, 0, 0.4, eout);
  const stop = t >= 6.9;
  const L = 96 * k, T = 7;
  const c = 'rgba(255,255,255,.92)';
  const corner = (x: number, y: number, sx: number, sy: number, key: string) => (
    <div key={key} style={{ position: 'absolute', left: x, top: y }}>
      <div style={{ position: 'absolute', left: sx > 0 ? 0 : -L, top: sy > 0 ? 0 : -T, width: L, height: T, background: c, borderRadius: 3 }} />
      <div style={{ position: 'absolute', left: sx > 0 ? 0 : -T, top: sy > 0 ? 0 : -L, width: T, height: L, background: c, borderRadius: 3 }} />
    </div>
  );
  const ss = Math.floor(f / FPS), ff = f % FPS;
  const tc = `00:00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
  const blink = Math.floor(t * 2.2) % 2 === 0;
  return (
    <AbsoluteFill style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.5))' }}>
      {corner(60, 150, 1, 1, 'a')}{corner(W - 60, 150, -1, 1, 'b')}
      {corner(60, 1590, 1, -1, 'c')}{corner(W - 60, 1590, -1, -1, 'd')}
      <div style={{ position: 'absolute', top: 186, left: 96, right: 96, height: 64, opacity: k, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: MONO, fontSize: 32, color: '#fff' }}>
        <div style={{ ...glass, display: 'flex', alignItems: 'center', gap: 14, padding: '8px 22px', borderRadius: 40 }}>
          {stop
            ? <div style={{ width: 24, height: 24, borderRadius: 4, background: '#fff' }} />
            : <div style={{ width: 24, height: 24, borderRadius: 12, background: RED, opacity: blink ? 1 : 0.25, boxShadow: blink ? `0 0 16px ${RED}` : 'none' }} />}
          <span style={{ letterSpacing: 2 }}>{stop ? 'STOP' : 'REC'}</span>
        </div>
        <div style={{ ...glass, padding: '8px 22px', borderRadius: 40, letterSpacing: 1 }}>{tc}</div>
        <div style={{ ...glass, display: 'flex', alignItems: 'center', gap: 14, padding: '8px 22px', borderRadius: 40 }}>
          <span>4K·25</span>
          <div style={{ width: 46, height: 22, border: '3px solid #fff', borderRadius: 5, padding: 2, position: 'relative' }}>
            <div style={{ width: '72%', height: '100%', background: '#7CFC9A', borderRadius: 2 }} />
            <div style={{ position: 'absolute', right: -9, top: 4, width: 5, height: 8, background: '#fff', borderRadius: 1 }} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- autofocus box (tracks the face) ----------
const AFBox: React.FC<{ t: number; f: number; z: number }> = ({ t, f, z }) => {
  const showA = win(t, 1.10, 3.25, 0.12, 0.2);
  const showB = t >= 5.3 && t < 6.95 ? win(t, 5.3, 6.95, 0.06, 0.15) : 0;
  const vis = Math.max(showA, showB);
  if (vis <= 0) return null;
  const [fx, fy, fw, fh] = (FACE as number[][])[Math.min(f, FACE.length - 1)];
  // source box with room for hair, mapped through the camera zoom
  let x = fx - fw * 0.14, y = fy - fh * 0.3, w = fw * 1.28, h = fh * 1.42;
  const map = (px: number, py: number) => [FX + (px - FX) * z, FY + (py - FY) * z];
  let [sx, sy] = map(x, y); let [ex, ey] = map(x + w, y + h);
  const locked = t >= 1.95 && t < 5.3;
  const fail = t >= 5.3;
  // hunting before lock: box breathes and wanders
  let s = 1;
  if (!locked && !fail) s = 1.0 + 0.22 * (1 - ramp(t, 1.1, 1.95)) + 0.05 * Math.sin(t * 22);
  if (locked) s = 1 + 0.12 * Math.exp(-(t - 1.95) * 14) * Math.cos((t - 1.95) * 40);
  let jx = 0, jy = 0;
  if (!locked && !fail) { jx = Math.sin(t * 13) * 18 * (1 - ramp(t, 1.1, 1.95)); jy = Math.cos(t * 11) * 12 * (1 - ramp(t, 1.1, 1.95)); }
  if (fail) { jx = (rnd(f) - 0.5) * 26; jy = (rnd(f + 9) - 0.5) * 18; s = 1.06 + 0.04 * Math.sin(t * 30); }
  const cx = (sx + ex) / 2 + jx, cy = (sy + ey) / 2 + jy, bw = (ex - sx) * s, bh = (ey - sy) * s;
  const col = fail ? RED : locked ? ACC : '#fff';
  const flick = fail ? (Math.floor(t * 9) % 2 ? 1 : 0.35) : 1;
  const L = 70, T = 7;
  const c = (dx: number, dy: number, k: string) => (
    <div key={k} style={{ position: 'absolute', left: cx + dx * bw / 2, top: cy + dy * bh / 2 }}>
      <div style={{ position: 'absolute', left: dx < 0 ? 0 : -L, top: dy < 0 ? 0 : -T, width: L, height: T, background: col, borderRadius: 3 }} />
      <div style={{ position: 'absolute', left: dx < 0 ? 0 : -T, top: dy < 0 ? 0 : -L, width: T, height: L, background: col, borderRadius: 3 }} />
    </div>
  );
  const label = fail ? 'AF  ✕' : locked ? 'AF  ●  LOCK' : 'AF  ···';
  return (
    <AbsoluteFill style={{ opacity: vis * flick, filter: `drop-shadow(0 0 ${locked || fail ? 14 : 4}px ${col}88)` }}>
      {c(-1, -1, 'a')}{c(1, -1, 'b')}{c(-1, 1, 'c')}{c(1, 1, 'd')}
      <div style={{ position: 'absolute', left: cx - bw / 2, top: cy - bh / 2 - 62, fontFamily: MONO, fontSize: 30, color: col, letterSpacing: 2, whiteSpace: 'nowrap' }}>{label}</div>
    </AbsoluteFill>
  );
};

// ---------- zoom lens ruler (left side) ----------
const ZoomRuler: React.FC<{ t: number; z: number }> = ({ t, z }) => {
  const vis = win(t, 1.55, 3.3, 0.25, 0.25);
  if (vis <= 0) return null;
  const v = 1 + clamp((z - 1.035) / (1.28 - 1.035)) * 1.0; // 1.0x → 2.0x
  const top = 640, hgt = 560, mid = top + hgt / 2, step = 46; // px per 0.1x
  const ticks = [];
  for (let i = 0; i <= 30; i++) {
    const val = 0.5 + i * 0.1, y = mid + (v - val) * 10 * step;
    if (y < top - 4 || y > top + hgt + 4) continue;
    const major = i % 5 === 0;
    const near = 1 - clamp(Math.abs(y - mid) / (hgt / 2));
    ticks.push(<div key={i} style={{ position: 'absolute', left: major ? 26 : 44, top: y - 2, width: major ? 54 : 32, height: 4, borderRadius: 2, background: `rgba(255,255,255,${0.25 + 0.75 * near})` }} />);
    if (major) ticks.push(<div key={'l' + i} style={{ position: 'absolute', left: 92, top: y - 20, fontFamily: MONO, fontSize: 28, color: `rgba(255,255,255,${0.3 + 0.7 * near})` }}>{val.toFixed(1)}</div>);
  }
  return (
    <div style={{ position: 'absolute', left: 60, top: top - 30, width: 170, height: hgt + 60, borderRadius: 30, ...glass, opacity: vis, transform: `translateX(${(1 - vis) * -60}px)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: -(top - 30), width: 170, height: H }}>
        {ticks}
        <div style={{ position: 'absolute', left: 8, top: mid - 3, width: 150, height: 6, background: ACC, borderRadius: 3, boxShadow: `0 0 14px ${ACC}` }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 16, textAlign: 'center', fontFamily: MONO, fontSize: 36, color: ACC }}>{v.toFixed(1)}×</div>
    </div>
  );
};

// ---------- level + "a while" timer ring ----------
const Level: React.FC<{ t: number }> = ({ t }) => {
  const vis = win(t, 3.3, 5.22, 0.25, 0.2);
  if (vis <= 0) return null;
  const settle = 4.42; // "كده"
  const ang = t < settle ? 10 * Math.sin((t - 3.3) * 9) * (1 - 0.6 * ramp(t, 3.3, settle)) : 3 * Math.exp(-(t - settle) * 12) * Math.cos((t - settle) * 40);
  const ok = t >= settle;
  const col = ok ? ACC : '#fff';
  const ring = ramp(t, 4.78, 5.15, (k) => k);
  const R = 30, C = 2 * Math.PI * R;
  return (
    <div style={{ position: 'absolute', left: 540 - 330, top: 330, width: 660, height: 120, borderRadius: 60, ...glass, opacity: vis, transform: `translateY(${(1 - vis) * -40}px)` }}>
      {/* timer ring (left: graphic) */}
      <svg width={84} height={84} style={{ position: 'absolute', left: 22, top: 18, opacity: ramp(t, 4.7, 4.85) }}>
        <circle cx={42} cy={42} r={R} stroke="rgba(255,255,255,.2)" strokeWidth={8} fill="none" />
        <circle cx={42} cy={42} r={R} stroke={ACC} strokeWidth={8} fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - ring)} transform="rotate(-90 42 42)" />
        <line x1={42} y1={42} x2={42 + 16 * Math.sin(ring * 6.283)} y2={42 - 16 * Math.cos(ring * 6.283)} stroke="#fff" strokeWidth={5} strokeLinecap="round" />
      </svg>
      {/* reference ticks + tilting horizon */}
      <div style={{ position: 'absolute', left: 150, top: 58, width: 40, height: 5, background: 'rgba(255,255,255,.45)', borderRadius: 3 }} />
      <div style={{ position: 'absolute', right: 40, top: 58, width: 40, height: 5, background: 'rgba(255,255,255,.45)', borderRadius: 3 }} />
      <div style={{ position: 'absolute', left: 215, top: 57, width: 380, height: 7, borderRadius: 4, background: col, transform: `rotate(${ang}deg)`, boxShadow: ok ? `0 0 18px ${ACC}` : 'none' }} />
      <div style={{ position: 'absolute', left: 395, top: 45, width: 30, height: 30, borderRadius: 15, border: `5px solid ${col}`, background: 'rgba(14,18,22,1)', transform: `translateY(${ang * 0.6}px)` }} />
      {ok && <div style={{ position: 'absolute', left: 392, top: -34, fontFamily: AR, fontSize: 40, fontWeight: 900, color: ACC, transform: `scale(${spring({ frame: (t - settle) * FPS, fps: FPS, config: { damping: 9 } })})` }}>✓</div>}
    </div>
  );
};

// ---------- error alert ("مش هعرف" #2) ----------
const Alert: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  if (t < 5.3 || t > 7.05) return null;
  const pop = spring({ frame: (t - 5.32) * FPS, fps: FPS, config: { damping: 11, stiffness: 160 } });
  const out = ramp(t, 6.85, 7.02);
  const shake = t > 6.3 ? Math.exp(-(t - 6.3) * 9) * Math.sin((t - 6.3) * 70) * 22 : 0;
  const w2 = ramp(t, 6.28, 6.4, eout);
  const btn = (txt: string, fill: boolean) => (
    <div style={{ flex: 1, height: 84, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: AR, fontWeight: 800, fontSize: 38, color: fill ? '#fff' : 'rgba(255,255,255,.75)',
      background: fill ? ACC : 'rgba(255,255,255,.08)', border: fill ? 'none' : '2px solid rgba(255,255,255,.18)' }}>{txt}</div>
  );
  return (
    <div style={{
      position: 'absolute', left: 150, top: 268, width: 780, borderRadius: 44, padding: '38px 44px 40px', ...glass,
      background: 'rgba(16,19,24,.86)', direction: 'rtl',
      opacity: clamp(pop * 1.4) * (1 - out), transform: `translateX(${shake}px) scale(${lerp(0.6, 1, pop) * (1 - out * 0.12)})`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
        <div style={{ flex: 1, fontFamily: AR, fontWeight: 900, fontSize: 92, color: '#fff', lineHeight: 1.15, textAlign: 'right' }}>
          مش <span style={{ color: ACC, opacity: w2, display: 'inline-block', transform: `scale(${lerp(1.6, 1, w2)})` }}>هعرف</span>
        </div>
        {/* warning icon on the left */}
        <svg width={120} height={110} viewBox="0 0 120 110" style={{ transform: `rotate(${shake * 0.4}deg)` }}>
          <path d="M60 6 L114 102 L6 102 Z" fill={RED} stroke={RED} strokeWidth={10} strokeLinejoin="round" />
          <rect x={53} y={36} width={14} height={38} rx={6} fill="#fff" />
          <circle cx={60} cy={87} r={8} fill="#fff" />
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 22, marginTop: 30 }}>{btn('حاول تاني', true)}{btn('إلغاء', false)}</div>
    </div>
  );
};

// ---------- captions ----------
const Captions: React.FC<{ t: number }> = ({ t }) => {
  const gi = GROUPS.findIndex((g) => t >= WORDS[g[0]].s - 0.05 && t < WORDS[g[g.length - 1]].e + 0.12);
  if (gi < 0) return null;
  const g = GROUPS[gi];
  const a = WORDS[g[0]].s - 0.05;
  const k = spring({ frame: (t - a) * FPS, fps: FPS, config: { damping: 14, stiffness: 180 } });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1372, display: 'flex', justifyContent: 'center' }}>
      <div style={{ ...glass, borderRadius: 30, padding: '10px 38px 16px', direction: 'rtl', display: 'flex', gap: 22,
        transform: `translateY(${(1 - k) * 40}px) scale(${lerp(0.85, 1, k)})`, opacity: clamp(k * 1.5) }}>
        {g.map((i) => {
          const wd = WORDS[i]; const on = t >= wd.s && t < wd.e + 0.05; const past = t >= wd.e;
          const wk = ramp(t, wd.s, wd.s + 0.12, eout);
          return <span key={i} style={{
            fontFamily: AR, fontWeight: 800, fontSize: 70, lineHeight: 1.3,
            color: on ? ACC : past ? '#fff' : 'rgba(255,255,255,.45)',
            transform: `scale(${on ? lerp(1, 1.12, wk) : 1})`, display: 'inline-block',
            textShadow: on ? `0 0 24px ${ACC}88` : 'none',
          }}>{wd.w}</span>;
        })}
      </div>
    </div>
  );
};

// ---------- the zoomable world ----------
const World: React.FC<{ t: number; f: number; z: number; ox?: number }> = ({ t, f, z, ox = 0 }) => (
  <AbsoluteFill style={{ transformOrigin: `${FX}px ${FY}px`, transform: `translateX(${ox}px) scale(${z})` }}>
    <Background t={t} />
    <Grid t={t} />
    <HookText t={t} />
    <Desk />
    <Grain f={f} />
    <Shadow f={f} />
    <Person f={f} />
    <Wrap f={f} />
  </AbsoluteFill>
);

export const Main: React.FC = () => {
  useFonts();
  const f = useCurrentFrame();
  const t = f / FPS;
  let z = zoomAt(t);
  // impact shake on the second "هعرف"
  const shk = t > 6.3 && t < 6.7 ? Math.exp(-(t - 6.3) * 10) * 10 : 0;
  const sx = shk * Math.sin(t * 90), sy = shk * Math.cos(t * 77);
  // glitch around the jump cut
  const g = t >= CUT - 0.08 && t < CUT + 0.2;
  // CRT power-off ending
  const off1 = ramp(t, 7.12, 7.36, (k) => k * k), off2 = ramp(t, 7.36, 7.52, (k) => k * k);
  const sy2 = lerp(1, 0.004, off1), sx2 = lerp(1, 0, off2);
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${sx2}, ${sy2})`, filter: off1 > 0 ? `brightness(${1 + off1 * 1.6})` : undefined }}>
        <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
          <World t={t} f={f} z={z} />
          {g && [0, 1, 2, 3, 4, 5].map((i) => {
            const y0 = rnd(f * 7 + i) * 90, hh = 2 + rnd(f * 3 + i) * 5;
            return (
              <AbsoluteFill key={i} style={{ clipPath: `inset(${y0}% 0 ${Math.max(0, 100 - y0 - hh)}% 0)` }}>
                <World t={t} f={f} z={z} ox={(rnd(f * 13 + i) - 0.5) * 120} />
                <AbsoluteFill style={{ background: i % 2 ? 'rgba(255,40,60,.13)' : 'rgba(40,220,255,.12)', mixBlendMode: 'screen' }} />
              </AbsoluteFill>
            );
          })}
          {g && <AbsoluteFill style={{ background: `rgba(255,255,255,${0.14 * (1 - Math.abs(t - CUT) / 0.2)})` }} />}
          <AFBox t={t} f={f} z={z} />
          <ZoomRuler t={t} z={z} />
          <Level t={t} />
          <Alert t={t} f={f} />
          <Captions t={t} />
          <HUD t={t} f={f} />
        </AbsoluteFill>
      </AbsoluteFill>
      {off1 > 0 && <AbsoluteFill style={{ background: `radial-gradient(ellipse ${lerp(100, 2, off2)}% 0.6% at 50% 50%, rgba(255,255,255,${0.9 * (1 - off2 * 0.6)}), rgba(0,0,0,0) 100%)`, opacity: off2 < 1 ? 1 : 0 }} />}
      <Audio src={staticFile('mix.wav')} />
    </AbsoluteFill>
  );
};
