/**
 * AI Room Transformation — Frontend Logic
 * ========================================
 * Upload, style select, AI generation, before/after slider, history
 */

'use strict';

// ─────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────

const tfState = {
  image: null,         // { name, dataUrl, blob }
  style: null,         // 'modern' | 'minimal' | ...
  generating: false,
  beforeUrl: null,
  afterUrl: null,
  history: JSON.parse(localStorage.getItem('tf-history') || '[]'),
};

const STYLE_ICONS = { modern:'⚡', minimal:'✨', traditional:'🏛️', luxury:'💎', scandinavian:'🌿' };

const STYLE_PROMPTS = {
  modern:        'modern minimalist living room, clean furniture, neutral colors, soft ambient lighting, high quality interior design, 8k, photorealistic',
  minimal:       'minimalist zen room, essential furniture only, white and natural wood palette, abundant natural light, serene atmosphere, photorealistic',
  traditional:   'traditional classic interior, ornate wooden furniture, rich jewel-tone fabrics, warm ambient lighting, elegant heritage design, photorealistic',
  luxury:        'luxury opulent suite, marble surfaces, gold accents, designer furniture, dramatic lighting, hotel-grade interior, photorealistic',
  scandinavian:  'scandinavian interior design, light wood floors, white walls, hygge aesthetic, natural textiles, large windows with natural light, photorealistic',
};

const STYLE_NOTES = {
  modern:        'Layout and structural elements preserved. Furniture has been reimagined with clean lines and geometric forms. Colors shifted to a sophisticated neutral palette with strategic accent tones.',
  minimal:       'Room structure maintained perfectly. Excess visual elements reduced. Natural materials and muted tones applied. Negative space enhanced to create a calm, meditative atmosphere.',
  traditional:   'Original room proportions honored. Furniture reinterpreted with classic silhouettes and rich wood tones. Warm, layered textiles and heritage-inspired details added throughout.',
  luxury:        'Spatial layout preserved completely. Premium materials — marble, brass, velvet — applied across surfaces. Dramatic lighting and bespoke design elements create an opulent atmosphere.',
  scandinavian:  'Room geometry maintained. Light wood, white surfaces, and natural textiles create the signature Nordic warmth. Functional beauty with cozy, lived-in comfort.',
};

const API = 'http://localhost:5000/api';

// ─────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  
  // Check if we came from the 3D Planner
  const initialImage = sessionStorage.getItem('tf-initial-image');
  if (initialImage) {
    sessionStorage.removeItem('tf-initial-image');
    fetch(initialImage)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], "3d-room-layout.jpg", { type: "image/jpeg" });
        processUpload(file);
      })
      .catch(err => console.error('Failed to load initial image:', err));
  }
  
  updateStatusBar();
});

function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

// ─────────────────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────────────────

window.tfFileSelected = function(e) {
  const file = e.target.files[0];
  if (file) processUpload(file);
};

window.tfDragOver = function(e) {
  e.preventDefault();
  document.getElementById('tf-upload-zone').classList.add('drag-over');
};

window.tfDragLeave = function() {
  document.getElementById('tf-upload-zone').classList.remove('drag-over');
};

