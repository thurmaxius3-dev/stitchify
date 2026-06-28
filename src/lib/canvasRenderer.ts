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
    this.renderRaf = null;
    this.isPanning = false;
    this.lastPan = { x: 0, y: 0 };
    this.pinchStartDist = 0;
    this.pinchStartZoom = 1;
    this.touchStart = null;
    this.scrollRaf = null;
    this.disposers = [];
    this.isPainting = false;
    this.lastPaintedCell = null;
    this.paintIntent = null;
    this.touchMoved = false;
    this.activePointerId = null;

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

    // Unified pointer events — work identically on mouse, touch, and stylus.
    // No synthetic click events, no ghost taps, no split logic needed.
    this.on(this.canvas, 'pointerdown', (e) => this.onPointerDown(e));
    this.on(window, 'pointermove', (e) => this.onPointerMove(e));
    this.on(window, 'pointerup', (e) => this.onPointerUp(e));
    this.on(window, 'pointercancel', (e) => this.onPointerUp(e));
    // Pinch-to-zoom via touch events (pointer events don't expose two-finger gestures)
    this.on(this.canvas, 'touchstart', (e) => this.onPinchStart(e), { passive: true });
    this.on(this.canvas, 'touchmove', (e) => this.onPinchMove(e), { passive: false });
    this.on(this.canvas, 'touchend', () => { this.pinchStartDist = 0; });
  }

  destroy() {
    this.disposers.forEach((d) => d());
    this.disposers = [];
    if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
    if (this.renderRaf) cancelAnimationFrame(this.renderRaf);
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
      // Throttle to one render per animation frame
      if (this.renderRaf) return;
      this.renderRaf = requestAnimationFrame(() => {
        this.renderRaf = null;
        this.render();
      });
    }
  }

  needsViewportCull() {
    // Always use viewport culling — canvas is a sticky window over the scroll area,
    // so we always render only what's visible regardless of zoom or pattern size.
    return true;
  }

  getCellFromEvent(clientX, clientY) {
    const cell = this.cellPx;
    // Canvas is position:absolute at (0,0) of the wrap div.
    // getBoundingClientRect() gives its visual position in the viewport,
    // which changes as you scroll. Add scroll offset to go from viewport
    // coords to full-pattern coords.
    const rect = this.scrollEl.getBoundingClientRect();
    const sl = this.scrollEl.scrollLeft;
    const st = this.scrollEl.scrollTop;
    const x = Math.floor((clientX - rect.left + sl) / cell);
    const y = Math.floor((clientY - rect.top  + st) / cell);
    const { width, height } = this.getState().pattern;
    if (x < 0 || x >= width || y < 0 || y >= height) return null;
    return { x, y };
  }

  isPaintTool() {
    const tool = this.getState().activeTool;
    return tool === 'pencil' || tool === 'marker';
  }

  handleCellAction(x, y) {
    const s = this.getState();

    // Eyedropper — pick color from cell
    if (s.activeTool === 'eyedropper') { s.selectColorFromCell(x, y); return; }

    // Bucket — flood fill with selected color
    if (s.activeTool === 'bucket') { if (s.activeColorId) s.floodFill(x, y); return; }

    // Pencil — paint selected color only; does nothing if no color selected
    if (s.activeTool === 'pencil') {
      if (s.activeColorId) s.paintCell(x, y);
      return;
    }

    // Marker — toggle done/undone for selected color only; does nothing if no color selected
    if (s.activeTool === 'marker') {
      if (!s.activeColorId) return;
      const idx = y * s.pattern.width + x;
      const cellColorId = DMC_LIBRARY[s.pattern.matrix[idx]]?.id;
      if (cellColorId !== s.activeColorId) return; // only mark stitches of selected color
      const currentlyDone = s.doneStitches[idx] === 1;
      // Lock drag direction on first cell so dragging back doesn't flip
      if (this.isPainting && this.paintIntent !== null) {
        if (this.paintIntent === 'mark' && !currentlyDone) s.setStitchDone(x, y, true);
        if (this.paintIntent === 'unmark' && currentlyDone) s.setStitchDone(x, y, false);
      } else {
        this.paintIntent = currentlyDone ? 'unmark' : 'mark';
        s.setStitchDone(x, y, !currentlyDone);
      }
      return;
    }
  }

  // ── Unified Pointer Events (mouse + touch + stylus) ──────────────
  onPointerDown(e) {
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    const s = this.getState();

    // Middle-click or alt+click = pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.isPanning = true;
      this.lastPan = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    this.touchStart = { x: e.clientX, y: e.clientY };
    this.touchMoved = false;
    this.lastPan = { x: e.clientX, y: e.clientY };
    this.activePointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);

    // Paint tools act immediately on down
    if (s.activeTab === 'edit' && this.isPaintTool()) {
      this.isPainting = true;
      this.lastPaintedCell = null;
      const cell = this.getCellFromEvent(e.clientX, e.clientY);
      if (cell) {
        this.handleCellAction(cell.x, cell.y);
        this.lastPaintedCell = cell;
      }
    }
  }

  onPointerMove(e) {
    if (e.pointerId !== this.activePointerId) return;

    const dx = e.clientX - this.lastPan.x;
    const dy = e.clientY - this.lastPan.y;

    if (this.isPanning) {
      this.scrollEl.scrollLeft -= dx;
      this.scrollEl.scrollTop -= dy;
      this.lastPan = { x: e.clientX, y: e.clientY };
      return;
    }

    // Track movement to distinguish tap from drag-paint
    if (this.touchStart && Math.hypot(
      e.clientX - this.touchStart.x,
      e.clientY - this.touchStart.y
    ) > 10) {
      this.touchMoved = true;
    }

    // On touch, dragging without a paint tool does nothing —
    // scrolling is handled by the dedicated scrollbars instead.
    if (this.touchMoved && !this.isPainting && e.pointerType === 'touch') {
      return;
    }

    // On mouse (desktop), drag without paint tool still pans
    if (this.touchMoved && !this.isPainting && e.pointerType === 'mouse') {
      this.scrollEl.scrollLeft -= dx;
      this.scrollEl.scrollTop -= dy;
      this.lastPan = { x: e.clientX, y: e.clientY };
      return;
    }

    // Drag-paint
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

    this.lastPan = { x: e.clientX, y: e.clientY };
  }

  onPointerUp(e) {
    if (e.pointerId !== this.activePointerId) return;
    const s = this.getState();

    // Finger lifted without moving = tap
    if (!this.touchMoved && !this.isPainting && !this.isPanning) {
      if (s.activeTab === 'edit') {
        const cell = this.getCellFromEvent(e.clientX, e.clientY);
        if (cell) this.handleCellAction(cell.x, cell.y);
      }
    }

    // Reset all state
    this.isPainting = false;
    this.isPanning = false;
    this.lastPaintedCell = null;
    this.paintIntent = null;
    this.touchStart = null;
    this.touchMoved = false;
    this.activePointerId = null;
    this.pinchStartDist = 0;
  }

  onWheel(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const s = this.getState();
      s.setZoom(s.zoom + (e.deltaY > 0 ? -0.15 : 0.15));
    }
  }

  // Pinch-to-zoom (two fingers only, ignored by pointer handlers)
  onPinchStart(e) {
    if (e.touches.length === 2) {
      this.pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      this.pinchStartZoom = this.getState().zoom;
    }
  }

  onPinchMove(e) {
    if (e.touches.length === 2 && this.pinchStartDist) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      this.getState().setZoom(this.pinchStartZoom * (dist / this.pinchStartDist));
    }
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
    const bounds = this.getVisibleBounds(width, height, cell);

    // The virtual canvas is always the full pattern size (for scroll area)
    this.wrap.style.width  = `${width  * cell}px`;
    this.wrap.style.height = `${height * cell}px`;

    // The actual <canvas> element is a viewport window: capped to the visible area
    // so it never exceeds device limits, regardless of zoom level.
    const canvasW = Math.min(width  * cell, this.scrollEl.clientWidth  || window.innerWidth);
    const canvasH = Math.min(height * cell, this.scrollEl.clientHeight || window.innerHeight);
    if (this.canvas.width !== Math.round(canvasW) || this.canvas.height !== Math.round(canvasH)) {
      this.canvas.width  = Math.round(canvasW);
      this.canvas.height = Math.round(canvasH);
    }

    // Canvas is position:sticky so it always covers the visible area.
    // We translate the drawing context by the scroll offset so the right
    // cells appear — effectively making the canvas a sliding viewport window.
    const sl = this.scrollEl.scrollLeft;
    const st = this.scrollEl.scrollTop;

    // Draw the background for viewport-culled regions
    ctx.fillStyle = '#9e9e9e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Translate drawing coords so cell (bounds.x0, bounds.y0) maps to canvas origin
    ctx.save();
    ctx.translate(-sl, -st);

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
    ctx.restore();
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
      // Bold lines fall on the right edge of every 10th cell (cells 10, 20, 30...)
      // Start from the first multiple of 10 >= x0, offset +1 so line is after cell 10 not before
      const gx0 = Math.ceil(x0 / 10) * 10;
      const gy0 = Math.ceil(y0 / 10) * 10;
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
