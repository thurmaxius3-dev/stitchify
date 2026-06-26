// @ts-nocheck
// Ported from the vanilla-JS CanvasRenderer. Single HTML5 canvas: fillRect + fillText
// only, viewport-culled for large patterns. Driven by the React <PatternCanvas> wrapper.
import { DMC_LIBRARY } from '../store';

export interface RendererElements {
  canvas: HTMLCanvasElement;
  scrollEl: HTMLElement;
  rulerTop: HTMLElement;
  rulerLeft: HTMLElement;
  wrap: HTMLElement;
}

export class CanvasRenderer {
  constructor(els, store) {
    this.store = store;
    this.getState = store.getState;
    this.canvas = els.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.scrollEl = els.scrollEl;
    this.rulerTop = els.rulerTop;
    this.rulerLeft = els.rulerLeft;
    this.wrap = els.wrap;
    this.rulerTopCanvas = this.initRulerCanvas(this.rulerTop);
    this.rulerLeftCanvas = this.initRulerCanvas(this.rulerLeft);

    this.lastRenderKey = null;
    this.isPanning = false;
    this.lastPan = { x: 0, y: 0 };
    this.pinchStartDist = 0;
    this.pinchStartZoom = 1;
    this.touchStart = null;
    this.scrollRaf = null;
    this.disposers = [];
    this.isPainting = false;
    this.lastPaintedCell = null;

    this.bindEvents();
    this.render();
  }

  initRulerCanvas(container) {
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.className = 'ruler-canvas';
    container.appendChild(canvas);
    return canvas;
  }

  on(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    this.disposers.push(() => target.removeEventListener(type, handler, opts));
  }

  bindEvents() {
    this.on(this.scrollEl, 'scroll', () => {
      this.updateRulers();
      if (this.needsViewportCull()) {
        if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
        this.scrollRaf = requestAnimationFrame(() => this.render());
      }
    });
    this.on(this.canvas, 'wheel', (e) => this.onWheel(e), { passive: false });
    this.on(this.canvas, 'mousedown', (e) => this.onMouseDown(e));
    this.on(window, 'mousemove', (e) => this.onMouseMove(e));
    this.on(window, 'mouseup', () => this.onMouseUp());
    this.on(this.canvas, 'click', (e) => this.onCanvasClick(e));
    this.on(this.canvas, 'touchstart', (e) => this.onTouchStart(e), { passive: false });
    this.on(this.canvas, 'touchmove', (e) => this.onTouchMove(e), { passive: false });
    this.on(this.canvas, 'touchend', (e) => this.onTouchEnd(e));
  }

  destroy() {
    this.disposers.forEach((d) => d());
    this.disposers = [];
    if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
  }

  getCanvasRenderKey() {
    const s = this.getState();
    return [
      s.renderGeneration,
      s.doneVersion,
      s.viewMode,
      s.gridMode,
      s.activeColorId,
      s.zoom,
      s.contrast,
      s.showSymbols,
      s.symbolStyle,
      s.cellSize,
    ].join('|');
  }

  /** Called by React on store changes; re-renders only when a render-relevant key changes. */
  syncFromStore() {
    const key = this.getCanvasRenderKey();
    if (key !== this.lastRenderKey) {
      this.lastRenderKey = key;
      this.render();
    }
  }

  needsViewportCull() {
    const { width, height } = this.getState().pattern;
    return width * height > 10000;
  }

  getCellFromEvent(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const cell = this.cellPx;
    const x = Math.floor((clientX - rect.left) / cell);
    const y = Math.floor((clientY - rect.top) / cell);
    const { width, height } = this.getState().pattern;
    if (x < 0 || x >= width || y < 0 || y >= height) return null;
    return { x, y };
  }

  isPaintTool() {
    const tool = this.getState().activeTool;
    return tool === 'pencil' || tool === 'eraser';
  }

  handleCellAction(x, y) {
    const s = this.getState();
    if (s.activeTool === 'eyedropper') s.selectColorFromCell(x, y);
    else if (s.activeTool === 'eraser') s.setStitchDone(x, y, false);
    else if (s.activeTool === 'pencil') {
      if (s.activeColorId) s.paintCell(x, y);
      else s.toggleStitchDone(x, y);
    }
    else if (s.activeTool === 'bucket') {
      if (s.activeColorId) s.floodFill(x, y);
    }
    else s.toggleStitchDone(x, y);
  }

