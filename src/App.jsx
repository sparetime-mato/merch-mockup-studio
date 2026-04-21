import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, X, RotateCw, Copy, Layers, Image as ImageIcon, Shirt, Trash2, ChevronRight, Target, Sliders, Package, Settings, GripVertical, Pencil, Check, Sparkles, Loader2, Eye, EyeOff, Zap } from 'lucide-react';

// ───────────────────────────────────────────────────────────────
// Merch Mockup Studio — Phase 2.0
// + AI harmonization (Replicate / Nano Banana)
// + Compare: Canvas vs AI
// + AI result flows into exports
// ───────────────────────────────────────────────────────────────

// If deployed to Vercel (incl. preview), API is at /api/...
// If running on GitHub Pages (no backend), AI is disabled with a friendly message.
const AI_ENABLED = (() => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  // GitHub Pages doesn't have our backend — disable AI gracefully
  return !host.endsWith('github.io');
})();
const API_BASE = '/api';

const PRESET_ZONES = {
  tshirt: [
    { id: 'chest-center', label: 'Chest',       x: 0.50, y: 0.32, w: 0.22 },
    { id: 'left-chest',   label: 'Left Chest',  x: 0.37, y: 0.30, w: 0.10 },
    { id: 'right-chest',  label: 'Right Chest', x: 0.63, y: 0.30, w: 0.10 },
    { id: 'full-front',   label: 'Full Front',  x: 0.50, y: 0.45, w: 0.48 },
    { id: 'back-center',  label: 'Back',        x: 0.50, y: 0.38, w: 0.40 },
  ],
  hoodie: [
    { id: 'chest-center', label: 'Chest',       x: 0.50, y: 0.34, w: 0.22 },
    { id: 'left-chest',   label: 'Left Chest',  x: 0.38, y: 0.32, w: 0.10 },
    { id: 'right-chest',  label: 'Right Chest', x: 0.62, y: 0.32, w: 0.10 },
    { id: 'hood',         label: 'Hood',        x: 0.50, y: 0.14, w: 0.12 },
    { id: 'back-center',  label: 'Back',        x: 0.50, y: 0.42, w: 0.42 },
  ],
  cap: [
    { id: 'front',  label: 'Front', x: 0.50, y: 0.55, w: 0.28 },
    { id: 'side',   label: 'Side',  x: 0.78, y: 0.52, w: 0.14 },
    { id: 'back',   label: 'Back',  x: 0.50, y: 0.55, w: 0.22 },
  ],
  other: [
    { id: 'center', label: 'Center', x: 0.50, y: 0.50, w: 0.30 },
  ],
};

const GARMENT_TYPES = [
  { id: 'tshirt', label: 'T-Shirt' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'cap',    label: 'Cap' },
  { id: 'other',  label: 'Other' },
];

const GENDERS = [
  { id: 'na',    label: '—',      slug: '' },
  { id: 'men',   label: 'Men',    slug: 'men' },
  { id: 'women', label: 'Women',  slug: 'women' },
  { id: 'kids',  label: 'Kids',   slug: 'kids' },
];

const BLEND_MODES = [
  { id: 'source-over',  label: 'Normal' },
  { id: 'multiply',     label: 'Multiply' },
  { id: 'screen',       label: 'Screen' },
  { id: 'overlay',      label: 'Overlay' },
  { id: 'darken',       label: 'Darken' },
  { id: 'lighten',      label: 'Lighten' },
];

const ALL_TOKENS = [
  { id: 'prefix',    label: 'Prefix' },
  { id: 'gender',    label: 'Gender' },
  { id: 'type',      label: 'Garment Type' },
  { id: 'name',      label: 'Garment Name' },
  { id: 'placement', label: 'Placement' },
  { id: 'index',     label: 'Index' },
];

const DEFAULT_TOKEN_ORDER = [
  { id: 'prefix',    enabled: true  },
  { id: 'gender',    enabled: true  },
  { id: 'type',      enabled: true  },
  { id: 'name',      enabled: true  },
  { id: 'placement', enabled: false },
  { id: 'index',     enabled: true  },
];

const uid = () => Math.random().toString(36).slice(2, 10);

const fileToImage = (file) => new Promise((res, rej) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => res({ img, url, name: file.name });
  img.onerror = rej;
  img.src = url;
});

const loadUrlAsImage = (url) => new Promise((res, rej) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = url;
});

const nameFromFilename = (f) => f.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();

const slugify = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const guessGender = (name) => {
  const n = name.toLowerCase();
  if (/\b(women|womens|woman|female|ladies)\b/.test(n)) return 'women';
  if (/\b(men|mens|man|male)\b/.test(n)) return 'men';
  if (/\b(kids|kid|child|children|youth|boys?|girls?)\b/.test(n)) return 'kids';
  return 'na';
};

const placementZoneId = (type, placement, tolerance = 0.02) => {
  const zones = PRESET_ZONES[type] || [];
  const hit = zones.find(z =>
    Math.abs(z.x - placement.xPct) < tolerance &&
    Math.abs(z.y - placement.yPct) < tolerance &&
    Math.abs(z.w - placement.widthPct) < tolerance
  );
  return hit ? hit.id : 'custom';
};