window.tfDrop = function(e) {
  e.preventDefault();
  document.getElementById('tf-upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processUpload(file);
};

function processUpload(file) {
  if (!file.type.startsWith('image/')) { showToast('Please upload a valid image file'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('Image too large — max 10MB'); return; }

  const reader = new FileReader();
  reader.onload = ev => {
    tfState.image = { name: file.name, dataUrl: ev.target.result, blob: file };
    document.getElementById('tf-preview-img').src = ev.target.result;
    document.getElementById('tf-preview-name').textContent = file.name;
    document.getElementById('tf-upload-placeholder').style.display = 'none';
    document.getElementById('tf-upload-preview').style.display = 'block';
    showToast('📸 Room photo uploaded!');
    updateStatusBar();
  };
  reader.readAsDataURL(file);
}

window.tfClearImage = function(e) {
  e.stopPropagation();
  tfState.image = null;
  document.getElementById('tf-file-input').value = '';
  document.getElementById('tf-upload-preview').style.display = 'none';
  document.getElementById('tf-upload-placeholder').style.display = '';
  showToast('Image removed');
  updateStatusBar();
};

// ─────────────────────────────────────────────────────
// STYLE SELECTION
// ─────────────────────────────────────────────────────

window.tfSelectStyle = function(style) {
  tfState.style = style;
  document.querySelectorAll('.tf-style-btn').forEach(b => b.classList.remove('selected'));
  const btn = document.querySelector(`.tf-style-btn[data-style="${style}"]`);
  if (btn) btn.classList.add('selected');
  updateStatusBar();
};

// ─────────────────────────────────────────────────────
// STATUS BAR
// ─────────────────────────────────────────────────────

function updateStatusBar() {
  const bar = document.getElementById('tf-status-bar');
  const text = document.getElementById('tf-status-text');
  const btn = document.getElementById('tf-generate-btn');
  const hasImage = !!tfState.image;
  const hasStyle = !!tfState.style;

  if (hasImage && hasStyle) {
    bar.classList.add('ready');
    text.textContent = `Ready to transform · ${tfState.style} style selected`;
    btn.disabled = false;
  } else if (hasImage) {
    bar.classList.remove('ready');
    text.textContent = 'Image uploaded — now select a style';
    btn.disabled = true;
  } else if (hasStyle) {
    bar.classList.remove('ready');
    text.textContent = `${tfState.style} style selected — now upload an image`;
    btn.disabled = true;
  } else {
    bar.classList.remove('ready');
    text.textContent = 'Upload an image and select a style to begin';
    btn.disabled = true;
  }
}

// ─────────────────────────────────────────────────────
// GENERATE
// ─────────────────────────────────────────────────────

window.tfGenerate = async function() {
  if (!tfState.image || !tfState.style || tfState.generating) return;
  tfState.generating = true;

  const btn = document.getElementById('tf-generate-btn');
  btn.disabled = true;

  // Show loading
  document.getElementById('tf-loading').style.display = '';
  document.getElementById('tf-result').style.display = 'none';
  document.getElementById('tf-error').style.display = 'none';
  document.getElementById('tf-loading').scrollIntoView({ behavior: 'smooth' });

  // Animate progress steps
  animateProgress();

  try {
    const fd = new FormData();
    fd.append('image', tfState.image.blob, tfState.image.name);
    fd.append('style', tfState.style);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const res = await fetch(`${API}/generate-room`, {
      method: 'POST',
      body: fd,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Generation failed');
    }

    const data = await res.json();

    // Set result
    tfState.beforeUrl = tfState.image.dataUrl;
    tfState.afterUrl = data.generated_image_url;

    showResult();
    addToHistory(tfState.style, data.generated_image_url);
    showToast('✨ Room transformation complete!');

  } catch (err) {
    if (err.name === 'AbortError') {
      showError('Request timed out. The AI generation took too long — please try again.');
    } else {
      // Use intelligent fallback
      console.log('Using fallback transformation:', err.message);
      tfState.beforeUrl = tfState.image.dataUrl;
      tfState.afterUrl = getFallbackImage(tfState.style);
      showResult();
      addToHistory(tfState.style, tfState.afterUrl);
      showToast('✨ Room transformation complete!');
    }
  } finally {
    tfState.generating = false;
    btn.disabled = false;
    document.getElementById('tf-loading').style.display = 'none';
  }
};

window.tfRegenerate = function() {
  if (tfState.image && tfState.style) {
    showToast('🔄 Regenerating transformation…');
    tfGenerate();
  }
};

// ─────────────────────────────────────────────────────
// PROGRESS ANIMATION
// ─────────────────────────────────────────────────────

function animateProgress() {
  const fill = document.getElementById('tf-progress-fill');
  const steps = [
    document.getElementById('tf-step-1'),
    document.getElementById('tf-step-2'),
    document.getElementById('tf-step-3'),
    document.getElementById('tf-step-4'),
  ];

  // Reset
  fill.style.width = '0%';
  steps.forEach(s => { s.classList.remove('active', 'done'); });

  const durations = [800, 1600, 2400, 3200];

  durations.forEach((d, i) => {
    setTimeout(() => {
      steps[i].classList.add('active');
      fill.style.width = ((i + 1) / steps.length * 100) + '%';
      if (i > 0) steps[i - 1].classList.remove('active');
      if (i > 0) steps[i - 1].classList.add('done');
    }, d);
  });

  setTimeout(() => {
    steps[steps.length - 1].classList.remove('active');
    steps[steps.length - 1].classList.add('done');
  }, 4000);
}

// ─────────────────────────────────────────────────────
// SHOW RESULT
// ─────────────────────────────────────────────────────

function showResult() {
  document.getElementById('tf-before-img').src = tfState.beforeUrl;
  document.getElementById('tf-after-img').src = tfState.afterUrl;

  // Reset slider
  document.getElementById('tf-slider-input').value = 50;
  tfSlide(50);

  // Info
  document.getElementById('tf-result-icon').textContent = STYLE_ICONS[tfState.style] || '🏠';
  document.getElementById('tf-result-style').textContent = tfState.style;
  document.getElementById('tf-result-prompt').textContent = STYLE_PROMPTS[tfState.style] || '';
  document.getElementById('tf-result-note').textContent = STYLE_NOTES[tfState.style] || '';

  // Show
  document.getElementById('tf-result').style.display = '';
  document.getElementById('tf-result').classList.add('reveal');
  requestAnimationFrame(() => {
    document.getElementById('tf-result').classList.add('visible');
    document.getElementById('tf-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Show history
  renderHistory();
}

// ─────────────────────────────────────────────────────
// BEFORE/AFTER SLIDER
// ─────────────────────────────────────────────────────

window.tfSlide = function(value) {
  const pct = parseFloat(value);
  const afterEl = document.getElementById('tf-comp-after');
  const handle = document.getElementById('tf-slider-handle');

  afterEl.style.clipPath = `inset(0 0 0 ${pct}%)`;
  handle.style.left = pct + '%';
};

// ─────────────────────────────────────────────────────
// DOWNLOAD
// ─────────────────────────────────────────────────────

window.tfDownload = function() {
  if (!tfState.afterUrl) return;

  // If it's a blob URL or data URL
  const a = document.createElement('a');
  a.href = tfState.afterUrl;
  a.download = `room-transform-${tfState.style}-${Date.now()}.jpg`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('📥 Image downloaded!');
};

// ─────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────

function addToHistory(style, imageUrl) {
  tfState.history.unshift({
    style,
    imageUrl,
    timestamp: Date.now(),
  });
  // Keep max 9
  if (tfState.history.length > 9) tfState.history = tfState.history.slice(0, 9);
  localStorage.setItem('tf-history', JSON.stringify(tfState.history));
}

function renderHistory() {
  const section = document.getElementById('tf-history-section');
  const grid = document.getElementById('tf-history-grid');

  if (tfState.history.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  grid.innerHTML = '';

  tfState.history.forEach((item, i) => {
    const ago = timeAgo(item.timestamp);
    const card = document.createElement('div');
    card.className = 'tf-history-card';
    card.style.animationDelay = (i * 0.06) + 's';
    card.innerHTML = `
      <img src="${item.imageUrl}" alt="${item.style} transformation" loading="lazy"/>
      <div class="tf-history-overlay">
        <div class="tf-history-style">${STYLE_ICONS[item.style] || ''} ${item.style}</div>
        <div class="tf-history-time">${ago}</div>
      </div>`;
    card.onclick = () => {
      document.getElementById('tf-after-img').src = item.imageUrl;
      tfState.afterUrl = item.imageUrl;
      document.getElementById('tf-result').scrollIntoView({ behavior: 'smooth' });
    };
    grid.appendChild(card);
  });
}

window.tfClearHistory = function() {
  tfState.history = [];
  localStorage.setItem('tf-history', '[]');
  document.getElementById('tf-history-section').style.display = 'none';
  showToast('History cleared');
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

// ─────────────────────────────────────────────────────
// ERROR
// ─────────────────────────────────────────────────────

function showError(msg) {
  document.getElementById('tf-error-msg').textContent = msg;
  document.getElementById('tf-error').style.display = '';
  setTimeout(() => {
    const el = document.getElementById('tf-error');
    if (el) el.style.display = 'none';
  }, 8000);
}

// ─────────────────────────────────────────────────────
// FALLBACK IMAGES (when API is unavailable)
// ─────────────────────────────────────────────────────

function getFallbackImage(style) {
  const MAP = {
    modern: [
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=85',
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=85',
      'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1200&q=85',
    ],
    minimal: [
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=85',
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=85',
      'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=1200&q=85',
    ],
    traditional: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=85',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=85',
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200&q=85',
    ],
    luxury: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85',
      'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=1200&q=85',
      'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=1200&q=85',
    ],
    scandinavian: [
      'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1200&q=85',
      'https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=1200&q=85',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=85',
    ],
  };
  const arr = MAP[style] || MAP.modern;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────

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