  // ── Mouse drag-to-paint ───────────────────────────────────────────
  onMouseDown(e) {
    const s = this.getState();
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Pan mode
      this.isPanning = true;
      this.lastPan = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    if (e.button === 0 && s.activeTab === 'edit' && this.isPaintTool()) {
      this.isPainting = true;
      this.lastPaintedCell = null;
      const cell = this.getCellFromEvent(e.clientX, e.clientY);
      if (cell) {
        this.handleCellAction(cell.x, cell.y);
        this.lastPaintedCell = cell;
      }
      e.preventDefault();
    }
  }

  onMouseMove(e) {
    // Pan
    if (this.isPanning) {
      this.scrollEl.scrollLeft -= e.clientX - this.lastPan.x;
      this.scrollEl.scrollTop -= e.clientY - this.lastPan.y;
      this.lastPan = { x: e.clientX, y: e.clientY };
      return;
    }
    // Drag paint
    if (this.isPainting) {
      const cell = this.getCellFromEvent(e.clientX, e.clientY);
      if (cell) {
        const last = this.lastPaintedCell;
        if (!last || last.x !== cell.x || last.y !== cell.y) {
          this.handleCellAction(cell.x, cell.y);
          this.lastPaintedCell = cell;
        }
      }
    }
  }

  onMouseUp() {
    if (this.isPainting) {
      this.isPainting = false;
      this.lastPaintedCell = null;
    }
    this.isPanning = false;
    this.pinchStartDist = 0;
    this.touchStart = null;
  }

  onCanvasClick(e) {
    // Single clicks are now handled by onMouseDown for paint tools;
    // only handle click for non-paint tools here to avoid double-firing.
    if (this.getState().activeTab !== 'edit') return;
    if (e.button !== 0 || e.altKey) return;
    if (this.isPaintTool()) return; // already handled in mousedown
    const cell = this.getCellFromEvent(e.clientX, e.clientY);
    if (cell) this.handleCellAction(cell.x, cell.y);
  }

