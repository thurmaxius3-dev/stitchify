// @ts-nocheck
// Verbatim port of the vanilla-JS pattern engine (K-means quantization + DMC snap).
/**
 * Stitchify — Pattern Engine
 * Two-pass color quantization: K-Means palette extraction → restricted DMC snap (+ optional dither).
 */

const PATTERN_SYMBOLS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V',
  'W', 'X', 'Y', 'Z', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', '=', '#', '@', '$', '%', '&',
  '*', '!', '?', '^', '~', ':', ';', '<', '>', '[', ']', '{', '}', '/', '\\', '|',
];

const KMEANS_ITERATIONS = 12;
const KMEANS_MAX_SAMPLES = 12000;

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function buildDmcRgbCache(dmcLibrary) {
  return dmcLibrary.map((entry) => ({
    ...entry,
    rgb: hexToRgb(entry.hex),
  }));
}

function rgbDistanceSq(r, g, b, cr, cg, cb) {
  const dr = r - cr;
  const dg = g - cg;
  const db = b - cb;
  return dr * dr + dg * dg + db * db;
}

function closestDmcIndex(r, g, b, cache) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < cache.length; i++) {
    const d = rgbDistanceSq(r, g, b, cache[i].rgb[0], cache[i].rgb[1], cache[i].rgb[2]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function clamp255(v) {
  return Math.max(0, Math.min(255, v));
}

/** Collect subsampled RGB pixels from ImageData for clustering */
function collectSamples(data, w, h, maxSamples) {
  const n = w * h;
  const step = Math.max(1, Math.floor(n / maxSamples));
  const samples = [];
  for (let i = 0; i < n; i += step) {
    const j = i * 4;
    if (data[j + 3] < 16) continue;
    samples.push([data[j], data[j + 1], data[j + 2]]);
  }
  return samples;
}

function averageCluster(pixels) {
  if (!pixels.length) return [0, 0, 0];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of pixels) {
    r += p[0];
    g += p[1];
    b += p[2];
  }
  const n = pixels.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/** K-Means++ style initialization */
function initCentroids(samples, k) {
  const centroids = [];
  const pick = () => samples[Math.floor(Math.random() * samples.length)].slice();
  centroids.push(pick());

  while (centroids.length < k && centroids.length < samples.length) {
    const dists = samples.map((s) => {
      let minD = Infinity;
      for (const c of centroids) {
        minD = Math.min(minD, rgbDistanceSq(s[0], s[1], s[2], c[0], c[1], c[2]));
      }
      return minD;
    });
    const total = dists.reduce((a, d) => a + d, 0);
    if (total === 0) break;
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    centroids.push(samples[idx].slice());
  }
  return centroids;
}

/**
 * PASS 1 — K-Means extracts N representative RGB centroids from image pixels.
 */
function kMeansQuantize(samples, k) {
  const count = Math.min(k, samples.length);
  if (count === 0) return [[128, 128, 128]];
  if (count === 1) return [samples[0].slice()];

  let centroids = initCentroids(samples, count);

  for (let iter = 0; iter < KMEANS_ITERATIONS; iter++) {
    const buckets = Array.from({ length: centroids.length }, () => []);
    for (const s of samples) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = rgbDistanceSq(s[0], s[1], s[2], centroids[c][0], centroids[c][1], centroids[c][2]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      buckets[best].push(s);
    }
    const next = [];
    for (let c = 0; c < centroids.length; c++) {
      next.push(buckets[c].length ? averageCluster(buckets[c]) : centroids[c].slice());
    }
    centroids = next;
  }
  return centroids;
}

/** Map extracted centroids to unique closest DMC indices */
function centroidsToDmcPalette(centroids, dmcCache) {
  const palette = [];
  const seen = new Set();
  for (const [r, g, b] of centroids) {
    const idx = closestDmcIndex(r, g, b, dmcCache);
    if (!seen.has(idx)) {
      seen.add(idx);
      palette.push(idx);
    }
  }
  return palette;
}

/** Fill palette up to maxColors using next-most-frequent DMC matches in the image */
function enrichPalette(data, w, h, palette, dmcCache, maxColors) {
  if (palette.length >= maxColors) return palette.slice(0, maxColors);
  const inSet = new Set(palette);
  const freq = new Map();
  const n = w * h;
  const step = Math.max(1, Math.floor(n / KMEANS_MAX_SAMPLES));
  for (let i = 0; i < n; i += step) {
    const j = i * 4;
    const idx = closestDmcIndex(data[j], data[j + 1], data[j + 2], dmcCache);
    if (!inSet.has(idx)) freq.set(idx, (freq.get(idx) || 0) + 1);
  }
  const extras = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([idx]) => idx);
  const result = palette.slice();
  for (const idx of extras) {
    if (result.length >= maxColors) break;
    if (!inSet.has(idx)) {
      inSet.add(idx);
      result.push(idx);
    }
  }
  return result;
}

/**
 * PASS 1 — Extract active project palette (max N DMC colors).
 */
function extractActivePalette(data, w, h, dmcCache, maxColors) {
  const k = Math.max(1, Math.min(maxColors, dmcCache.length));
  const samples = collectSamples(data, w, h, KMEANS_MAX_SAMPLES);
  const centroids = kMeansQuantize(samples, k);
  let palette = centroidsToDmcPalette(centroids, dmcCache);
  palette = enrichPalette(data, w, h, palette, dmcCache, k);
  return palette;
}

function buildPaletteCache(dmcIndices, dmcCache) {
  return dmcIndices.map((dmcIndex) => ({
    dmcIndex,
    rgb: dmcCache[dmcIndex].rgb,
  }));
}

/** Closest match within restricted active palette only */
function closestInPalette(r, g, b, paletteCache) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < paletteCache.length; i++) {
    const [cr, cg, cb] = paletteCache[i].rgb;
    const d = rgbDistanceSq(r, g, b, cr, cg, cb);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return paletteCache[best].dmcIndex;
}

