import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Plus, X, RotateCw, Copy, Layers, Image as ImageIcon, Shirt, Trash2, ChevronRight, Target, Sliders, Package } from 'lucide-react';

// ───────────────────────────────────────────────────────────────
// Merch Mockup Studio — Phase 1 (Canvas-based, no AI, no backend)
// Aesthetic: atelier / darkroom, warm paper + ink + one hot accent
// ───────────────────────────────────────────────────────────────

const PRESET_ZONES = {
  tshirt: [
    { id: 'chest-center', label: 'Chest', x: 0.5, y: 0.32, w: 0.22 },
    { id: 'chest-left',   label: 'Left Chest', x: 0.37, y: 0.30, w: 0.10 },
    { id: 'full-front',   label: 'Full Front', x: 0.5, y: 0.45, w: 0.48 },
    { id: 'back-center',  label: 'Back', x: 0.5, y: 0.38, w: 0.40 },
  ],
  hoodie: [
    { id: 'chest-center', label: 'Chest', x: 0.5, y: 0.34, w: 0.22 },
    { id: 'chest-left',   label: 'Left Chest', x: 0.38, y: 0.32, w: 0.10 },
    { id: 'hood',         label: 'Hood', x: 0.5, y: 0.14, w: 0.12 },
    { id: 'back-center',  label: 'Back', x: 0.5, y: 0.42, w: 0.42 },
  ],
  cap: [
    { id: 'front',  label: 'Front', x: 0.5,  y: 0.55, w: 0.28 },
    { id: 'side',   label: 'Side',  x: 0.78, y: 0.52, w: 0.14 },
    { id: 'back',   label: 'Back',  x: 0.5,  y: 0.55, w: 0.22 },
  ],
  other: [
    { id: 'center', label: 'Center', x: 0.5, y: 0.5, w: 0.30 },
  ],
};

const GARMENT_TYPES = [
  { id: 'tshirt', label: 'T-Shirt' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'cap',    label: 'Cap / Hat' },
  { id: 'other',  label: 'Other' },
];

const BLEND_MODES = [
  { id: 'source-over',  label: 'Normal' },
  { id: 'multiply',     label: 'Multiply' },
  { id: 'screen',       label: 'Screen' },
  { id: 'overlay',      label: 'Overlay' },
  { id: 'darken',       label: 'Darken' },
  { id: 'lighten',      label: 'Lighten' },
];

const uid = () => Math.random().toString(36).slice(2, 10);

// Load an image file as an HTMLImageElement
const fileToImage = (file) => new Promise((res, rej) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => res({ img, url, name: file.name });
  img.onerror = rej;
  img.src = url;
});

// Build a composite PNG data URL from garment + placement
const composeMockup = (garment, logoImg, placement) => {
  const { img } = garment;
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  if (logoImg && placement) {
    const { xPct, yPct, widthPct, rotation, opacity, blend } = placement;
    const targetW = widthPct * canvas.width;
    const aspect = logoImg.naturalHeight / logoImg.naturalWidth;
    const targetH = targetW * aspect;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = blend;
    ctx.translate(xPct * canvas.width, yPct * canvas.height);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(logoImg, -targetW / 2, -targetH / 2, targetW, targetH);
    ctx.restore();
  }
  return canvas.toDataURL('image/png');
};

// Minimal ZIP builder (STORE method, no compression) — avoids external deps
const buildZip = async (files) => {
  const encoder = new TextEncoder();
  const fileEntries = [];
  const centralEntries = [];
  let offset = 0;

  // CRC32 table
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const size = data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true); // STORE
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    fileEntries.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralEntries.push(central);

    offset += local.length + data.length;
  }
  const centralStart = offset;
  let centralSize = 0;
  centralEntries.forEach(e => centralSize += e.length);

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of fileEntries) { out.set(part, p); p += part.length; }
  for (const part of centralEntries) { out.set(part, p); p += part.length; }
  out.set(end, p);
  return new Blob([out], { type: 'application/zip' });
};

const dataUrlToBytes = (dataUrl) => {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
};