  onWheel(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const s = this.getState();
      s.setZoom(s.zoom + (e.deltaY > 0 ? -0.15 : 0.15));
    }
  }

  onPanStart(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.isPanning = true;
      this.lastPan = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }

  onPanMove(e) {
    if (!this.isPanning) return;
    this.scrollEl.scrollLeft -= e.clientX - this.lastPan.x;
    this.scrollEl.scrollTop -= e.clientY - this.lastPan.y;
    this.lastPan = { x: e.clientX, y: e.clientY };
  }

  onPanEnd() {
    this.isPanning = false;
    this.pinchStartDist = 0;
    this.touchStart = null;
  }

  onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.pinchStartDist = this.getTouchDist(e.touches);
      this.pinchStartZoom = this.getState().zoom;
      this.touchStart = null;
    } else if (e.touches.length === 1) {
      this.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.isPanning = true;
      this.lastPan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  onTouchMove(e) {
    if (e.touches.length === 2 && this.pinchStartDist) {
      e.preventDefault();
      this.getState().setZoom(this.pinchStartZoom * (this.getTouchDist(e.touches) / this.pinchStartDist));
      this.touchStart = null;
    } else if (e.touches.length === 1 && this.isPanning) {
      const dx = e.touches[0].clientX - this.lastPan.x;
      const dy = e.touches[0].clientY - this.lastPan.y;
      if (Math.hypot(dx, dy) > 8) this.touchStart = null;
      this.scrollEl.scrollLeft -= dx;
      this.scrollEl.scrollTop -= dy;
      this.lastPan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  onTouchEnd(e) {
    if (this.touchStart && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      if (
        Math.hypot(t.clientX - this.touchStart.x, t.clientY - this.touchStart.y) < 10 &&
        this.getState().activeTab === 'edit'
      ) {
        const cell = this.getCellFromEvent(t.clientX, t.clientY);
        if (cell) this.handleCellAction(cell.x, cell.y);
      }
    }
    this.onPanEnd();
  }

  getTouchDist(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  get cellPx() {
    const s = this.getState();
    return s.cellSize * s.zoom;
  }

  getVisibleBounds(width, height, cell) {
    if (!this.needsViewportCull()) return { x0: 0, y0: 0, x1: width, y1: height };
    const pad = 2;
    const sl = this.scrollEl.scrollLeft;
    const st = this.scrollEl.scrollTop;
    const vw = this.scrollEl.clientWidth;
    const vh = this.scrollEl.clientHeight;
    return {
      x0: Math.max(0, Math.floor(sl / cell) - pad),
      y0: Math.max(0, Math.floor(st / cell) - pad),
      x1: Math.min(width, Math.ceil((sl + vw) / cell) + pad),
      y1: Math.min(height, Math.ceil((st + vh) / cell) + pad),
    };
  }

  render() {
    const s = this.getState();
    const { pattern, viewMode, gridMode, activeColorId, showSymbols, contrast, doneStitches } = s;
    const { width, height, matrix } = pattern;
    const dmc = DMC_LIBRARY;
    const cell = this.cellPx;
    const ctx = this.ctx;
    const contrastFactor = contrast / 50;
    const isolating = Boolean(activeColorId);
    const cull = this.needsViewportCull();
    const bounds = this.getVisibleBounds(width, height, cell);

    this.canvas.width = width * cell;
    this.canvas.height = height * cell;
    this.wrap.style.width = `${this.canvas.width}px`;
    this.wrap.style.height = `${this.canvas.height}px`;

    if (cull) {
      ctx.fillStyle = '#9e9e9e';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    for (let y = bounds.y0; y < bounds.y1; y++) {
      for (let x = bounds.x0; x < bounds.x1; x++) {
        const idx = y * width + x;
        const dmcIndex = matrix[idx];
        const color = dmc[dmcIndex];
        const px = x * cell;
        const py = y * cell;
        const isDone = doneStitches[idx] === 1;
        const matchesActive = Boolean(activeColorId && color.id === activeColorId);
        const isInactive = isolating && !matchesActive;
        const symbol = s.getSymbol(dmcIndex);

        if (viewMode === 'chart') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px, py, cell, cell);
        } else {
          ctx.fillStyle = color.hex;
          ctx.fillRect(px, py, cell, cell);
        }

        this.drawCellMark(ctx, {
          px, py, cell, color, symbol, isDone, matchesActive, isInactive, viewMode, showSymbols, contrastFactor,
        });
      }
    }

    this.drawGrid(ctx, width, height, cell, gridMode, bounds);
    this.updateRulers();
  }

  drawCellMark(ctx, opts) {
    const { px, py, cell, color, symbol, isDone, matchesActive, isInactive, viewMode, showSymbols, contrastFactor } = opts;
    const markColor = viewMode === 'chart' ? '#000000' : this.getContrastSymbolColor(color.hex, contrastFactor);
    const scale = 1;

    if (isDone && matchesActive) {
      this.drawMark(ctx, px, py, cell, 'circle', markColor, scale);
      this.drawMark(ctx, px, py, cell, 'x', markColor, scale);
      return;
    }
    if (isDone) { this.drawMark(ctx, px, py, cell, 'x', markColor, scale); return; }
    if (matchesActive) { this.drawMark(ctx, px, py, cell, 'circle', markColor, 1); return; }
    if (viewMode === 'symbol-color' && showSymbols && !isInactive) {
      this.drawMark(ctx, px, py, cell, 'glyph', markColor, 1, symbol);
    } else if (viewMode === 'chart' && showSymbols && !isInactive) {
      this.drawMark(ctx, px, py, cell, 'glyph', '#000000', 1, symbol);
    }
  }

  symbolFontSize(cell, scale = 1) {
    return Math.max(6, Math.floor(cell * 0.8 * scale));
  }

  drawMark(ctx, px, py, cell, type, color, scale, glyph) {
    const cx = px + cell / 2;
    const cy = py + cell / 2;
    const fontSize = this.symbolFontSize(cell, scale);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, cell * 0.1) * scale;
    if (type === 'circle') {
      ctx.lineWidth = Math.max(1.5, cell * 0.13) * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.3 * scale, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'x') {
      const inset = cell * 0.14 * scale;
      const x0 = px + inset;
      const y0 = py + inset;
      const x1 = px + cell - inset;
      const y1 = py + cell - inset;
      ctx.lineWidth = Math.max(1.5, cell * 0.14) * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.moveTo(x1, y0);
      ctx.lineTo(x0, y1);
      ctx.stroke();
    } else if (type === 'glyph') {
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, cx, cy);
    }
    ctx.restore();
  }

  drawGrid(ctx, width, height, cell, mode, bounds) {
    if (mode === 'none') return;
    const x0 = bounds ? bounds.x0 : 0;
    const y0 = bounds ? bounds.y0 : 0;
    const x1 = bounds ? bounds.x1 : width;
    const y1 = bounds ? bounds.y1 : height;
    ctx.save();

    if (mode === 'light' || mode === 'combined') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = x0; x <= x1; x++) {
        const pos = x * cell + 0.5;
        ctx.moveTo(pos, y0 * cell);
        ctx.lineTo(pos, y1 * cell);
      }
      for (let y = y0; y <= y1; y++) {
        const pos = y * cell + 0.5;
        ctx.moveTo(x0 * cell, pos);
        ctx.lineTo(x1 * cell, pos);
      }
      ctx.stroke();
    }

    if (mode === 'heavy' || mode === 'red' || mode === 'combined') {
      ctx.strokeStyle = mode === 'red' ? '#e53935' : 'rgba(0, 0, 0, 0.65)';
      ctx.lineWidth = mode === 'red' ? 2 : 1.5;
      ctx.beginPath();
      const gx0 = Math.floor(x0 / 10) * 10;
      const gy0 = Math.floor(y0 / 10) * 10;
      for (let x = gx0; x <= x1; x += 10) {
        const pos = x * cell + 0.5;
        ctx.moveTo(pos, y0 * cell);
        ctx.lineTo(pos, y1 * cell);
      }
      for (let y = gy0; y <= y1; y += 10) {
        const pos = y * cell + 0.5;
        ctx.moveTo(x0 * cell, pos);
        ctx.lineTo(x1 * cell, pos);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  grayscaleFill(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    return `rgba(${gray},${gray},${gray},${alpha})`;
  }

  relativeLuminance(hex) {
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  getContrastSymbolColor(bgHex, factor = 1) {
    const lum = this.relativeLuminance(bgHex);
    const threshold = 0.45 - (factor - 1) * 0.12;
    return lum < threshold ? '#ffffff' : '#000000';
  }

  updateRulers() {
    const cell = this.cellPx;
    const { pattern } = this.getState();
    const { width, height, originX, originY } = pattern;
    const rulerH = this.rulerTop.clientHeight || 24;
    const rulerW = this.rulerLeft.clientWidth || 36;

    this.drawHorizontalRuler(this.rulerTopCanvas, {
      cell,
      scrollOffset: this.scrollEl.scrollLeft,
      viewportSize: this.scrollEl.clientWidth,
      rulerThickness: rulerH,
      origin: originX,
      maxStitch: width,
    });
    this.drawVerticalRuler(this.rulerLeftCanvas, {
      cell,
      scrollOffset: this.scrollEl.scrollTop,
      viewportSize: this.scrollEl.clientHeight,
      rulerThickness: rulerW,
      origin: originY,
      maxStitch: height,
    });
  }

  drawHorizontalRuler(canvas, opts) {
    const { cell, scrollOffset, viewportSize, rulerThickness, origin, maxStitch } = opts;
    canvas.width = Math.max(1, viewportSize);
    canvas.height = rulerThickness;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#374151';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const first = Math.max(0, Math.floor(scrollOffset / cell / 10) * 10);
    const last = Math.min(maxStitch - 1, first + Math.ceil(viewportSize / cell) + 10);
    for (let stitch = first; stitch <= last; stitch += 10) {
      const x = stitch * cell - scrollOffset + cell / 2;
      if (x < -24 || x > viewportSize + 24) continue;
      ctx.fillText(String(origin + stitch), x, rulerThickness / 2);
    }
  }

  drawVerticalRuler(canvas, opts) {
    const { cell, scrollOffset, viewportSize, rulerThickness, origin, maxStitch } = opts;
    canvas.width = rulerThickness;
    canvas.height = Math.max(1, viewportSize);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#374151';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const first = Math.max(0, Math.floor(scrollOffset / cell / 10) * 10);
    const last = Math.min(maxStitch - 1, first + Math.ceil(viewportSize / cell) + 10);
    for (let stitch = first; stitch <= last; stitch += 10) {
      const y = stitch * cell - scrollOffset + cell / 2;
      if (y < -24 || y > viewportSize + 24) continue;
      ctx.fillText(String(origin + stitch), rulerThickness / 2, y);
    }
  }
}
