/**
 * AI Interior Designer — Frontend App
 * =====================================
 * Warm UI redesign · INR currency · Smooth transitions
 */

'use strict';

// ─────────────────────────────────────────────────────
// 1. STATE
// ─────────────────────────────────────────────────────

const state = {
  originalImage: null,
  selectedStyle: null,
  generatedImages: [],
  selectedImage: null,
  recommendations: [],
  products: [],
  totalCost: 0,
  wallColor: '#F5F0E8',
  favorites: JSON.parse(localStorage.getItem('ai-interior-favorites') || '[]'),
  showingFavorites: false,
};

const STYLE_ICONS = { modern:'⚡', minimal:'✨', traditional:'🏛️', luxury:'💎' };

const AI_INSIGHTS = {
  modern:      ["Asymmetric balance and strong geometric forms create dynamic visual tension within this space.", "The interplay of matte and gloss surfaces is the signature move that makes modern interiors feel curated, not cold.", "Negative space is used as actively as furniture — the emptiness itself is part of the composition."],
  minimal:     ["Every element earns its place — intentional restraint for maximum visual peace.", "Tonal harmony across surfaces creates a meditative quality that makes the space feel expansive.", "It is the absence of clutter that makes each carefully chosen piece feel precious."],
  traditional: ["Symmetry and proportion create a room that feels perfectly balanced from every angle.", "Rich patinas and heritage materials tell a story of craftsmanship that modern styles often lack.", "Layering wood tones, textiles and metals creates a warmth that invites long, unhurried conversations."],
  luxury:      ["Bespoke details and rare materials make every surface communicate quiet exclusivity.", "The contrast between dramatic and intimate scales creates a sense of theatrical grandeur.", "True luxury is achieved through restraint — fewer pieces, each of extraordinary quality."],
};

const COLOR_NAMES = {
  '#F5F0E8':'Warm Linen','#EDE4D5':'Sand Dune','#D9C9B0':'Oat','#B8A898':'Stone','#8B7B6B':'Taupe',
  '#FAFAF8':'Pure White','#F0EEE9':'Cream','#D4C5B0':'Desert','#A8A196':'Fog','#7C7269':'Driftwood',
  '#F4ECD8':'Antique Ivory','#DEB48C':'Terracotta Light','#8B4513':'Saddle Brown','#2F4F4F':'Dark Teal','#800020':'Burgundy',
  '#1A1A2E':'Midnight','#16213E':'Deep Ocean','#C9A96E':'Champagne','#8B7355':'Khaki','#2C1810':'Espresso',
};

const API = 'https://intdes.onrender.com';

// ─────────────────────────────────────────────────────
// 2. INIT
// ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadColorPresets('modern');
  renderFavCount();
  initReveal();
  initNavHighlight();
});

// Intersection-observer for scroll-reveal
function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

// Active nav tab highlight on scroll
function initNavHighlight() {
  const sections = ['upload-section','style-section','gallery-section','recommendations-section','setup-section','favorites-section'];
  const tabs = document.querySelectorAll('.nav-tab');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const idx = sections.indexOf(e.target.id);
        tabs.forEach((t,i) => t.classList.toggle('active', i === idx));
      }
    });
  }, { threshold: 0.3 });
  sections.forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
}