function addError(pixels, w, h, x, y, er, eg, eb, factor) {
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const pi = (y * w + x) * 3;
  pixels[pi] += er * factor;
  pixels[pi + 1] += eg * factor;
  pixels[pi + 2] += eb * factor;
}

/**
 * PASS 2 — Floyd-Steinberg restricted to active palette.
 */
function quantizeToPaletteFloydSteinberg(data, w, h, paletteCache) {
  const n = w * h;
  const pixels = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    pixels[i * 3] = data[j];
    pixels[i * 3 + 1] = data[j + 1];
    pixels[i * 3 + 2] = data[j + 2];
  }

  const matrix = new Uint16Array(n);
  const rgbByDmc = new Map(paletteCache.map((p) => [p.dmcIndex, p.rgb]));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const pi = i * 3;
      const r = clamp255(pixels[pi]);
      const g = clamp255(pixels[pi + 1]);
      const b = clamp255(pixels[pi + 2]);

      const dmcIdx = closestInPalette(r, g, b, paletteCache);
      matrix[i] = dmcIdx;
      const [nr, ng, nb] = rgbByDmc.get(dmcIdx);

      const er = r - nr;
      const eg = g - ng;
      const eb = b - nb;

      addError(pixels, w, h, x + 1, y, er, eg, eb, 7 / 16);
      addError(pixels, w, h, x - 1, y + 1, er, eg, eb, 3 / 16);
      addError(pixels, w, h, x, y + 1, er, eg, eb, 5 / 16);
      addError(pixels, w, h, x + 1, y + 1, er, eg, eb, 1 / 16);
    }
  }
  return matrix;
}

/**
 * PASS 2 — Nearest-neighbor snap restricted to active palette.
 */
function quantizeToPaletteNearest(data, w, h, paletteCache) {
  const matrix = new Uint16Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    matrix[i] = closestInPalette(data[j], data[j + 1], data[j + 2], paletteCache);
  }
  return matrix;
}