const buildFilename = ({ tokens, prefix, garment, index, extension = 'png' }) => {
  const placement = placementZoneId(garment.type, garment.placement);
  const values = {
    prefix: slugify(prefix),
    gender: GENDERS.find(g => g.id === garment.gender)?.slug || '',
    type: slugify(garment.type),
    name: slugify(garment.displayName),
    placement: slugify(placement),
    index: String(index + 1).padStart(2, '0'),
  };
  const parts = tokens.filter(t => t.enabled).map(t => values[t.id]).filter(v => v && v.length > 0);
  const stem = parts.join('-') || 'mockup';
  return `${stem}.${extension}`;
};

// Composite a mockup to a high-res PNG data URL (used for export AND as AI input)
const composeMockup = (garment, logoImg, placement, maxDim = null) => {
  const { img } = garment;
  const canvas = document.createElement('canvas');
  let cw = img.naturalWidth, ch = img.naturalHeight;
  if (maxDim && Math.max(cw, ch) > maxDim) {
    const s = maxDim / Math.max(cw, ch);
    cw = Math.round(cw * s); ch = Math.round(ch * s);
  }
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, cw, ch);

  if (logoImg && placement) {
    const { xPct, yPct, widthPct, rotation, opacity, blend, skewX = 0, skewY = 0 } = placement;
    const targetW = widthPct * cw;
    const aspect = logoImg.naturalHeight / logoImg.naturalWidth;
    const targetH = targetW * aspect;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = blend;
    ctx.translate(xPct * cw, yPct * ch);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.transform(1, Math.tan((skewY * Math.PI) / 180), Math.tan((skewX * Math.PI) / 180), 1, 0, 0);
    ctx.drawImage(logoImg, -targetW / 2, -targetH / 2, targetW, targetH);
    ctx.restore();
  }
  return canvas.toDataURL('image/png');
};

// Minimal ZIP (STORE)
const buildZip = async (files) => {
  const encoder = new TextEncoder();
  const fileEntries = [];
  const centralEntries = [];
  let offset = 0;
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    } return t;
  })();
  const crc32 = (buf) => { let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const data = f.data; const crc = crc32(data); const size = data.length;
    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true); dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, size, true); dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true); dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    fileEntries.push(local, data);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralEntries.push(central);
    offset += local.length + data.length;
  }
  const centralStart = offset;
  let centralSize = 0; centralEntries.forEach(e => centralSize += e.length);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, centralStart, true);
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