export default function App() {
  const [garments, setGarments] = useState([]); // { id, name, img, url, type, placement }
  const [logos, setLogos] = useState([]); // { id, name, img, url }
  const [activeLogo, setActiveLogo] = useState(null);
  const [activeGarment, setActiveGarment] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const garmentInput = useRef();
  const logoInput = useRef();
  const canvasRef = useRef();
  const dragState = useRef(null);

  const currentGarment = garments.find(g => g.id === activeGarment);
  const currentLogo = logos.find(l => l.id === activeLogo);

  // ──────── Upload handlers ────────
  const handleGarmentUpload = async (files) => {
    const loaded = await Promise.all(Array.from(files).map(fileToImage));
    const newOnes = loaded.map(l => ({
      ...l,
      id: uid(),
      type: guessType(l.name),
      placement: {
        xPct: 0.5, yPct: 0.32, widthPct: 0.22,
        rotation: 0, opacity: 1, blend: 'source-over',
      },
    }));
    setGarments(prev => [...prev, ...newOnes]);
    if (!activeGarment && newOnes[0]) setActiveGarment(newOnes[0].id);
  };

  const handleLogoUpload = async (files) => {
    const loaded = await Promise.all(Array.from(files).map(fileToImage));
    const newOnes = loaded.map(l => ({ ...l, id: uid() }));
    setLogos(prev => [...prev, ...newOnes]);
    if (!activeLogo && newOnes[0]) setActiveLogo(newOnes[0].id);
  };

  const guessType = (name) => {
    const n = name.toLowerCase();
    if (n.includes('hood')) return 'hoodie';
    if (n.includes('cap') || n.includes('hat')) return 'cap';
    if (n.includes('shirt') || n.includes('tee') || n.includes('tshirt')) return 'tshirt';
    return 'other';
  };

  // ──────── Placement updates ────────
  const updatePlacement = (garmentId, patch) => {
    setGarments(prev => prev.map(g => g.id === garmentId
      ? { ...g, placement: { ...g.placement, ...patch } }
      : g));
  };

  const applyPresetZone = (zone) => {
    if (!currentGarment) return;
    updatePlacement(currentGarment.id, {
      xPct: zone.x, yPct: zone.y, widthPct: zone.w, rotation: 0,
    });
  };

  const applyToAllSameType = () => {
    if (!currentGarment) return;
    const p = currentGarment.placement;
    setGarments(prev => prev.map(g =>
      g.type === currentGarment.type
        ? { ...g, placement: { ...p } }
        : g
    ));
  };

  const applyToAll = () => {
    if (!currentGarment) return;
    const p = currentGarment.placement;
    setGarments(prev => prev.map(g => ({ ...g, placement: { ...p } })));
  };

  const removeGarment = (id) => {
    setGarments(prev => prev.filter(g => g.id !== id));
    if (activeGarment === id) {
      const remaining = garments.filter(g => g.id !== id);
      setActiveGarment(remaining[0]?.id || null);
    }
  };
  const removeLogo = (id) => {
    setLogos(prev => prev.filter(l => l.id !== id));
    if (activeLogo === id) {
      const remaining = logos.filter(l => l.id !== id);
      setActiveLogo(remaining[0]?.id || null);
    }
  };

  // ──────── Canvas preview rendering ────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentGarment) return;
    const ctx = canvas.getContext('2d');
    const { img } = currentGarment;

    // Fit canvas to display area while preserving aspect ratio
    const parent = canvas.parentElement;
    const maxW = parent.clientWidth;
    const maxH = parent.clientHeight;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    if (currentLogo) {
      const p = currentGarment.placement;
      const targetW = p.widthPct * w;
      const aspect = currentLogo.img.naturalHeight / currentLogo.img.naturalWidth;
      const targetH = targetW * aspect;
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.globalCompositeOperation = p.blend;
      ctx.translate(p.xPct * w, p.yPct * h);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.drawImage(currentLogo.img, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.restore();

      // Selection outline
      ctx.save();
      ctx.translate(p.xPct * w, p.yPct * h);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.strokeStyle = '#E4572E';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-targetW / 2, -targetH / 2, targetW, targetH);
      // corner handles
      ctx.setLineDash([]);
      ctx.fillStyle = '#E4572E';
      const handles = [
        [-targetW / 2, -targetH / 2],
        [ targetW / 2, -targetH / 2],
        [-targetW / 2,  targetH / 2],
        [ targetW / 2,  targetH / 2],
      ];
      handles.forEach(([hx, hy]) => ctx.fillRect(hx - 4, hy - 4, 8, 8));
      ctx.restore();
    }
  }, [currentGarment, currentLogo, garments]);

  // Re-render on window resize
  useEffect(() => {
    const onResize = () => {
      // force re-render via state ping
      setGarments(g => [...g]);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ──────── Canvas drag interaction ────────
  const onCanvasMouseDown = (e) => {
    if (!currentGarment || !currentLogo) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    dragState.current = {
      startX: px, startY: py,
      origX: currentGarment.placement.xPct,
      origY: currentGarment.placement.yPct,
    };
  };
  const onCanvasMouseMove = (e) => {
    if (!dragState.current || !currentGarment) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const dx = px - dragState.current.startX;
    const dy = py - dragState.current.startY;
    updatePlacement(currentGarment.id, {
      xPct: Math.max(0, Math.min(1, dragState.current.origX + dx)),
      yPct: Math.max(0, Math.min(1, dragState.current.origY + dy)),
    });
  };
  const onCanvasMouseUp = () => { dragState.current = null; };

  // ──────── Export ────────
  const exportAll = async () => {
    if (!garments.length || !currentLogo) return;
    setExporting(true);
    setExportProgress(0);
    const files = [];
    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const dataUrl = composeMockup(g, currentLogo.img, g.placement);
      files.push({
        name: `mockup_${String(i + 1).padStart(2, '0')}_${g.name.replace(/\.[^.]+$/, '')}.png`,
        data: dataUrlToBytes(dataUrl),
      });
      setExportProgress(Math.round(((i + 1) / garments.length) * 100));
      await new Promise(r => setTimeout(r, 10));
    }
    const zip = await buildZip(files);
    const url = URL.createObjectURL(zip);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merch-mockups-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    setExportProgress(0);
  };

  const exportSingle = () => {
    if (!currentGarment || !currentLogo) return;
    const dataUrl = composeMockup(currentGarment, currentLogo.img, currentGarment.placement);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `mockup_${currentGarment.name.replace(/\.[^.]+$/, '')}.png`;
    a.click();
  };

  const p = currentGarment?.placement;

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: '#F2EDE4',
        color: '#1A1714',
        fontFamily: "'Fraunces', Georgia, serif",
        backgroundImage: `
          radial-gradient(circle at 20% 10%, rgba(228, 87, 46, 0.04), transparent 45%),
          radial-gradient(circle at 85% 80%, rgba(26, 23, 20, 0.05), transparent 50%)
        `,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,700;9..144,900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .btn-primary {
          background: #1A1714; color: #F2EDE4;
          border: 1px solid #1A1714;
          transition: all 150ms ease;
          letter-spacing: 0.02em;
        }
        .btn-primary:hover:not(:disabled) { background: #E4572E; border-color: #E4572E; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-ghost {
          background: transparent; color: #1A1714;
          border: 1px solid rgba(26,23,20,0.25);
          transition: all 150ms ease;
        }
        .btn-ghost:hover:not(:disabled) {
          background: #1A1714; color: #F2EDE4; border-color: #1A1714;
        }
        .btn-ghost:disabled { opacity: 0.35; cursor: not-allowed; }
        .thumb {
          transition: all 180ms ease;
          border: 1.5px solid rgba(26,23,20,0.15);
        }
        .thumb:hover { border-color: #1A1714; }
        .thumb.active {
          border-color: #E4572E;
          box-shadow: 0 0 0 3px rgba(228,87,46,0.18);
        }
        .zone-btn {
          background: transparent;
          border: 1px dashed rgba(26,23,20,0.35);
          transition: all 150ms;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          font-size: 10px;
        }
        .zone-btn:hover { background: #1A1714; color: #F2EDE4; border-style: solid; border-color: #1A1714; }
        .slider {
          -webkit-appearance: none; appearance: none;
          background: transparent; width: 100%; height: 22px;
        }
        .slider::-webkit-slider-runnable-track {
          height: 1px; background: #1A1714;
        }
        .slider::-moz-range-track { height: 1px; background: #1A1714; }
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 14px; height: 14px;
          background: #E4572E;
          border: 2px solid #1A1714;
          margin-top: -7px; cursor: grab;
          border-radius: 0;
        }
        .slider::-moz-range-thumb {
          width: 14px; height: 14px;
          background: #E4572E; border: 2px solid #1A1714;
          cursor: grab; border-radius: 0;
        }
        .drop-zone {
          border: 1.5px dashed rgba(26,23,20,0.3);
          transition: all 200ms;
        }
        .drop-zone:hover {
          border-color: #E4572E;
          background: rgba(228,87,46,0.04);
        }
        .canvas-stage {
          background-image:
            linear-gradient(45deg, rgba(26,23,20,0.04) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(26,23,20,0.04) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(26,23,20,0.04) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(26,23,20,0.04) 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0;
        }
        .rule::after {
          content: ''; display: block;
          height: 1px; background: #1A1714;
          margin-top: 6px;
        }
        select {
          background: transparent;
          font-family: inherit;
        }
      `}</style>

      {/* ─── HEADER ─── */}
      <header className="border-b border-black/15">
        <div className="max-w-[1600px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5" style={{ background: '#E4572E' }} />
              <span className="mono text-[11px] tracking-[0.3em] uppercase">Atelier</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight" style={{ fontStretch: '110%' }}>
              Merch Mockup Studio
            </h1>
            <span className="mono text-[10px] uppercase tracking-widest text-black/50 hidden md:inline">
              — Phase&nbsp;01 / Canvas Engine
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost px-4 py-2 mono text-[11px] uppercase tracking-widest flex items-center gap-2"
              onClick={exportSingle}
              disabled={!currentGarment || !currentLogo}
            >
              <Download size={14} /> Current
            </button>
            <button
              className="btn-primary px-5 py-2 mono text-[11px] uppercase tracking-widest flex items-center gap-2"
              onClick={exportAll}
              disabled={!garments.length || !currentLogo || exporting}
            >
              <Package size={14} />
              {exporting ? `Packing ${exportProgress}%` : `Export ${garments.length || ''} ZIP`}
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN LAYOUT ─── */}
      <div className="max-w-[1600px] mx-auto px-8 py-6 grid grid-cols-12 gap-6">

        {/* ─── LEFT SIDEBAR: GARMENTS & LOGOS ─── */}
        <aside className="col-span-12 lg:col-span-3 space-y-6">

          {/* Garments panel */}
          <section>
            <div className="rule flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shirt size={14} />
                <h2 className="mono text-[10px] uppercase tracking-[0.25em] font-bold">
                  Garments · {garments.length}
                </h2>
              </div>
              <button
                onClick={() => garmentInput.current.click()}
                className="mono text-[10px] uppercase tracking-widest hover:text-[#E4572E]"
              >
                + Add
              </button>
              <input
                ref={garmentInput} type="file" multiple accept="image/*"
                className="hidden"
                onChange={e => handleGarmentUpload(e.target.files)}
              />
            </div>

            {garments.length === 0 && (
              <div
                className="drop-zone p-6 text-center cursor-pointer"
                onClick={() => garmentInput.current.click()}
              >
                <Upload size={20} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm italic">Drop garment photos</p>
                <p className="mono text-[10px] uppercase tracking-widest opacity-50 mt-1">
                  JPG · PNG · WebP
                </p>
              </div>
            )}

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {garments.map(g => (
                <div
                  key={g.id}
                  className={`thumb cursor-pointer p-2 flex items-center gap-3 ${activeGarment === g.id ? 'active' : ''}`}
                  onClick={() => setActiveGarment(g.id)}
                >
                  <img src={g.url} alt={g.name} className="w-12 h-12 object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{g.name}</div>
                    <select
                      value={g.type}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        const newType = e.target.value;
                        setGarments(prev => prev.map(x => x.id === g.id ? { ...x, type: newType } : x));
                      }}
                      className="mono text-[10px] uppercase tracking-widest border-none outline-none bg-transparent p-0"
                    >
                      {GARMENT_TYPES.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); removeGarment(g.id); }}
                    className="opacity-40 hover:opacity-100 hover:text-[#E4572E]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Logos panel */}
          <section>
            <div className="rule flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ImageIcon size={14} />
                <h2 className="mono text-[10px] uppercase tracking-[0.25em] font-bold">
                  Logos · {logos.length}
                </h2>
              </div>
              <button
                onClick={() => logoInput.current.click()}
                className="mono text-[10px] uppercase tracking-widest hover:text-[#E4572E]"
              >
                + Add
              </button>
              <input
                ref={logoInput} type="file" multiple accept="image/*"
                className="hidden"
                onChange={e => handleLogoUpload(e.target.files)}
              />
            </div>

            {logos.length === 0 && (
              <div
                className="drop-zone p-6 text-center cursor-pointer"
                onClick={() => logoInput.current.click()}
              >
                <Upload size={20} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm italic">Drop your logo</p>
                <p className="mono text-[10px] uppercase tracking-widest opacity-50 mt-1">
                  PNG with transparency
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {logos.map(l => (
                <div
                  key={l.id}
                  className={`thumb relative cursor-pointer aspect-square p-2 canvas-stage ${activeLogo === l.id ? 'active' : ''}`}
                  onClick={() => setActiveLogo(l.id)}
                >
                  <img src={l.url} alt={l.name} className="w-full h-full object-contain" />
                  <button
                    onClick={e => { e.stopPropagation(); removeLogo(l.id); }}
                    className="absolute top-1 right-1 bg-[#1A1714] text-[#F2EDE4] w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    style={{ opacity: 0.8 }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* ─── CENTER: CANVAS ─── */}
        <main className="col-span-12 lg:col-span-6">
          <div className="rule flex items-center justify-between mb-3">
            <h2 className="mono text-[10px] uppercase tracking-[0.25em] font-bold flex items-center gap-2">
              <Target size={14} /> Preview
            </h2>
            {currentGarment && (
              <span className="mono text-[10px] uppercase tracking-widest opacity-60">
                {currentGarment.name}
              </span>
            )}
          </div>

          <div
            className="canvas-stage flex items-center justify-center"
            style={{
              minHeight: '560px',
              border: '1px solid rgba(26,23,20,0.2)',
              padding: '24px',
            }}
          >
            {!currentGarment ? (
              <div className="text-center opacity-50">
                <Shirt size={48} className="mx-auto mb-4" />
                <p className="italic text-lg">Add a garment photo to begin.</p>
                <p className="mono text-[10px] uppercase tracking-widest mt-2">
                  Upload → Select → Place
                </p>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                onMouseDown={onCanvasMouseDown}
                onMouseMove={onCanvasMouseMove}
                onMouseUp={onCanvasMouseUp}
                onMouseLeave={onCanvasMouseUp}
                style={{ cursor: currentLogo ? 'grab' : 'default' }}
              />
            )}
          </div>

          {currentGarment && currentLogo && (
            <p className="mono text-[10px] uppercase tracking-widest opacity-50 mt-3">
              Drag on canvas to reposition · Use controls on the right to refine
            </p>
          )}
        </main>

        {/* ─── RIGHT: CONTROLS ─── */}
        <aside className="col-span-12 lg:col-span-3 space-y-5">
          {!currentGarment || !currentLogo ? (
            <div className="opacity-50">
              <div className="rule mb-3">
                <h2 className="mono text-[10px] uppercase tracking-[0.25em] font-bold flex items-center gap-2">
                  <Sliders size={14} /> Controls
                </h2>
              </div>
              <p className="italic text-sm">
                Add at least one garment and one logo to unlock placement.
              </p>
            </div>
          ) : (
            <>
              {/* Preset zones */}
              <section>
                <div className="rule mb-3">
                  <h3 className="mono text-[10px] uppercase tracking-[0.25em] font-bold">
                    Preset zones · {GARMENT_TYPES.find(t => t.id === currentGarment.type)?.label}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_ZONES[currentGarment.type].map(z => (
                    <button
                      key={z.id}
                      className="zone-btn py-2 px-2"
                      onClick={() => applyPresetZone(z)}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Size */}
              <section>
                <div className="flex items-center justify-between mb-1">
                  <label className="mono text-[10px] uppercase tracking-widest">Size</label>
                  <span className="mono text-[10px]">{Math.round(p.widthPct * 100)}%</span>
                </div>
                <input
                  type="range" className="slider"
                  min={5} max={95} step={1}
                  value={p.widthPct * 100}
                  onChange={e => updatePlacement(currentGarment.id, { widthPct: +e.target.value / 100 })}
                />
              </section>

              {/* Rotation */}
              <section>
                <div className="flex items-center justify-between mb-1">
                  <label className="mono text-[10px] uppercase tracking-widest flex items-center gap-1">
                    <RotateCw size={10} /> Rotate
                  </label>
                  <span className="mono text-[10px]">{p.rotation}°</span>
                </div>
                <input
                  type="range" className="slider"
                  min={-180} max={180} step={1}
                  value={p.rotation}
                  onChange={e => updatePlacement(currentGarment.id, { rotation: +e.target.value })}
                />
                <button
                  className="mono text-[10px] uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-[#E4572E] mt-1"
                  onClick={() => updatePlacement(currentGarment.id, { rotation: 0 })}
                >
                  reset
                </button>
              </section>

              {/* Opacity */}
              <section>
                <div className="flex items-center justify-between mb-1">
                  <label className="mono text-[10px] uppercase tracking-widest">Opacity</label>
                  <span className="mono text-[10px]">{Math.round(p.opacity * 100)}%</span>
                </div>
                <input
                  type="range" className="slider"
                  min={0} max={100} step={1}
                  value={p.opacity * 100}
                  onChange={e => updatePlacement(currentGarment.id, { opacity: +e.target.value / 100 })}
                />
              </section>

              {/* Blend */}
              <section>
                <div className="rule mb-2">
                  <label className="mono text-[10px] uppercase tracking-widest flex items-center gap-1">
                    <Layers size={10} /> Blend Mode
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {BLEND_MODES.map(b => (
                    <button
                      key={b.id}
                      className={`py-1.5 mono text-[9px] uppercase tracking-widest border ${p.blend === b.id ? 'bg-[#1A1714] text-[#F2EDE4] border-[#1A1714]' : 'border-black/25 hover:border-black'}`}
                      onClick={() => updatePlacement(currentGarment.id, { blend: b.id })}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Batch */}
              <section>
                <div className="rule mb-2">
                  <h3 className="mono text-[10px] uppercase tracking-[0.25em] font-bold flex items-center gap-1">
                    <Copy size={12} /> Batch apply
                  </h3>
                </div>
                <button
                  className="btn-ghost w-full py-2 mono text-[10px] uppercase tracking-widest mb-2 flex items-center justify-center gap-2"
                  onClick={applyToAllSameType}
                >
                  Apply to all {GARMENT_TYPES.find(t => t.id === currentGarment.type)?.label}s
                  <ChevronRight size={12} />
                </button>
                <button
                  className="btn-ghost w-full py-2 mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                  onClick={applyToAll}
                >
                  Apply to ALL garments
                  <ChevronRight size={12} />
                </button>
              </section>
            </>
          )}
        </aside>
      </div>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-black/15 mt-10">
        <div className="max-w-[1600px] mx-auto px-8 py-4 flex items-center justify-between mono text-[10px] uppercase tracking-widest opacity-60">
          <span>All compositing happens in your browser · Nothing uploaded</span>
          <span>Phase 01 · Canvas Engine · v0.1</span>
        </div>
      </footer>
    </div>
  );
}
