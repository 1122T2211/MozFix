// Minimal MozFix web logic (iOS/Edge friendly)
const els = {
  zip: document.getElementById('zip'),
  indoor: document.getElementById('indoor'),
  room: document.getElementById('room'),
  tod: document.getElementById('tod'),
  file: document.getElementById('fileInput'),
  preview: document.getElementById('preview'),
  previewWrap: document.getElementById('previewWrap'),
  identify: document.getElementById('identifyBtn'),
  progress: document.getElementById('progress'),
  result: document.getElementById('resultSection'),
  topMatch: document.getElementById('topMatch'),
  otherMatches: document.getElementById('otherMatches'),
  advice: document.getElementById('advice'),
  installBtn: document.getElementById('installBtn')
};

let imageBitmap = null;
let rules = null;
let deferredPrompt = null;

// PWA install prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.classList.remove('hidden');
});
els.installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.classList.add('hidden');
});

// Load rules
fetch('rules.json').then(r => r.json()).then(r => rules = r);

// File input handler (iOS: opens Camera or Library)
els.file.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // HEIC/HEIF: Safari handles display, but Canvas/ImageBitmap may behave differently.
  // Create an object URL and let <img> render it. We'll downscale via canvas.
  const url = URL.createObjectURL(file);
  els.preview.src = url;
  els.previewWrap.classList.remove('hidden');
  els.identify.disabled = false;

  // Make a downscaled ImageBitmap for memory safety before ML
  try {
    const img = await createImageBitmap(file);
    imageBitmap = downscaleBitmap(img, 1280);
  } catch {
    // Fallback: use <img> element drawing
    await new Promise(r => els.preview.onload = r);
    imageBitmap = await htmlImageToBitmap(els.preview, 1280);
  }
});

// Identify button
els.identify.addEventListener('click', async () => {
  if (!imageBitmap || !rules) return;

  els.progress.classList.remove('hidden');
  els.identify.disabled = true;

  // MVP classifier (stub). Replace with TF.js later.
  const candidates = classifyStub({
    zip: els.zip.value.trim(),
    indoor: els.indoor.value === 'true',
    room: els.room.value.trim().toLowerCase(),
    timeOfDay: els.tod.value
  });

  renderResults(candidates);
  els.progress.classList.add('hidden');
  els.result.classList.remove('hidden');
  els.identify.disabled = false;
});

// ---- Helpers ----

function classifyStub(ctx) {
  // Simple heuristic like the Playgrounds version
  let guesses = [
    { label: 'Aedes', score: 0.33 },
    { label: 'Culex', score: 0.33 },
    { label: 'Anopheles', score: 0.24 },
    { label: 'Not mosquito', score: 0.10 }
  ];
  if (ctx.timeOfDay === 'Day' && ctx.indoor) guesses[0].score += 0.20;
  if (ctx.timeOfDay !== 'Day' && ctx.room.includes('bath')) guesses[1].score += 0.15;

  const sum = guesses.reduce((a, b) => a + b.score, 0);
  guesses = guesses.map(g => ({ ...g, score: g.score / sum }))
                   .sort((a, b) => b.score - a.score);
  return guesses;
}

function renderResults(cands) {
  const top = cands[0];
  els.topMatch.innerHTML = `
    <div class="badge">Top</div>
    <div><strong>${top.label}</strong></div>
    <div class="badge">${Math.round(top.score * 100)}%</div>
  `;

  els.otherMatches.innerHTML = '';
  if (cands.length > 1) {
    cands.slice(1).forEach(c => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div class="badge">${Math.round(c.score * 100)}%</div><div>${c.label}</div>`;
      els.otherMatches.appendChild(row);
    });
  }

  els.advice.innerHTML = '';
  const genus = top.label !== 'Not mosquito' ? top.label : 'Not mosquito';
  const block = rules[genus];
  if (block) {
    const div = document.createElement('div');
    div.className = 'advice-block';
    div.innerHTML = `
      <h4>${block.title}</h4>
      <ul>${block.checks.map(c => `<li>${c}</li>`).join('')}</ul>
    `;
    els.advice.appendChild(div);
  } else {
    els.advice.textContent = 'No specific advice for this result.';
  }
}

function downscaleBitmap(bmp, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const cnv = document.createElement('canvas');
  cnv.width = w; cnv.height = h;
  const cx = cnv.getContext('2d');
  cx.drawImage(bmp, 0, 0, w, h);
  return cnv.transferToImageBitmap ? cnv.transferToImageBitmap() : bmp;
}

async function htmlImageToBitmap(imgEl, maxSide) {
  await imgEl.decode?.().catch(() => {});
  const { naturalWidth: w0, naturalHeight: h0 } = imgEl;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);
  const cnv = document.createElement('canvas');
  cnv.width = w; cnv.height = h;
  const cx = cnv.getContext('2d');
  cx.drawImage(imgEl, 0, 0, w, h);
  return cnv.transferToImageBitmap ? cnv.transferToImageBitmap() : null;
}

// (Optional) Replace stub with TF.js later:
// async function classifyWithTF(imageBitmap) {
//   // Load model once:
//   // const model = await tf.loadGraphModel('./model/model.json');
//   // const input = tf.browser.fromPixels(imageBitmap).toFloat().div(255).resizeBilinear([224,224]).expandDims(0);
//   // const logits = model.predict(input);
//   // Map logits → labels [Aedes, Culex, Anopheles, Other] then return candidates.
// }