const STITCH_MIN = 10;
const STITCH_MAX = 2000;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function imageAspectRatio(img) {
  return img.naturalWidth / img.naturalHeight;
}

/**
 * Clamp stitch dimensions while preserving aspect ratio.
 * @param {'width'|'height'} driver — which input the user edited
 */
function clampStitchDimensions(width, height, aspectRatio, driver = 'width') {
  if (driver === 'width') {
    width = Math.floor(Number(width)) || STITCH_MIN;
    height = Math.round(width / aspectRatio);

    if (height > STITCH_MAX) {
      height = STITCH_MAX;
      width = Math.round(height * aspectRatio);
    }
    if (height < STITCH_MIN) {
      height = STITCH_MIN;
      width = Math.round(height * aspectRatio);
    }
    if (width > STITCH_MAX) {
      width = STITCH_MAX;
      height = Math.round(width / aspectRatio);
    }
    if (width < STITCH_MIN) {
      width = STITCH_MIN;
      height = Math.round(width / aspectRatio);
    }
  } else {
    height = Math.floor(Number(height)) || STITCH_MIN;
    width = Math.round(height * aspectRatio);

    if (width > STITCH_MAX) {
      width = STITCH_MAX;
      height = Math.round(width / aspectRatio);
    }
    if (width < STITCH_MIN) {
      width = STITCH_MIN;
      height = Math.round(width / aspectRatio);
    }
    if (height > STITCH_MAX) {
      height = STITCH_MAX;
      width = Math.round(height * aspectRatio);
    }
    if (height < STITCH_MIN) {
      height = STITCH_MIN;
      width = Math.round(height * aspectRatio);
    }
  }

  width = Math.max(STITCH_MIN, Math.min(STITCH_MAX, width));
  height = Math.max(STITCH_MIN, Math.min(STITCH_MAX, height));
  return { width, height };
}

function stitchDimensionsFromWidth(width, aspectRatio) {
  return clampStitchDimensions(width, Math.round(width / aspectRatio), aspectRatio, 'width');
}

function stitchDimensionsFromHeight(height, aspectRatio) {
  return clampStitchDimensions(Math.round(height * aspectRatio), height, aspectRatio, 'height');
}

/** Snap target W×H to the source image aspect ratio (guards rounding drift). */
function alignTargetDimensionsToImage(targetWidth, targetHeight, img) {
  const aspectRatio = imageAspectRatio(img);
  const targetAspect = targetWidth / targetHeight;
  if (Math.abs(aspectRatio - targetAspect) <= 0.002) {
    return {
      width: Math.max(STITCH_MIN, Math.min(STITCH_MAX, Math.floor(targetWidth))),
      height: Math.max(STITCH_MIN, Math.min(STITCH_MAX, Math.floor(targetHeight))),
      aspectRatio,
    };
  }
  return { ...stitchDimensionsFromWidth(targetWidth, aspectRatio), aspectRatio };
}

/** Draw source image into a W×H stitch grid without stretch (cover crop if needed). */
function drawImageToStitchCanvas(ctx, img, w, h) {
  const imgAspect = imageAspectRatio(img);
  const canvasAspect = w / h;

  if (Math.abs(imgAspect - canvasAspect) < 0.002) {
    ctx.drawImage(img, 0, 0, w, h);
    return;
  }

  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const srcW = w / scale;
  const srcH = h / scale;
  const sx = (img.naturalWidth - srcW) / 2;
  const sy = (img.naturalHeight - srcH) / 2;
  ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, w, h);
}

/**
 * Two-pass image → pattern conversion.
 * @param {object} [options]
 * @param {number} [options.maxColors=50]
 * @param {boolean} [options.dithering=false]
 */