window.scrollTo = function(selector) {
  const el = document.querySelector(selector);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ─────────────────────────────────────────────────────
// 3. UPLOAD
// ─────────────────────────────────────────────────────

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  if (!file.type.startsWith('image/')) { showToast('Please upload a valid image file'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    state.originalImage = { name: file.name, dataUrl: ev.target.result };
    document.getElementById('preview-img').src = ev.target.result;
    document.getElementById('upload-filename').textContent = file.name;
    document.getElementById('upload-placeholder').style.display = 'none';
    document.getElementById('upload-preview').style.display = 'block';
    showToast('📸 Room image uploaded!');
    if (state.selectedStyle) triggerGeneration();
  };
  reader.readAsDataURL(file);
}

window.clearImage = function(e) {
  e.stopPropagation();
  state.originalImage = null;
  document.getElementById('room-file').value = '';
  document.getElementById('upload-preview').style.display = 'none';
  document.getElementById('upload-placeholder').style.display = 'block';
  showToast('Image removed');
};

window.handleDragOver = function(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
};
window.handleDragLeave = function() {
  document.getElementById('upload-zone').classList.remove('drag-over');
};
window.handleDrop = function(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
};

// ─────────────────────────────────────────────────────
// 4. STYLE SELECTION
// ─────────────────────────────────────────────────────

window.selectStyle = function(style) {
  state.selectedStyle = style;
  document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('style-' + style);
  if (card) card.classList.add('selected');
  loadColorPresets(style);
  triggerGeneration();
  fetchRecommendations(style);
};

// ─────────────────────────────────────────────────────
// 5. GENERATION
// ─────────────────────────────────────────────────────

async function triggerGeneration() {
  if (!state.selectedStyle) return;
  showEl('gallery-section');
  revealEl('gallery-section');
  showLoading(true);

  try {
    const fd = new FormData();
    fd.append('style', state.selectedStyle);
    if (state.originalImage) fd.append('image', dataUrlToBlob(state.originalImage.dataUrl), state.originalImage.name);
    const res = await fetch(`${API}/generate-design`, { method:'POST', body:fd });
    if (!res.ok) throw new Error();
    const data = await res.json();
    state.generatedImages = data.images;
    renderGallery(data.images);
  } catch {
    const imgs = getMockImages(state.selectedStyle);
    state.generatedImages = imgs;
    renderGallery(imgs);
  } finally {
    showLoading(false);
  }
}

window.regenerateVariations = function() {
  triggerGeneration();
  showToast('Regenerating variations…');
};

function renderGallery(images) {
  const grid = document.getElementById('variations-grid');
  grid.innerHTML = '';
  images.forEach((img, i) => {
    const isFav = state.favorites.some(f => f.id === img.id);
    const card = document.createElement('div');
    card.className = 'var-card';
    card.id = 'vcard-' + img.id;
    card.style.animationDelay = (i * 0.07) + 's';
    card.innerHTML = `
      <img src="${img.url}" alt="${img.label}" loading="lazy"/>
      <div class="var-overlay"><div class="var-label">${img.label}</div></div>
      <div class="var-check">✓</div>
      <button class="var-fav-btn ${isFav ? 'faved' : ''}" onclick="toggleFavGallery(event,'${img.id}')" title="Save">
        <svg width="13" height="13" fill="${isFav?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
      </button>`;
    card.addEventListener('click', ev => { if (!ev.target.closest('.var-fav-btn')) selectVariation(img); });
    grid.appendChild(card);
  });
  document.getElementById('selected-preview-panel').classList.add('hidden');
}

function showLoading(show) {
  document.getElementById('gallery-loading').classList.toggle('hidden', !show);
  document.getElementById('variations-grid').style.display = show ? 'none' : '';
}

// ─────────────────────────────────────────────────────
// 6. SELECT VARIATION
// ─────────────────────────────────────────────────────

function selectVariation(img) {
  state.selectedImage = img;
  document.querySelectorAll('.var-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('vcard-' + img.id);
  if (card) card.classList.add('selected');

  document.getElementById('selected-preview-img').src = img.url;
  document.getElementById('selected-label').textContent = img.label;
  document.getElementById('selected-prompt').textContent = img.prompt;

  const icon = STYLE_ICONS[state.selectedStyle] || '🏠';
  document.getElementById('info-style-icon').textContent = icon;
  document.getElementById('info-style-name').textContent = state.selectedStyle;
  document.getElementById('info-design-name').textContent = img.label;

  const insight = AI_INSIGHTS[state.selectedStyle];
  document.getElementById('info-ai-insight').textContent = insight[Math.floor(Math.random() * insight.length)];

  const isFav = state.favorites.some(f => f.id === img.id);
  updateFavHeart(isFav);

  const panel = document.getElementById('selected-preview-panel');
  panel.classList.remove('hidden');
  requestAnimationFrame(() => panel.scrollIntoView({ behavior:'smooth', block:'start' }));
  showToast(`✅ ${img.label} selected`);
}

// ─────────────────────────────────────────────────────
// 7. RECOMMENDATIONS
// ─────────────────────────────────────────────────────

async function fetchRecommendations(style) {
  showEl('recommendations-section');
  revealEl('recommendations-section');
  document.getElementById('rec-style-name').textContent = style;

  try {
    const res = await fetch(`${API}/recommendations?style=${style}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderRecs(data.recommendations);
  } catch {
    renderRecs(getMockRecs(style));
  }
}

function renderRecs(recs) {
  const grid = document.getElementById('recommendations-grid');
  grid.innerHTML = '';
  recs.forEach((r, i) => {
    const el = document.createElement('div');
    el.className = 'rec-card';
    el.style.animationDelay = (i * 0.08) + 's';
    el.innerHTML = `<div class="rec-icon">${r.icon}</div><div class="rec-title">${r.title}</div><div class="rec-text">${r.text}</div>`;
    grid.appendChild(el);
  });
}

window.scrollToRecommendations = function() {
  document.getElementById('recommendations-section').scrollIntoView({ behavior:'smooth' });
};

// ─────────────────────────────────────────────────────
// 8. SETUP / SHOPPING (INR)
// ─────────────────────────────────────────────────────

window.generateSetup = async function() {
  if (!state.selectedStyle) { showToast('Please select a style first'); return; }
  showEl('setup-section');
  revealEl('setup-section');
  setTimeout(() => document.getElementById('setup-section').scrollIntoView({ behavior:'smooth' }), 200);
  showToast('🛒 Building your shopping list…');

  try {
    const res = await fetch(`${API}/generate-setup`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ style: state.selectedStyle }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    state.products = data.products;
    state.totalCost = data.total_cost;
    renderSetup(data.products, data.total_cost, data.currency || 'INR');
  } catch {
    const prods = getMockProducts(state.selectedStyle);
    const total = prods.reduce((s,p) => s + p.price, 0);
    state.products = prods;
    state.totalCost = total;
    renderSetup(prods, total, 'INR');
  }
};

function formatINR(val) {
  return '₹' + Number(val).toLocaleString('en-IN');
}

function renderSetup(products, total, currency) {
  document.getElementById('total-cost').textContent = formatINR(total);
  document.getElementById('setup-style-name').textContent = state.selectedStyle;
  document.getElementById('setup-item-count').textContent = products.length + ' curated items';

  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';
  products.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'prod-card';
    el.style.animationDelay = (i * 0.07) + 's';
    el.innerHTML = `
      <div class="prod-img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy"/>
        <span class="prod-cat-badge">${p.category}</span>
      </div>
      <div class="prod-body">
        <div class="prod-name">${p.name}</div>
        <div class="prod-price">${formatINR(p.price)}</div>
        <a href="${p.link}" target="_blank" rel="noopener" class="prod-buy" id="buy-${p.id}">🛒 Buy Now</a>
      </div>`;
    grid.appendChild(el);
  });
  showToast(`✅ ${products.length} items curated for your ${state.selectedStyle} setup!`);
}

window.downloadSetupJSON = function() {
  if (!state.products.length) { showToast('Generate a setup first'); return; }
  const data = { generatedAt:new Date().toISOString(), style:state.selectedStyle, currency:'INR', totalCost:state.totalCost, products:state.products };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download = `interior-setup-inr-${state.selectedStyle}-${Date.now()}.json`;
  a.click();
  showToast('📥 Exported as JSON!');
};

// ─────────────────────────────────────────────────────
// 9. WALL COLOR
// ─────────────────────────────────────────────────────

function loadColorPresets(style) {
  const PRESETS = {
    modern:      ['#F5F0E8','#EDE4D5','#2C2C2C','#4A90D9','#6B7280'],
    minimal:     ['#FAFAF8','#F0EEE9','#D4C5B0','#A8A196','#7C7269'],
    traditional: ['#F4ECD8','#DEB48C','#8B4513','#2F4F4F','#800020'],
    luxury:      ['#1A1A2E','#16213E','#C9A96E','#8B7355','#2C1810'],
  };
  const container = document.getElementById('color-presets');
  if (!container) return;
  container.innerHTML = '';
  (PRESETS[style] || PRESETS.modern).forEach(hex => {
    const sw = document.createElement('button');
    sw.className = 'cswatch' + (hex === state.wallColor ? ' active' : '');
    sw.style.background = hex;
    sw.title = COLOR_NAMES[hex] || hex;
    sw.onclick = () => updateWallColor(hex);
    container.appendChild(sw);
  });
}

window.updateWallColor = function(hex) {
  state.wallColor = hex;
  const picker = document.getElementById('wall-color-picker');
  if (picker) picker.value = hex;
  const swatch = document.getElementById('color-preview-swatch');
  if (swatch) swatch.style.background = hex;
  const hexEl = document.getElementById('color-hex-display');
  if (hexEl) hexEl.textContent = hex.toUpperCase();
  const dot = document.getElementById('active-color-dot');
  if (dot) dot.style.background = hex;
  const nameEl = document.getElementById('active-color-name');
  if (nameEl) nameEl.textContent = COLOR_NAMES[hex] || 'Custom';
  const hexDisp = document.getElementById('active-color-hex');
  if (hexDisp) hexDisp.textContent = hex.toUpperCase();
  document.querySelectorAll('.cswatch').forEach(s => s.classList.toggle('active', s.style.background === hex || s.style.background === hexToRgb(hex)));
  const overlay = document.getElementById('wall-color-overlay');
  if (overlay) { overlay.style.background = hex; overlay.style.opacity = '0.12'; }
};

function hexToRgb(hex) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${r}, ${g}, ${b})`;
}

// ─────────────────────────────────────────────────────
// 10. FAVORITES
// ─────────────────────────────────────────────────────

window.toggleFavGallery = function(e, id) {
  e.stopPropagation();
  const img = state.generatedImages.find(i => i.id === id);
  if (!img) return;
  const idx = state.favorites.findIndex(f => f.id === id);
  const btn = e.currentTarget;
  const svg = btn.querySelector('svg');
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    btn.classList.remove('faved');
    if (svg) svg.setAttribute('fill','none');
    showToast('Removed from saved designs');
  } else {
    state.favorites.push({ ...img, savedAt: Date.now() });
    btn.classList.add('faved');
    if (svg) svg.setAttribute('fill','currentColor');
    btn.style.animation = 'heartBeat .4s ease';
    setTimeout(() => btn.style.animation = '', 400);
    showToast('❤️ Saved to favourites!');
  }
  saveFavs();
  renderFavCount();
  if (state.selectedImage && state.selectedImage.id === id) updateFavHeart(idx < 0);
};

window.toggleFavoriteSelected = function() {
  if (!state.selectedImage) return;
  const id = state.selectedImage.id;
  const idx = state.favorites.findIndex(f => f.id === id);
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    updateFavHeart(false);
    showToast('Removed from saved designs');
  } else {
    state.favorites.push({ ...state.selectedImage, savedAt: Date.now() });
    updateFavHeart(true);
    const btn = document.getElementById('fav-btn');
    if (btn) { btn.style.animation = 'heartBeat .4s ease'; setTimeout(() => btn.style.animation='',400); }
    showToast('❤️ Saved to favourites!');
  }
  saveFavs();
  renderFavCount();
  const gallBtn = document.querySelector(`#vcard-${id} .var-fav-btn`);
  if (gallBtn) {
    const isFav = idx < 0;
    gallBtn.classList.toggle('faved', isFav);
    const svg = gallBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isFav ? 'currentColor' : 'none');
  }
};

function updateFavHeart(isFav) {
  const heart = document.getElementById('fav-heart');
  if (!heart) return;
  heart.setAttribute('fill', isFav ? '#e55' : 'none');
  heart.setAttribute('stroke', isFav ? '#e55' : 'white');
  const btn = document.getElementById('fav-btn');
  if (btn) btn.classList.toggle('faved', isFav);
}

function saveFavs() { localStorage.setItem('ai-interior-favorites', JSON.stringify(state.favorites)); }

function renderFavCount() {
  const n = state.favorites.length;
  const el1 = document.getElementById('favorites-count');
  if (el1) el1.textContent = n;
  const el2 = document.getElementById('fav-nav-count');
  if (el2) el2.textContent = n || '';
}

window.toggleFavorites = function() {
  state.showingFavorites = !state.showingFavorites;
  const sec = document.getElementById('favorites-section');
  if (state.showingFavorites) {
    showEl('favorites-section');
    revealEl('favorites-section');
    renderFavGrid();
    sec.scrollIntoView({ behavior:'smooth' });
  } else {
    sec.classList.add('hidden');
  }
};

function renderFavGrid() {
  const grid = document.getElementById('favorites-grid');
  const empty = document.getElementById('favorites-empty');
  grid.innerHTML = '';
  if (!state.favorites.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  state.favorites.forEach((img, i) => {
    const el = document.createElement('div');
    el.className = 'fav-card';
    el.style.animationDelay = (i * 0.06) + 's';
    el.innerHTML = `<img src="${img.url}" alt="${img.label}"/>
      <div class="fav-overlay"><div class="fav-name">${img.label}</div></div>
      <button class="fav-rm-btn" onclick="removeFav(event,'${img.id}')">✕</button>`;
    grid.appendChild(el);
  });
}

window.removeFav = function(e, id) {
  e.stopPropagation();
  state.favorites = state.favorites.filter(f => f.id !== id);
  saveFavs();
  renderFavGrid();
  renderFavCount();
  if (state.selectedImage && state.selectedImage.id === id) updateFavHeart(false);
  const btn = document.querySelector(`#vcard-${id} .var-fav-btn`);
  if (btn) { btn.classList.remove('faved'); const s=btn.querySelector('svg'); if(s) s.setAttribute('fill','none'); }
  showToast('Removed from saved designs');
};

window.clearFavorites = function() {
  state.favorites = [];
  saveFavs();
  renderFavGrid();
  renderFavCount();
  showToast('All saved designs cleared');
};

// ─────────────────────────────────────────────────────
// 11. UI HELPERS
// ─────────────────────────────────────────────────────

function showEl(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function revealEl(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('reveal'); requestAnimationFrame(() => el.classList.add('visible')); }
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  const m = document.getElementById('toast-msg');
  if (!t || !m) return;
  clearTimeout(toastTimer);
  m.textContent = msg;
  t.classList.remove('hidden');
  t.style.animation = 'none';
  void t.offsetWidth;
  t.style.animation = '';
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

function dataUrlToBlob(dataUrl) {
  const [hdr, b64] = dataUrl.split(',');
  const mime = hdr.match(/:(.*?);/)[1];
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ─────────────────────────────────────────────────────
// 12. FALLBACK MOCK DATA (INR prices)
// ─────────────────────────────────────────────────────

function getMockImages(style) {
  const MAP = {
    modern:      [{id:'m1',url:'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80',label:'Modern Minimalist',prompt:'Sleek modern living room with clean lines and neutral tones'},{id:'m2',url:'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80',label:'Urban Contemporary',prompt:'Urban contemporary space with bold accents and open floor plan'},{id:'m3',url:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80',label:'Modern Luxe',prompt:'Modern luxury interior with statement furniture pieces'},{id:'m4',url:'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&q=80',label:'Nordic Modern',prompt:'Scandinavian-inspired modern room with light wood and white palette'}],
    minimal:     [{id:'min1',url:'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',label:'Pure Minimal',prompt:'Minimalist room with essential furniture and tons of negative space'},{id:'min2',url:'https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=800&q=80',label:'Zen Simplicity',prompt:'Zen-inspired minimalist space with natural materials'},{id:'min3',url:'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80',label:'Monochrome Minimal',prompt:'Monochromatic minimalist design with textural interest'},{id:'min4',url:'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=800&q=80',label:'Japandi Style',prompt:'Japandi fusion minimal design with warm wood and muted tones'}],
    traditional: [{id:'t1',url:'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',label:'Classic Heritage',prompt:'Classic traditional interior with ornate wood furniture and rich fabrics'},{id:'t2',url:'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',label:'Colonial Charm',prompt:'Colonial-inspired traditional room with antique accents'},{id:'t3',url:'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',label:'Rustic Traditional',prompt:'Rustic traditional interior with exposed beams and warm colors'},{id:'t4',url:'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&q=80',label:'Victorian Elegance',prompt:'Victorian-inspired traditional room with detailed millwork'}],
    luxury:      [{id:'l1',url:'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',label:'Grand Luxury',prompt:'Opulent luxury suite with gold accents and marble surfaces'},{id:'l2',url:'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800&q=80',label:'Hotel Luxury',prompt:'5-star hotel inspired luxury living space with bespoke furniture'},{id:'l3',url:'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800&q=80',label:'Art Deco Glam',prompt:'Art deco glamour with geometric patterns and metallic finishes'},{id:'l4',url:'https://images.unsplash.com/photo-1616137466211-f939a420be84?w=800&q=80',label:'Contemporary Luxury',prompt:'Contemporary luxury with curated art and designer pieces'}],
  };
  const arr = [...(MAP[style] || MAP.modern)];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}

function getMockRecs(style) {
  const M = {
    modern:      [{icon:'💡',title:'Layered Lighting',text:'Combine recessed LEDs, a statement pendant and a floor lamp to create depth and warmth at every hour.'},{icon:'🪟',title:'Let Light In',text:'Swap heavy drapes for sheer linen panels. Natural light is the most powerful modern design tool.'},{icon:'🎨',title:'Neutral Base, Bold Accent',text:'Anchor in white or warm grey, then introduce one punchy accent colour through cushions and art.'},{icon:'🪴',title:'Statement Plant',text:'A large Monstera or Fiddle Leaf Fig softens hard modern lines and adds life to any corner.'},{icon:'🛋',title:'Float the Furniture',text:'Pull sofas away from walls to create defined conversation zones that feel intentional, not sparse.'}],
    minimal:     [{icon:'✨',title:'One Surface, One Object',text:'Apply this rule everywhere. Edit ruthlessly — what remains should feel chosen, not left behind.'},{icon:'📐',title:'Honour Empty Space',text:'Negative space is an active design element. Resist filling every corner — emptiness breathes.'},{icon:'🌿',title:'Natural Textures',text:'Replace colour variety with texture variety — raw oak, undyed linen, natural stone.'},{icon:'🔲',title:'Tone-on-Tone Palette',text:'Work with three tones of the same hue. Depth through light and shadow, not colour contrast.'},{icon:'📦',title:'Conceal the Clutter',text:'Built-ins and furniture with hidden storage are the minimalist\'s best investment.'}],
    traditional: [{icon:'🪵',title:'Celebrate Wood Grain',text:'Layer oak, walnut and mahogany for richness. Traditional rooms embrace warm wood variety.'},{icon:'🏺',title:'Symmetry is King',text:'Pair lamps, art, and accessories on either side of focal points for the classic balanced look.'},{icon:'🎀',title:'Rich Fabrics',text:'Velvet sofas, damask cushions, wool rugs in jewel tones — burgundy, navy, forest green.'},{icon:'🖼',title:'Gallery Wall',text:'Gilded frames grouped on a feature wall honour the traditional aesthetic beautifully.'},{icon:'🕯',title:'Warm Layers of Light',text:'Table lamps, wall sconces and candles together create the inviting glow traditional rooms need.'}],
    luxury:      [{icon:'✨',title:'One Hero Piece',text:'Invest in one extraordinary item — a bespoke sofa or sculptural coffee table — and build around it.'},{icon:'🪞',title:'Oversize Mirrors',text:'A floor-to-ceiling mirror in a gilded frame doubles light, depth and glamour instantly.'},{icon:'🎭',title:'Sumptuous Layering',text:'Cashmere throws, silk cushions, high-thread-count linens — luxury lives in what you touch.'},{icon:'💎',title:'Consistent Metals',text:'Choose one metal finish — brushed brass or polished chrome — and repeat it through every fitting.'},{icon:'🌹',title:'Fresh Flowers Always',text:'A sculptural vase of fresh florals adds the living, breathing note that makes a room feel like a home.'}],
  };
  return M[style] || M.modern;
}

function getMockProducts(style) {
  const M = {
    modern: [
      {id:'mp1',name:'Scandinavian Sectional Sofa',price:109000,category:'Seating',image:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80',link:'https://www.amazon.in/s?k=modern+sectional+sofa'},
      {id:'mp2',name:'Concrete Effect Coffee Table',price:37800,category:'Tables',image:'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80',link:'https://www.amazon.in/s?k=concrete+coffee+table'},
      {id:'mp3',name:'Pendant Arc Floor Lamp',price:15900,category:'Lighting',image:'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&q=80',link:'https://www.amazon.in/s?k=arc+floor+lamp'},
      {id:'mp4',name:'Geometric Wool Rug 6×4 ft',price:25100,category:'Rugs',image:'https://images.unsplash.com/photo-1575414003224-04f490d2534a?w=400&q=80',link:'https://www.amazon.in/s?k=geometric+wool+rug'},
      {id:'mp5',name:'Floating Wall Shelves Set',price:10100,category:'Storage',image:'https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?w=400&q=80',link:'https://www.amazon.in/s?k=floating+wall+shelves'},
      {id:'mp6',name:'Abstract Canvas Art Print',price:7100,category:'Decor',image:'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&q=80',link:'https://www.amazon.in/s?k=abstract+canvas+art'},
    ],
    minimal: [
      {id:'minp1',name:'Linen Low-Profile Sofa',price:75500,category:'Seating',image:'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&q=80',link:'https://www.amazon.in/s?k=minimalist+sofa'},
      {id:'minp2',name:'Solid Oak Dining Table',price:50400,category:'Tables',image:'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=400&q=80',link:'https://www.amazon.in/s?k=solid+oak+dining+table'},
      {id:'minp3',name:'Washi Paper Pendant Light',price:6300,category:'Lighting',image:'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&q=80',link:'https://www.amazon.in/s?k=paper+pendant+light'},
      {id:'minp4',name:'Natural Jute Floor Rug',price:12200,category:'Rugs',image:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',link:'https://www.amazon.in/s?k=jute+rug'},
      {id:'minp5',name:'Fiddle Leaf Fig — Large',price:5500,category:'Plants',image:'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=400&q=80',link:'https://www.amazon.in/s?k=fiddle+leaf+fig'},
      {id:'minp6',name:'Boucle Accent Chair',price:29300,category:'Seating',image:'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&q=80',link:'https://www.amazon.in/s?k=boucle+accent+chair'},
    ],
    traditional: [
      {id:'tp1',name:'Chesterfield Leather Sofa',price:159600,category:'Seating',image:'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400&q=80',link:'https://www.amazon.in/s?k=chesterfield+sofa'},
      {id:'tp2',name:'Mahogany Dining Set (6-chair)',price:184800,category:'Tables',image:'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',link:'https://www.amazon.in/s?k=mahogany+dining+set'},
      {id:'tp3',name:'Crystal Chandelier',price:46200,category:'Lighting',image:'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=400&q=80',link:'https://www.amazon.in/s?k=crystal+chandelier'},
      {id:'tp4',name:'Persian Mosaic Area Rug',price:58800,category:'Rugs',image:'https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80',link:'https://www.amazon.in/s?k=persian+area+rug'},
      {id:'tp5',name:'Antique Gold Frame Mirror',price:23100,category:'Decor',image:'https://images.unsplash.com/photo-1618220252344-8ec99ec624b1?w=400&q=80',link:'https://www.amazon.in/s?k=antique+gold+mirror'},
      {id:'tp6',name:'Wingback Accent Chair',price:54600,category:'Seating',image:'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80',link:'https://www.amazon.in/s?k=wingback+chair'},
    ],
    luxury: [
      {id:'lp1',name:'Italian Velvet 3-Seater Sofa',price:294000,category:'Seating',image:'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=400&q=80',link:'https://www.amazon.in/s?k=luxury+velvet+sofa'},
      {id:'lp2',name:'Marble & Brass Coffee Table',price:109200,category:'Tables',image:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80',link:'https://www.amazon.in/s?k=marble+brass+coffee+table'},
      {id:'lp3',name:'Designer Beaded Chandelier',price:157500,category:'Lighting',image:'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&q=80',link:'https://www.amazon.in/s?k=designer+chandelier'},
      {id:'lp4',name:'Hand-Knotted Silk Rug 8×5 ft',price:210000,category:'Rugs',image:'https://images.unsplash.com/photo-1575414003224-04f490d2534a?w=400&q=80',link:'https://www.amazon.in/s?k=silk+rug+luxury'},
      {id:'lp5',name:'Original Oil Painting — Large',price:159600,category:'Art',image:'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&q=80',link:'https://www.amazon.in/s?k=luxury+oil+painting'},
      {id:'lp6',name:'Pure Cashmere Throw Blanket',price:32400,category:'Textiles',image:'https://images.unsplash.com/photo-1562438668-bcf0ca6578f0?w=400&q=80',link:'https://www.amazon.in/s?k=cashmere+throw'},
    ],
  };
  return M[style] || M.modern;
}