// Call our Vercel /api/harmonize endpoint
const callHarmonize = async (compositeDataUrl, customPrompt = null) => {
  const res = await fetch(`${API_BASE}/harmonize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compositeImage: compositeDataUrl,
      prompt: customPrompt,
    }),
  });
  const data = await res.json();
  if (res.ok && data.outputUrl) return data.outputUrl;
  if (res.status === 202 && data.predictionId) {
    // Poll until done (max ~120s)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pr = await fetch(`${API_BASE}/poll?id=${data.predictionId}`);
      const pd = await pr.json();
      if (pr.ok && pd.outputUrl) return pd.outputUrl;
      if (pd.status === 'failed' || pd.status === 'canceled') {
        throw new Error(pd.error || `Prediction ${pd.status}`);
      }
    }
    throw new Error('Timed out waiting for AI result');
  }
  throw new Error(data.error || `AI request failed (${res.status})`);
};

// Fetch a remote URL and convert to data URL (so AI result can be exported in ZIP)
const urlToDataUrl = async (url) => {
  const r = await fetch(url);
  const blob = await r.blob();
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
};

// ───────────────────────────────────────────────────────────────

export default function App() {
  const [garments, setGarments] = useState([]);
  const [logos, setLogos] = useState([]);
  const [activeLogo, setActiveLogo] = useState(null);
  const [activeGarment, setActiveGarment] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [filenamePrefix, setFilenamePrefix] = useState('my-brand');
  const [tokens, setTokens] = useState(DEFAULT_TOKEN_ORDER);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [editingName, setEditingName] = useState(null);
  const [tokenDragIndex, setTokenDragIndex] = useState(null);

  // AI state
  const [aiBusy, setAiBusy] = useState(false);          // harmonizing current garment
  const [aiBatchBusy, setAiBatchBusy] = useState(false); // harmonizing all garments
  const [aiBatchProgress, setAiBatchProgress] = useState(0);
  const [aiError, setAiError] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const garmentInput = useRef();
  const logoInput = useRef();
  const canvasRef = useRef();
  const stageRef = useRef();
  const interaction = useRef(null);

  const currentGarment = garments.find(g => g.id === activeGarment);
  const currentLogo = logos.find(l => l.id === activeLogo);

  const handleGarmentUpload = async (files) => {
    const loaded = await Promise.all(Array.from(files).map(fileToImage));
    const newOnes = loaded.map(l => ({
      ...l,
      id: uid(),
      type: guessType(l.name),
      gender: guessGender(l.name),
      displayName: nameFromFilename(l.name),
      placement: { xPct: 0.5, yPct: 0.32, widthPct: 0.22, rotation: 0, opacity: 1, blend: 'source-over', skewX: 0, skewY: 0 },
      aiResult: null,      // data URL of AI-harmonized version, once generated
      useAiForExport: true, // if AI result exists, use it in ZIP
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

  // When placement changes, the AI result is stale — discard it
  const updatePlacement = (garmentId, patch) => {
    setGarments(prev => prev.map(g => g.id === garmentId
      ? { ...g, placement: { ...g.placement, ...patch }, aiResult: null }
      : g));
  };
  const updateGarment = (garmentId, patch) => {
    setGarments(prev => prev.map(g => g.id === garmentId ? { ...g, ...patch } : g));
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
      g.type === currentGarment.type ? { ...g, placement: { ...p }, aiResult: null } : g));
  };
  const applyToAll = () => {
    if (!currentGarment) return;
    const p = currentGarment.placement;
    setGarments(prev => prev.map(g => ({ ...g, placement: { ...p }, aiResult: null })));
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

  // Token reordering
  const onTokenDragStart = (i) => setTokenDragIndex(i);
  const onTokenDragOver = (e, i) => {
    e.preventDefault();
    if (tokenDragIndex === null || tokenDragIndex === i) return;
    setTokens(prev => {
      const next = [...prev];
      const [item] = next.splice(tokenDragIndex, 1);
      next.splice(i, 0, item);
      return next;
    });
    setTokenDragIndex(i);
  };
  const onTokenDragEnd = () => setTokenDragIndex(null);
  const toggleToken = (id) => setTokens(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));

  // ──────── AI harmonization ────────
  const harmonizeCurrent = async () => {
    if (!currentGarment || !currentLogo) return;
    setAiBusy(true); setAiError(null);
    try {
      const compositeDataUrl = composeMockup(currentGarment, currentLogo.img, currentGarment.placement, 1536);
      const resultUrl = await callHarmonize(compositeDataUrl, aiPrompt || null);
      const dataUrl = await urlToDataUrl(resultUrl);
      setGarments(prev => prev.map(g => g.id === currentGarment.id
        ? { ...g, aiResult: dataUrl, useAiForExport: true }
        : g));
      setCompareOpen(true);
    } catch (err) {
      setAiError(err.message || String(err));
    } finally {
      setAiBusy(false);
    }
  };

  const harmonizeAll = async () => {
    if (!garments.length || !currentLogo) return;
    setAiBatchBusy(true); setAiBatchProgress(0); setAiError(null);
    try {
      for (let i = 0; i < garments.length; i++) {
        const g = garments[i];
        if (g.aiResult) { // skip already harmonized
          setAiBatchProgress(Math.round(((i + 1) / garments.length) * 100));
          continue;
        }
        try {
          const composite = composeMockup(g, currentLogo.img, g.placement, 1536);
          const resultUrl = await callHarmonize(composite, aiPrompt || null);
          const dataUrl = await urlToDataUrl(resultUrl);
          setGarments(prev => prev.map(x => x.id === g.id
            ? { ...x, aiResult: dataUrl, useAiForExport: true } : x));
        } catch (err) {
          console.error(`Harmonize failed for ${g.displayName}:`, err);
          // Continue with the rest instead of aborting the whole batch
        }
        setAiBatchProgress(Math.round(((i + 1) / garments.length) * 100));
      }
    } finally {
      setAiBatchBusy(false); setAiBatchProgress(0);
    }
  };

  const acceptAi = () => { setCompareOpen(false); };
  const rejectAi = () => {
    if (!currentGarment) return;
    updateGarment(currentGarment.id, { aiResult: null });
    setCompareOpen(false);
  };
  const toggleAiForExport = (id) => {
    setGarments(prev => prev.map(g => g.id === id
      ? { ...g, useAiForExport: !g.useAiForExport } : g));
  };

  // ──────── Canvas rendering ────────
  const HANDLE_SIZE = 10;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentGarment) return;
    const ctx = canvas.getContext('2d');
    const { img } = currentGarment;

    const parent = stageRef.current;
    const maxW = parent.clientWidth - 48;
    const maxH = parent.clientHeight - 48;
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
      ctx.transform(1, Math.tan((p.skewY * Math.PI) / 180), Math.tan((p.skewX * Math.PI) / 180), 1, 0, 0);
      ctx.drawImage(currentLogo.img, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.restore();

      ctx.save();
      ctx.translate(p.xPct * w, p.yPct * h);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(-targetW / 2, -targetH / 2, targetW, targetH);
      ctx.setLineDash([]);

      const handles = [
        [-targetW / 2, -targetH / 2], [ targetW / 2, -targetH / 2],
        [-targetW / 2,  targetH / 2], [ targetW / 2,  targetH / 2],
      ];
      handles.forEach(([hx, hy]) => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(hx - HANDLE_SIZE/2, hy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
        ctx.strokeRect(hx - HANDLE_SIZE/2, hy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
      });

      const rotY = -targetH / 2 - 28;
      ctx.beginPath(); ctx.moveTo(0, -targetH / 2); ctx.lineTo(0, rotY);
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, rotY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.strokeStyle = '#000000'; ctx.stroke();
      ctx.restore();
    }
  }, [currentGarment, currentLogo, garments]);

  useEffect(() => {
    const onResize = () => setGarments(g => [...g]);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Canvas interactions
  const getMouse = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      cx: (e.clientX - rect.left) * (canvas.width / rect.width),
      cy: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const hitTest = (cx, cy) => {
    if (!currentGarment || !currentLogo) return null;
    const canvas = canvasRef.current;
    const w = canvas.width, h = canvas.height;
    const p = currentGarment.placement;
    const targetW = p.widthPct * w;
    const aspect = currentLogo.img.naturalHeight / currentLogo.img.naturalWidth;
    const targetH = targetW * aspect;
    const rot = (p.rotation * Math.PI) / 180;
    const dx = cx - p.xPct * w; const dy = cy - p.yPct * h;
    const cos = Math.cos(-rot), sin = Math.sin(-rot);
    const lx = dx * cos - dy * sin; const ly = dx * sin + dy * cos;
    const rotY = -targetH / 2 - 28;
    if (Math.hypot(lx - 0, ly - rotY) < 10) return 'rotate';
    const corners = [
      [-targetW/2, -targetH/2, 'nw'], [ targetW/2, -targetH/2, 'ne'],
      [-targetW/2,  targetH/2, 'sw'], [ targetW/2,  targetH/2, 'se'],
    ];
    for (const [hx, hy, dir] of corners) {
      if (Math.abs(lx - hx) <= HANDLE_SIZE && Math.abs(ly - hy) <= HANDLE_SIZE) return `corner-${dir}`;
    }
    if (Math.abs(lx) <= targetW/2 && Math.abs(ly) <= targetH/2) return 'move';
    return null;
  };

  const onCanvasMouseDown = (e) => {
    if (!currentGarment || !currentLogo) return;
    const { cx, cy } = getMouse(e);
    const hit = hitTest(cx, cy);
    if (!hit) return;
    interaction.current = { mode: hit, startCx: cx, startCy: cy, startPlacement: { ...currentGarment.placement } };
  };

  const onCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentGarment) return;
    const { cx, cy } = getMouse(e);
    if (!interaction.current && currentLogo) {
      const hit = hitTest(cx, cy);
      if (hit === 'move') canvas.style.cursor = 'grab';
      else if (hit === 'rotate') canvas.style.cursor = 'crosshair';
      else if (hit && hit.startsWith('corner-')) {
        const dir = hit.slice(7);
        canvas.style.cursor = (dir === 'nw' || dir === 'se') ? 'nwse-resize' : 'nesw-resize';
      } else canvas.style.cursor = 'default';
    }
    if (!interaction.current) return;
    const { mode, startCx, startCy, startPlacement } = interaction.current;
    const w = canvas.width, h = canvas.height;
    if (mode === 'move') {
      const dx = (cx - startCx) / w; const dy = (cy - startCy) / h;
      updatePlacement(currentGarment.id, {
        xPct: Math.max(0, Math.min(1, startPlacement.xPct + dx)),
        yPct: Math.max(0, Math.min(1, startPlacement.yPct + dy)),
      });
    } else if (mode === 'rotate') {
      const centerX = startPlacement.xPct * w; const centerY = startPlacement.yPct * h;
      const angle = Math.atan2(cy - centerY, cx - centerX) * 180 / Math.PI;
      let newRot = angle + 90;
      if (newRot > 180) newRot -= 360; if (newRot < -180) newRot += 360;
      updatePlacement(currentGarment.id, { rotation: Math.round(newRot) });
    } else if (mode.startsWith('corner-')) {
      const centerX = startPlacement.xPct * w; const centerY = startPlacement.yPct * h;
      const d0 = Math.hypot(startCx - centerX, startCy - centerY);
      const d1 = Math.hypot(cx - centerX, cy - centerY);
      if (d0 > 2) {
        const ratio = d1 / d0;
        const newW = Math.max(0.03, Math.min(0.98, startPlacement.widthPct * ratio));
        updatePlacement(currentGarment.id, { widthPct: newW });
      }
    }
  };
  const onCanvasMouseUp = () => { interaction.current = null; };

  // ──────── Export ────────
  const getExportDataUrl = (g) => {
    if (g.useAiForExport && g.aiResult) return g.aiResult;
    return composeMockup(g, currentLogo.img, g.placement);
  };

  const exportSingle = () => {
    if (!currentGarment || !currentLogo) return;
    const dataUrl = getExportDataUrl(currentGarment);
    const filename = buildFilename({
      tokens, prefix: filenamePrefix, garment: currentGarment,
      index: garments.findIndex(g => g.id === currentGarment.id),
    });
    const a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click();
  };

  const exportAll = async () => {
    if (!garments.length || !currentLogo) return;
    setExporting(true); setExportProgress(0);
    const files = [];
    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const dataUrl = getExportDataUrl(g);
      const filename = buildFilename({ tokens, prefix: filenamePrefix, garment: g, index: i });
      files.push({ name: filename, data: dataUrlToBytes(dataUrl) });
      setExportProgress(Math.round(((i + 1) / garments.length) * 100));
      await new Promise(r => setTimeout(r, 10));
    }
    const zip = await buildZip(files);
    const url = URL.createObjectURL(zip);
    const a = document.createElement('a'); a.href = url;
    a.download = `${slugify(filenamePrefix) || 'mockups'}-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false); setExportProgress(0);
  };

  const p = currentGarment?.placement;

  const previewFilename = currentGarment
    ? buildFilename({ tokens, prefix: filenamePrefix, garment: currentGarment,
        index: garments.findIndex(g => g.id === currentGarment.id) })
    : '';
  const previewPattern = tokens.filter(t => t.enabled).map(t => t.id).join('-') || 'mockup';

  const aiReadyCount = garments.filter(g => g.aiResult).length;

  return (
    <div className="min-h-screen w-full bg-white text-black"
      style={{ fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
        .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500; color: #000; }
        .label-muted { color: #666; }
        .hairline { border-top: 1px solid #E5E5E5; }
        .btn { padding: 8px 14px; font-size: 12px; font-weight: 500; transition: all 120ms ease; cursor: pointer; letter-spacing: 0.02em; border-radius: 0; }
        .btn-primary { background: #000; color: #fff; border: 1px solid #000; }
        .btn-primary:hover:not(:disabled) { background: #333; border-color: #333; }
        .btn-primary:disabled { background: #CCC; border-color: #CCC; cursor: not-allowed; }
        .btn-ghost { background: #fff; color: #000; border: 1px solid #000; }
        .btn-ghost:hover:not(:disabled) { background: #000; color: #fff; }
        .btn-ghost:disabled { border-color: #CCC; color: #CCC; cursor: not-allowed; }
        .btn-ai { background: #fff; color: #000; border: 1px solid #000; position: relative; }
        .btn-ai:hover:not(:disabled) { background: #000; color: #fff; }
        .btn-ai:disabled { border-color: #CCC; color: #CCC; cursor: not-allowed; }
        .btn-text { background: transparent; border: none; padding: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500; cursor: pointer; color: #000; }
        .btn-text:hover { text-decoration: underline; text-underline-offset: 3px; }
        .thumb { border: 1px solid #E5E5E5; transition: all 150ms; background: #fff; position: relative; }
        .thumb:hover { border-color: #000; }
        .thumb.active { border-color: #000; border-width: 2px; }
        .zone-btn { background: #fff; color: #000; border: 1px solid #E5E5E5; transition: all 120ms; font-size: 11px; padding: 8px 6px; font-weight: 500; cursor: pointer; }
        .zone-btn:hover { border-color: #000; background: #F7F7F7; }
        .zone-btn.active { background: #000; color: #fff; border-color: #000; }
        .slider { -webkit-appearance: none; appearance: none; background: transparent; width: 100%; height: 22px; }
        .slider::-webkit-slider-runnable-track { height: 1px; background: #000; }
        .slider::-moz-range-track { height: 1px; background: #000; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; background: #000; margin-top: -7px; cursor: grab; border-radius: 50%; border: none; }
        .slider::-moz-range-thumb { width: 14px; height: 14px; background: #000; cursor: grab; border-radius: 50%; border: none; }
        .drop-zone { border: 1px dashed #CCC; transition: all 150ms; cursor: pointer; background: #FAFAFA; }
        .drop-zone:hover { border-color: #000; background: #F2F2F2; }
        .canvas-stage { background-color: #FAFAFA;
          background-image: linear-gradient(#EEE 1px, transparent 1px), linear-gradient(90deg, #EEE 1px, transparent 1px);
          background-size: 20px 20px; }
        input[type="text"], textarea { width: 100%; padding: 8px 10px; border: 1px solid #E5E5E5; background: #fff; font-size: 13px; font-family: inherit; border-radius: 0; outline: none; transition: border-color 120ms; }
        input[type="text"]:focus, textarea:focus { border-color: #000; }
        .inline-edit { padding: 2px 4px !important; font-size: 13px !important; border: 1px solid #000 !important; }
        select { background: transparent; font-family: inherit; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; border: none; outline: none; padding: 0; cursor: pointer; }
        .mono { font-family: 'SF Mono', ui-monospace, Menlo, monospace; }
        .token-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid #E5E5E5; background: #fff; margin-bottom: 4px; cursor: grab; user-select: none; transition: border-color 120ms, background 120ms; }
        .token-row:hover { border-color: #000; } .token-row.disabled { opacity: 0.5; background: #FAFAFA; }
        .token-row.dragging { opacity: 0.3; } .token-row:active { cursor: grabbing; }
        .token-checkbox { width: 14px; height: 14px; border: 1px solid #000; display: inline-flex; align-items: center; justify-content: center; background: #fff; }
        .token-checkbox.checked { background: #000; color: #fff; }
        .ai-badge { position: absolute; top: 4px; left: 4px; width: 18px; height: 18px; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; z-index: 2; }
        .ai-toggle { position: absolute; bottom: 4px; left: 4px; background: #fff; border: 1px solid #000; padding: 2px 6px; font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; z-index: 2; }
        .ai-toggle.off { background: transparent; color: #666; border-color: #CCC; }
        .spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 24px; }
        .modal { background: #fff; max-width: 1400px; width: 100%; max-height: 90vh; overflow: auto; }
        .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: #000; }
        .compare-cell { background: #FAFAFA; padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .compare-cell img { max-width: 100%; max-height: 60vh; object-fit: contain; display: block; }
        .ai-banner { background: #FFF8E1; border: 1px solid #F2D97B; padding: 10px 14px; font-size: 13px; display: flex; align-items: center; gap: 10px; }
        .error-banner { background: #FFEAEA; border: 1px solid #F2A0A0; padding: 10px 14px; font-size: 13px; }
      `}</style>

      {/* HEADER */}
      <header className="border-b border-black/10">
        <div className="max-w-[1600px] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-black" />
              <h1 className="text-lg font-semibold tracking-tight">Merch Mockup Studio</h1>
            </div>
            <span className="label label-muted hidden md:inline">Phase 02 / Canvas + AI</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost flex items-center gap-2"
              onClick={() => setShowExportPanel(s => !s)}
            >
              <Settings size={13} /> Settings
            </button>
            {AI_ENABLED && (
              <>
                <button
                  className="btn btn-ai flex items-center gap-2"
                  onClick={harmonizeCurrent}
                  disabled={!currentGarment || !currentLogo || aiBusy || aiBatchBusy}
                  title="AI-harmonize the current garment"
                >
                  {aiBusy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                  {aiBusy ? 'Harmonizing…' : 'Harmonize'}
                </button>
                <button
                  className="btn btn-ai flex items-center gap-2"
                  onClick={harmonizeAll}
                  disabled={!garments.length || !currentLogo || aiBusy || aiBatchBusy}
                  title="AI-harmonize all garments"
                >
                  {aiBatchBusy ? <Loader2 size={13} className="spin" /> : <Zap size={13} />}
                  {aiBatchBusy ? `${aiBatchProgress}%` : 'Harmonize All'}
                </button>
              </>
            )}
            <button
              className="btn btn-ghost flex items-center gap-2"
              onClick={exportSingle}
              disabled={!currentGarment || !currentLogo}
            >
              <Download size={13} /> Current
            </button>
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={exportAll}
              disabled={!garments.length || !currentLogo || exporting}
            >
              <Package size={13} />
              {exporting ? `${exportProgress}%` : `Export ${garments.length || 0} as ZIP`}
            </button>
          </div>
        </div>

        {showExportPanel && (
          <div className="border-t border-black/10 bg-[#FAFAFA]">
            <div className="max-w-[1600px] mx-auto px-8 py-6 grid grid-cols-12 gap-6">
              <div className="col-span-12 md:col-span-3">
                <label className="label block mb-2">Filename prefix</label>
                <input type="text" value={filenamePrefix} onChange={e => setFilenamePrefix(e.target.value)} placeholder="my-brand" />
                <p className="text-xs text-black/50 mt-1.5">Used as the <code>prefix</code> token (if enabled).</p>
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="label block mb-2">Filename tokens · drag to reorder</label>
                <div>
                  {tokens.map((t, i) => (
                    <div key={t.id}
                      className={`token-row ${!t.enabled ? 'disabled' : ''} ${tokenDragIndex === i ? 'dragging' : ''}`}
                      draggable onDragStart={() => onTokenDragStart(i)} onDragOver={(e) => onTokenDragOver(e, i)} onDragEnd={onTokenDragEnd}>
                      <GripVertical size={13} className="opacity-40" />
                      <button onClick={() => toggleToken(t.id)} className={`token-checkbox ${t.enabled ? 'checked' : ''}`}>
                        {t.enabled && <Check size={10} strokeWidth={3} />}
                      </button>
                      <span className="text-sm flex-1">{ALL_TOKENS.find(a => a.id === t.id).label}</span>
                      <span className="mono text-xs text-black/40">{`{${t.id}}`}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="label block mb-2">Preview</label>
                <div className="mono text-xs p-3 border border-black/10 bg-white break-all mb-2">{previewPattern}.png</div>
                <label className="label block mb-2 mt-4">Current garment</label>
                <div className="mono text-xs p-3 border border-black/10 bg-white break-all">
                  {previewFilename || <span className="text-black/40">No garment selected</span>}
                </div>
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="label block mb-2">AI prompt (optional)</label>
                <textarea rows={5} value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Leave empty to use the default harmonization prompt. Override with your own instructions if needed." />
                <p className="text-xs text-black/50 mt-1.5">Used by Harmonize and Harmonize All.</p>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* GitHub Pages notice */}
      {!AI_ENABLED && (
        <div className="ai-banner max-w-[1600px] mx-auto mt-4 mx-8">
          <Sparkles size={14} />
          <span>AI harmonization is disabled on GitHub Pages (no backend). Deploy to Vercel to enable it — see README.</span>
        </div>
      )}
      {aiError && (
        <div className="error-banner max-w-[1600px] mx-auto mt-4 mx-8">
          <strong>AI error:</strong> {aiError}
          <button className="btn-text ml-3" onClick={() => setAiError(null)}>dismiss</button>
        </div>
      )}

      {/* MAIN */}
      <div className="max-w-[1600px] mx-auto px-8 py-6 grid grid-cols-12 gap-6">
        {/* LEFT */}
        <aside className="col-span-12 lg:col-span-3 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shirt size={13} />
                <h2 className="label">Garments · {garments.length} {aiReadyCount > 0 && <span className="label-muted ml-1">· {aiReadyCount} AI</span>}</h2>
              </div>
              <button onClick={() => garmentInput.current.click()} className="btn-text">+ Add</button>
              <input ref={garmentInput} type="file" multiple accept="image/*" className="hidden"
                onChange={e => handleGarmentUpload(e.target.files)} />
            </div>

            {garments.length === 0 && (
              <div className="drop-zone p-8 text-center" onClick={() => garmentInput.current.click()}>
                <Upload size={18} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Drop garment photos</p>
                <p className="label label-muted mt-1">JPG · PNG · WEBP</p>
              </div>
            )}

            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {garments.map(g => (
                <div key={g.id}
                  className={`thumb cursor-pointer p-2 flex items-start gap-3 ${activeGarment === g.id ? 'active' : ''}`}
                  onClick={() => setActiveGarment(g.id)}>
                  <div className="relative flex-shrink-0">
                    <img src={g.aiResult && g.useAiForExport ? g.aiResult : g.url} alt={g.displayName} className="w-12 h-12 object-cover" />
                    {g.aiResult && (
                      <div className="absolute top-0 left-0 w-4 h-4 bg-black text-white flex items-center justify-center">
                        <Sparkles size={9} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingName === g.id ? (
                      <input type="text" className="inline-edit" value={g.displayName} autoFocus
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateGarment(g.id, { displayName: e.target.value })}
                        onBlur={() => setEditingName(null)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(null); }} />
                    ) : (
                      <div className="text-sm truncate flex items-center gap-1 group"
                        onClick={e => { e.stopPropagation(); setEditingName(g.id); }} title="Click to rename">
                        <span className="truncate">{g.displayName}</span>
                        <Pencil size={10} className="opacity-0 group-hover:opacity-40 flex-shrink-0" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <select value={g.type} onClick={e => e.stopPropagation()}
                        onChange={e => updateGarment(g.id, { type: e.target.value })}>
                        {GARMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <span className="text-black/20">·</span>
                      <select value={g.gender} onClick={e => e.stopPropagation()}
                        onChange={e => updateGarment(g.id, { gender: e.target.value })}>
                        {GENDERS.map(ge => <option key={ge.id} value={ge.id}>{ge.label}</option>)}
                      </select>
                    </div>
                    {g.aiResult && (
                      <button className="btn-text mt-1 flex items-center gap-1"
                        onClick={e => { e.stopPropagation(); toggleAiForExport(g.id); }}
                        title={g.useAiForExport ? 'Currently using AI version — click to use Canvas' : 'Currently using Canvas — click to use AI'}>
                        {g.useAiForExport ? <><Eye size={10}/> AI</> : <><EyeOff size={10}/> Canvas</>}
                      </button>
                    )}
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeGarment(g.id); }}
                    className="opacity-30 hover:opacity-100 flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ImageIcon size={13} />
                <h2 className="label">Logos · {logos.length}</h2>
              </div>
              <button onClick={() => logoInput.current.click()} className="btn-text">+ Add</button>
              <input ref={logoInput} type="file" multiple accept="image/*" className="hidden"
                onChange={e => handleLogoUpload(e.target.files)} />
            </div>

            {logos.length === 0 && (
              <div className="drop-zone p-8 text-center" onClick={() => logoInput.current.click()}>
                <Upload size={18} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Drop your logo</p>
                <p className="label label-muted mt-1">PNG (transparent)</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {logos.map(l => (
                <div key={l.id}
                  className={`thumb relative cursor-pointer aspect-square p-2 ${activeLogo === l.id ? 'active' : ''}`}
                  style={{ backgroundImage: 'linear-gradient(45deg, #F2F2F2 25%, transparent 25%), linear-gradient(-45deg, #F2F2F2 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #F2F2F2 75%), linear-gradient(-45deg, transparent 75%, #F2F2F2 75%)',
                    backgroundSize: '10px 10px', backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0' }}
                  onClick={() => setActiveLogo(l.id)}>
                  <img src={l.url} alt={l.name} className="w-full h-full object-contain" />
                  <button onClick={e => { e.stopPropagation(); removeLogo(l.id); }}
                    className="absolute top-1 right-1 bg-black text-white w-5 h-5 flex items-center justify-center">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* CENTER */}
        <main className="col-span-12 lg:col-span-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="label flex items-center gap-2">
              <Target size={13} /> Preview
              {currentGarment?.aiResult && (
                <button className="btn-text flex items-center gap-1" onClick={() => setCompareOpen(true)}>
                  <Sparkles size={10} /> compare
                </button>
              )}
            </h2>
            {currentGarment && (
              <span className="label label-muted truncate max-w-[60%]">{currentGarment.displayName}</span>
            )}
          </div>

          <div ref={stageRef} className="canvas-stage flex items-center justify-center border border-black/10"
            style={{ minHeight: '620px', padding: '24px' }}>
            {!currentGarment ? (
              <div className="text-center text-black/40">
                <Shirt size={40} className="mx-auto mb-4" strokeWidth={1} />
                <p className="text-sm">Add a garment photo to begin</p>
              </div>
            ) : (
              <canvas ref={canvasRef}
                onMouseDown={onCanvasMouseDown} onMouseMove={onCanvasMouseMove}
                onMouseUp={onCanvasMouseUp} onMouseLeave={onCanvasMouseUp}
                style={{ cursor: 'default' }} />
            )}
          </div>

          {currentGarment && currentLogo && (
            <p className="label label-muted mt-3">
              Drag to move · Drag corners to resize · Drag top circle to rotate
              {AI_ENABLED && ' · Hit "Harmonize" to blend with AI'}
            </p>
          )}
        </main>

        {/* RIGHT */}
        <aside className="col-span-12 lg:col-span-3 space-y-6">
          {!currentGarment || !currentLogo ? (
            <div className="text-black/40">
              <h2 className="label mb-3 text-black flex items-center gap-2"><Sliders size={13} /> Controls</h2>
              <p className="text-sm">Add at least one garment and one logo to unlock placement.</p>
            </div>
          ) : (
            <>
              <section>
                <h3 className="label mb-3">Preset zones — {GARMENT_TYPES.find(t => t.id === currentGarment.type)?.label}</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_ZONES[currentGarment.type].map(z => {
                    const isActive = placementZoneId(currentGarment.type, p) === z.id;
                    return <button key={z.id} className={`zone-btn ${isActive ? 'active' : ''}`}
                      onClick={() => applyPresetZone(z)}>{z.label}</button>;
                  })}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-1">
                  <label className="label">Size</label>
                  <span className="label label-muted">{Math.round(p.widthPct * 100)}%</span>
                </div>
                <input type="range" className="slider" min={3} max={98} step={1} value={p.widthPct * 100}
                  onChange={e => updatePlacement(currentGarment.id, { widthPct: +e.target.value / 100 })} />
              </section>

              <section>
                <div className="flex items-center justify-between mb-1">
                  <label className="label flex items-center gap-1"><RotateCw size={10} /> Rotate</label>
                  <span className="label label-muted">{p.rotation}°</span>
                </div>
                <input type="range" className="slider" min={-180} max={180} step={1} value={p.rotation}
                  onChange={e => updatePlacement(currentGarment.id, { rotation: +e.target.value })} />
                <button className="btn-text label-muted mt-1"
                  onClick={() => updatePlacement(currentGarment.id, { rotation: 0 })}>Reset</button>
              </section>

              <section>
                <div className="flex items-center justify-between mb-1">
                  <label className="label">Skew X</label>
                  <span className="label label-muted">{p.skewX || 0}°</span>
                </div>
                <input type="range" className="slider" min={-45} max={45} step={1} value={p.skewX || 0}
                  onChange={e => updatePlacement(currentGarment.id, { skewX: +e.target.value })} />
              </section>

              <section>
                <div className="flex items-center justify-between mb-1">
                  <label className="label">Skew Y</label>
                  <span className="label label-muted">{p.skewY || 0}°</span>
                </div>
                <input type="range" className="slider" min={-45} max={45} step={1} value={p.skewY || 0}
                  onChange={e => updatePlacement(currentGarment.id, { skewY: +e.target.value })} />
                <button className="btn-text label-muted mt-1"
                  onClick={() => updatePlacement(currentGarment.id, { skewX: 0, skewY: 0 })}>Reset skew</button>
              </section>

              <section>
                <div className="flex items-center justify-between mb-1">
                  <label className="label">Opacity</label>
                  <span className="label label-muted">{Math.round(p.opacity * 100)}%</span>
                </div>
                <input type="range" className="slider" min={0} max={100} step={1} value={p.opacity * 100}
                  onChange={e => updatePlacement(currentGarment.id, { opacity: +e.target.value / 100 })} />
              </section>

              <section>
                <label className="label flex items-center gap-1 mb-2"><Layers size={10} /> Blend Mode</label>
                <div className="grid grid-cols-3 gap-1">
                  {BLEND_MODES.map(b => (
                    <button key={b.id} className={`zone-btn ${p.blend === b.id ? 'active' : ''}`}
                      onClick={() => updatePlacement(currentGarment.id, { blend: b.id })}>{b.label}</button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="label mb-2 flex items-center gap-1"><Copy size={11} /> Batch apply</h3>
                <button className="btn btn-ghost w-full mb-1.5 flex items-center justify-center gap-2"
                  onClick={applyToAllSameType}>
                  <span>All {GARMENT_TYPES.find(t => t.id === currentGarment.type)?.label}s</span>
                  <ChevronRight size={12} />
                </button>
                <button className="btn btn-ghost w-full flex items-center justify-center gap-2" onClick={applyToAll}>
                  <span>Every garment</span><ChevronRight size={12} />
                </button>
              </section>
            </>
          )}
        </aside>
      </div>

      {/* COMPARE MODAL */}
      {compareOpen && currentGarment?.aiResult && (
        <div className="modal-overlay" onClick={() => setCompareOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between border-b border-black/10">
              <h3 className="label flex items-center gap-2"><Sparkles size={13} /> Compare · {currentGarment.displayName}</h3>
              <button onClick={() => setCompareOpen(false)} className="btn-text">close ✕</button>
            </div>
            <div className="compare-grid">
              <div className="compare-cell">
                <span className="label">Canvas (flat overlay)</span>
                <img src={composeMockup(currentGarment, currentLogo.img, currentGarment.placement, 1200)} alt="Canvas" />
                <button className="btn btn-ghost" onClick={rejectAi}>Keep Canvas</button>
              </div>
              <div className="compare-cell">
                <span className="label flex items-center gap-1"><Sparkles size={11} /> AI harmonized</span>
                <img src={currentGarment.aiResult} alt="AI" />
                <button className="btn btn-primary" onClick={acceptAi}>Keep AI</button>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-black/10 flex items-center justify-between text-xs text-black/60">
              <span>Tip: edit placement on canvas → regenerate to refine.</span>
              <button className="btn btn-ghost" onClick={async () => { setCompareOpen(false); await harmonizeCurrent(); }} disabled={aiBusy}>
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="hairline mt-10">
        <div className="max-w-[1600px] mx-auto px-8 py-5 flex items-center justify-between label label-muted">
          <span>All placement runs in your browser. AI calls go through your Vercel proxy.</span>
          <span>v0.4 · Canvas + AI</span>
        </div>
      </footer>
    </div>
  );
}