async function imageToPattern(imageSrc, targetWidth, targetHeight, dmcLibrary, options = {}) {
  const { maxColors = 50, dithering = false } = options;
  const img = await loadImage(imageSrc);
  const aligned = alignTargetDimensionsToImage(targetWidth, targetHeight, img);
  const w = aligned.width;
  const h = aligned.height;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  drawImageToStitchCanvas(ctx, img, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const dmcCache = buildDmcRgbCache(dmcLibrary);

  const activeDmcIndices = extractActivePalette(data, w, h, dmcCache, maxColors);
  const paletteCache = buildPaletteCache(activeDmcIndices, dmcCache);

  const matrix = dithering
    ? quantizeToPaletteFloydSteinberg(data, w, h, paletteCache)
    : quantizeToPaletteNearest(data, w, h, paletteCache);

  return {
    width: w,
    height: h,
    originX: 0,
    originY: 0,
    matrix,
    activeDmcIndices,
  };
}

/** Build project palette sorted by stitch count; preserves active palette order when provided */
function buildProjectPalette(matrix, dmcLibrary, activeDmcIndices = null) {
  const counts = new Map();
  for (let i = 0; i < matrix.length; i++) {
    const idx = matrix[i];
    counts.set(idx, (counts.get(idx) || 0) + 1);
  }

  let order;
  if (activeDmcIndices) {
    const used = new Set(counts.keys());
    order = activeDmcIndices.filter((idx) => used.has(idx));
    const rest = [...counts.keys()]
      .filter((idx) => !order.includes(idx))
      .sort((a, b) => counts.get(b) - counts.get(a));
    order = order.concat(rest);
  } else {
    order = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([idx]) => idx);
  }

  return order.map((dmcIndex, i) => ({
    dmcIndex,
    color: dmcLibrary[dmcIndex],
    count: counts.get(dmcIndex) || 0,
    symbol: PATTERN_SYMBOLS[i % PATTERN_SYMBOLS.length],
  }));
}

function buildSymbolMap(projectPalette) {
  const map = new Map();
  projectPalette.forEach((entry) => map.set(entry.dmcIndex, entry.symbol));
  return map;
}

function generateProceduralPattern(width, height, seed, dmcLibrary) {
  const matrix = new Uint16Array(width * height);
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;
      const wing = Math.exp(-((nx - 0.35) ** 2 + (ny - 0.45) ** 2) * 12);
      const body = Math.exp(-((nx - 0.55) ** 2 + (ny - 0.5) ** 2) * 8);
      const branch = ny > 0.72 + Math.sin(nx * 14) * 0.04 ? 1 : 0;
      const sky = 1 - branch - wing * 0.8 - body * 0.6;

      let idx;
      if (branch) idx = rand() > 0.3 ? 4 : 5;
      else if (body > 0.4) idx = rand() > 0.5 ? 2 : 3;
      else if (wing > 0.3) idx = rand() > 0.4 ? 6 : 7;
      else if (sky > 0.5) idx = rand() > 0.7 ? 0 : rand() > 0.5 ? 1 : 4;
      else idx = Math.floor(rand() * dmcLibrary.length);

      matrix[y * width + x] = idx % dmcLibrary.length;
    }
  }

  return { width, height, originX: 0, originY: 0, matrix };
}

function computeCellSize(width, height) {
  const n = width * height;
  if (n > 400000) return 5;
  if (n > 100000) return 8;
  if (n > 25000) return 10;
  return 14;
}

export const PatternEngine: any = {
  PATTERN_SYMBOLS,
  STITCH_MIN,
  STITCH_MAX,
  imageToPattern,
  loadImage,
  imageAspectRatio,
  clampStitchDimensions,
  stitchDimensionsFromWidth,
  stitchDimensionsFromHeight,
  alignTargetDimensionsToImage,
  drawImageToStitchCanvas,
  buildProjectPalette,
  buildSymbolMap,
  generateProceduralPattern,
  computeCellSize,
  extractActivePalette,
  kMeansQuantize,
  closestDmcIndex,
  buildDmcRgbCache,
};
