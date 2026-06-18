// @ts-nocheck
// Verbatim port of the battle-tested vanilla-JS .em binary parser. Kept @ts-nocheck
// on purpose: it is stable, heavily validated, and rarely edited.
import { inflate as pakoInflate } from 'pako';

/**
 * Stitchify — eCanvas .em parser (EM005)
 *
 * Confirmed layout:
 *   UTF-16LE "EM005" + BE uint16 width/height/colorCount
 *   Palette records (0x0001 marker, DMC string, RGB, BE uint32 stitch count, symbol byte)
 *   Post-palette section header (magic 0x3f……, dragon ≈97 bytes, DW60 ≈16 bytes + 0xFF fill)
 *   Stitch index stream: RLE-compressed bytes (separate from embedded PNG preview)
 *   Embedded PNG (IHDR…IDAT…IEND): RGBA preview only, not stitch data.
 *
 * RLE stitch stream (row-slot layout, dragon/DW60):
 *   Per-row slot (404 or 632 bytes) with optional 0x3F end marker and 0xFF padding.
 *
 *   Precedence state machine (bytes >= colorCount overlap run-commands and symbol IDs):
 *     OP          — awaiting next opcode or standalone stitch byte
 *     RUN_LEN     — byte after 0xFF is run length (single byte; chained 0xFF runs for >255)
 *     RUN_IDX     — index payload for 0xFF run (literal-first, then symbol, then collision pick)
 *     EXT_IDX     — index payload for extended run cmd (same resolution as RUN_IDX)
 *
 *   OP rules:
 *     0xFF        → RUN_LEN (skip 0xFF 0xFF pairs — row padding, not a run)
 *     0x3F        → end of row (stop; trailing bytes are dead space)
 *     0xFE/0xFC/0xC0/0xF0 — control opcodes (0xF0 = zero-fill run after 0x00 skip)
 *     b < colorCount → if wire byte is a collision symbol, pick highest-count owner;
 *                      else literal palette index (never symbol alias for unique symbols)
 *     b >= colorCount → if unique symbol ID emit symbol; if collision pick highest-count owner;
 *                       else EXT_IDX on next byte (extended run command)
 *
 *   Dual encoding: DMC 154 is idx 0 (wire 0x00) and symbol 104 (0x68). Byte 104 is always
 *   literal idx 104 in index/standalone contexts because 104 < colorCount — never symbol 154.
 *
 * Sparse patches (mostly-solid patterns, e.g. B5200 + few spots):
 *   Before the embedded PNG, 20-byte records: u32 type=3, u32 x, u8 y, 5×0xFF, 3-byte RGB
 */

const SIGNATURE = 'EM005';

  function u8(bytes, i) {
    return bytes[i];
  }

  function readU16Le(bytes, i) {
    return bytes[i] | (bytes[i + 1] << 8);
  }

  function readU32Be(bytes, i) {
    return (
      ((bytes[i] << 24) |
        (bytes[i + 1] << 16) |
        (bytes[i + 2] << 8) |
        bytes[i + 3]) >>>
      0
    );
  }

  function readAscii(bytes, start, len) {
    let out = '';
    for (let i = 0; i < len; i++) out += String.fromCharCode(bytes[start + i]);
    return out;
  }

  function readSignature(view) {
    let out = '';
    for (let i = 0; i < 5; i++) {
      out += String.fromCharCode(view.getUint16(i * 2, false));
    }
    return out;
  }

  function findIhdrOffset(bytes) {
    for (let i = 0; i <= bytes.length - 4; i++) {
      if (
        bytes[i] === 0x49 &&
        bytes[i + 1] === 0x48 &&
        bytes[i + 2] === 0x44 &&
        bytes[i + 3] === 0x52
      ) {
        return i;
      }
    }
    return -1;
  }

  function findMatrixStart(bytes, paletteEnd) {
    let pos = paletteEnd;
    if (pos + 4 <= bytes.length && bytes[pos] === 0x3f) {
      pos += 4;
      while (pos + 4 <= bytes.length) {
        const word = bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24);
        if (word === 0) break;
        pos += 4;
      }
      pos += 4;
    }
    while (pos < bytes.length && bytes[pos] === 0xff) pos++;
    return pos;
  }

  function measureRleFill(bytes, start, end, colorCount) {
    let filled = 0;
    let i = start;
    while (i < end) {
      const v = bytes[i++];
      if (v === 0xff) {
        if (i + 1 >= end) break;
        const run = bytes[i++];
        const idx = bytes[i++];
        if (idx < colorCount) filled += run;
      } else if (v < colorCount) {
        filled += 1;
      } else if (i < end) {
        const idx = bytes[i++];
        if (idx < colorCount) filled += v - colorCount + 1;
      }
    }
    return filled;
  }

  function findMatrixEnd(bytes, matrixStart, totalCells, colorCount) {
    const ihdr = findIhdrOffset(bytes);
    if (ihdr > matrixStart && measureRleFill(bytes, matrixStart, ihdr, colorCount) === totalCells) {
      return ihdr;
    }
    let lo = matrixStart + 1;
    let hi = bytes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (measureRleFill(bytes, matrixStart, mid, colorCount) >= totalCells) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  function findPngOffset(bytes) {
    for (let i = 0; i <= bytes.length - 4; i++) {
      if (bytes[i] === 0x89 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x47) {
        return i;
      }
    }
    return -1;
  }

  const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function inflateIdatPayload(idatPayload, inflateSync) {
    const inflate = resolveInflate(inflateSync);
    if (!inflate) return null;
    return new Uint8Array(inflate(idatPayload));
  }

  /**
   * Resolve a synchronous inflate function. Priority:
   *   1. explicit inflateSync passed by the caller (e.g. Node tests),
   *   2. pako.inflate in the browser,
   *   3. Node's built-in zlib.inflateSync.
   */
  function resolveInflate(inflateSync) {
    if (typeof inflateSync === 'function') return inflateSync;
    return (data) => pakoInflate(data);
  }

  /** Scan embedded PNG chunks starting at the PNG signature. */
  function scanEmbeddedPng(bytes, pngStart) {
    const start = pngStart >= 0 ? pngStart : findPngOffset(bytes);
    if (start < 0 || start + 8 > bytes.length) {
      return { pngStart: start, chunks: [], ihdr: null, idatPayload: null };
    }

    const chunks = [];
    let ihdr = null;
    const idatParts = [];
    let i = start + 8;

    while (i + 12 <= bytes.length) {
      const len = readU32Be(bytes, i);
      const tag = readAscii(bytes, i + 4, 4);
      if (len < 0 || i + 12 + len > bytes.length) break;
      const data = bytes.subarray(i + 8, i + 8 + len);
      chunks.push({ tag, offset: i, len, data });
      if (tag === 'IHDR' && len >= 13) {
        ihdr = {
          width: readU32Be(bytes, i + 8),
          height: readU32Be(bytes, i + 12),
          bitDepth: u8(bytes, i + 16),
          colorType: u8(bytes, i + 17),
        };
      }
      if (tag === 'IDAT') idatParts.push(data);
      if (tag === 'IEND') break;
      i += 12 + len;
    }

    const idatPayload = idatParts.length ? concatUint8Arrays(idatParts) : null;
    return { pngStart: start, chunks, ihdr, idatPayload };
  }

  function concatUint8Arrays(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  function pngPaeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  /** Standard PNG scanline unfilter (None/Sub/Up/Average/Paeth). */
  function unfilterPngScanlines(raw, width, bpp, height) {
    const rowBytes = width * bpp;
    const out = new Uint8Array(height * rowBytes);
    let src = 0;
    let dst = 0;
    const prev = new Uint8Array(rowBytes);

    for (let y = 0; y < height; y++) {
      const filter = raw[src++];
      for (let x = 0; x < rowBytes; x++) {
        const left = x >= bpp ? out[dst + x - bpp] : 0;
        const up = prev[x];
        const upLeft = x >= bpp ? prev[x - bpp] : 0;
        let value = raw[src + x];
        if (filter === 1) value = (value + left) & 0xff;
        else if (filter === 2) value = (value + up) & 0xff;
        else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 0xff;
        else if (filter === 4) value = (value + pngPaeth(left, up, upLeft)) & 0xff;
        out[dst + x] = value;
      }
      for (let x = 0; x < rowBytes; x++) prev[x] = out[dst + x];
      src += rowBytes;
      dst += rowBytes;
    }

    return out;
  }

  /**
   * Extract palette-index rows from inflated PNG scanlines.
   * mode:
   *   'bpp1-raw' — skip filter byte, read width literal bytes per row (bpp=1 layout)
   *   'bpp1-unfilter' — unfilter with bpp=1 then copy rows
   *   'rgba-r' — unfilter RGBA, use R channel as index
   *   'rgba-raw350' — skip filter, first width bytes of each RGBA scanline (no unfilter)
   */
  function extractIdatIndexRows(inflated, width, startRow, endRow, mode) {
    const rows = endRow - startRow + 1;
    const out = new Uint8Array(rows * width);

    if (mode === 'bpp1-raw') {
      let src = startRow * (1 + width);
      let dst = 0;
      for (let y = startRow; y <= endRow; y++) {
        src++;
        for (let x = 0; x < width; x++) out[dst++] = inflated[src++];
      }
      return out;
    }

    if (mode === 'rgba-raw350') {
      const stride = 1 + width * 4;
      let dst = 0;
      for (let y = startRow; y <= endRow; y++) {
        const rowStart = y * stride + 1;
        for (let x = 0; x < width; x++) out[dst++] = inflated[rowStart + x];
      }
      return out;
    }

    const height = endRow + 1;
    const bpp = mode === 'rgba-r' ? 4 : 1;
    const unf = unfilterPngScanlines(inflated, width, bpp, height);
    let dst = 0;
    for (let y = startRow; y <= endRow; y++) {
      if (mode === 'rgba-r') {
        for (let x = 0; x < width; x++) out[dst++] = unf[(y * width + x) * 4];
      } else {
        for (let x = 0; x < width; x++) out[dst++] = unf[y * width + x];
      }
    }
    return out;
  }

  /**
   * Hybrid matrix: RLE row slots for rows [0, idatStartRow) + IDAT scanline indices for the rest.
   */
  function decodeHybridRleIdatMatrix(bytes, matrixStart, palette, width, height, options = {}) {
    const idatStartRow = options.idatStartRow ?? 40;
    const idatMode = options.idatMode ?? 'bpp1-raw';
    const colorCount = palette.length;
    const tables = buildSymbolTables(palette);
    const { rowBytes, stitchWidth } = detectRowLayout(width, height);
    const rowOptions = {
      skipLeadingFF: options.skipLeadingFF === true,
      skipFFPaddingPair: options.skipFFPaddingPair === true,
      useRowEnd3f: options.useRowEnd3f === true,
      allowIndexSymbol: options.allowIndexSymbol === true,
      resolveCollisions: options.resolveCollisions === true,
      padIndex: options.padIndex ?? 0,
      f0Index: options.f0Index ?? options.padIndex ?? 0,
    };

    const matrix = new Uint8Array(width * height);

    for (let y = 0; y < idatStartRow; y++) {
      const rowOffset = matrixStart + y * rowBytes;
      if (rowOffset + rowBytes > bytes.length) break;
      const row = bytes.subarray(rowOffset, rowOffset + rowBytes);
      const decoded = decodeRowRleStateMachine(row, stitchWidth, colorCount, tables, rowOptions);
      for (let x = 0; x < width; x++) matrix[y * width + x] = decoded[x];
    }

    let inflated = options.inflatedScanlines;
    if (!inflated && options.idatPayload) {
      inflated = inflateIdatPayload(options.idatPayload, options.inflateSync);
    }
    if (!inflated) {
      const png = scanEmbeddedPng(bytes);
      if (png.idatPayload) {
        inflated = inflateIdatPayload(png.idatPayload, options.inflateSync);
      }
    }
    if (!inflated) return null;

    const idatRows = extractIdatIndexRows(inflated, width, idatStartRow, height - 1, idatMode);
    for (let y = idatStartRow; y < height; y++) {
      const srcRow = y - idatStartRow;
      for (let x = 0; x < width; x++) {
        matrix[y * width + x] = idatRows[srcRow * width + x];
      }
    }

    return matrix;
  }

  /**
   * Decode the embedded PNG as the authoritative stitch matrix.
   *
   * eCanvas renders the indexed grid to an RGBA (or RGB) PNG whose every pixel
   * exactly matches one palette entry's RGB. Inflating + unfiltering the
   * scanlines and doing an exact RGB->index lookup reproduces the grid 1:1.
   *
   * Returns { matrix, unmapped } or null when there is no usable embedded PNG
   * (missing, wrong dimensions, unsupported color type, or inflate unavailable).
   */
  function decodePngRgbMatrix(bytes, palette, width, height, options = {}) {
    const png = scanEmbeddedPng(bytes, options.pngStart);
    if (!png || !png.ihdr || !png.idatPayload) return null;
    if (png.ihdr.width !== width || png.ihdr.height !== height) return null;

    const bpp = png.ihdr.colorType === 6 ? 4 : png.ihdr.colorType === 2 ? 3 : 0;
    if (!bpp) return null;

    let inflated = options.inflatedScanlines;
    if (!inflated) inflated = inflateIdatPayload(png.idatPayload, options.inflateSync);
    if (!inflated) return null;

    const expectedLength = height * (1 + width * bpp);
    if (inflated.length !== expectedLength) return null;

    const pixels = unfilterPngScanlines(inflated, width, bpp, height);

    const rgbToIndex = new Map();
    for (const entry of palette) {
      rgbToIndex.set((entry.rgb[0] << 16) | (entry.rgb[1] << 8) | entry.rgb[2], entry.index);
    }

    const cells = width * height;
    const matrix = new Uint8Array(cells);
    let unmapped = 0;
    for (let cell = 0; cell < cells; cell++) {
      const o = cell * bpp;
      const key = (pixels[o] << 16) | (pixels[o + 1] << 8) | pixels[o + 2];
      const idx = rgbToIndex.get(key);
      if (idx == null) {
        unmapped++;
        matrix[cell] = 0;
      } else {
        matrix[cell] = idx;
      }
    }

    return { matrix, unmapped };
  }

  /**
   * Decode the completed-stitch ("done") layer.
   *
   * eCanvas stores progress as a 1-bit-per-stitch bitmap that sits just after the
   * palette (a short 0x3f-magic header of file-dependent length separates them).
   * The bitmap is a CONTINUOUS stream: exactly `width` bits per row with NO per-row
   * byte padding, MSB-first, 1 = stitched. (Reading it byte-aligned at ceil(width/8)
   * bytes/row injects a width-vs-600 drift that smears the data diagonally.)
   *
   * Because the header length varies per file, we auto-align: scan a window of bit
   * offsets after the palette and pick the alignment that yields the most full-width
   * rows. Completed patterns are stitched row-by-row from the top, so the true
   * alignment maximizes solid (all-stitched) rows; misalignments fracture them.
   *
   * Returns a Uint8Array(width*height) of 0/1, or null if no progress is recognized.
   */
  function decodeDoneLayer(bytes, width, height, pngStart, paletteEnd) {
    if (paletteEnd == null || paletteEnd < 0) return null;

    const totalBits = width * height;
    const limitBit = (pngStart >= 0 ? pngStart : bytes.length) * 8;
    const calibRows = Math.min(height, 220);

    const scanLo = Math.max(0, paletteEnd * 8 - 16);
    const scanHi = paletteEnd * 8 + 320;

    let bestStart = -1;
    let bestFull = -1;
    let bestTotal = -1;
    for (let bitStart = scanLo; bitStart <= scanHi; bitStart++) {
      if (bitStart + totalBits > limitBit) break;
      let full = 0;
      let total = 0;
      for (let y = 0; y < calibRows; y++) {
        let c = 0;
        const rowBit = bitStart + y * width;
        for (let x = 0; x < width; x++) {
          const p = rowBit + x;
          c += (bytes[p >> 3] >> (7 - (p & 7))) & 1;
        }
        total += c;
        if (c >= width - 1) full++;
      }
      if (full > bestFull || (full === bestFull && total > bestTotal)) {
        bestFull = full;
        bestTotal = total;
        bestStart = bitStart;
      }
    }

    // No solid rows at any alignment → no recognizable straight-across progress.
    if (bestStart < 0 || bestFull === 0) return null;

    const done = new Uint8Array(totalBits);
    for (let y = 0; y < height; y++) {
      const rowBit = bestStart + y * width;
      for (let x = 0; x < width; x++) {
        const p = rowBit + x;
        done[y * width + x] = (bytes[p >> 3] >> (7 - (p & 7))) & 1;
      }
    }
    return done;
  }

  function rgbToKey(rgb) {
    return `${rgb[0]},${rgb[1]},${rgb[2]}`;
  }

  /** Parse sparse (x,y) patch list used when most stitches share one background color. */
  function parseSparsePatches(bytes, palette, pngStart) {
    const rgbToIndex = new Map(palette.map((p) => [rgbToKey(p.rgb), p.index]));
    const patches = [];
    const scanStart = Math.max(200, pngStart - 50000);
    const PATCH_STRIDE = 20;

    for (let pos = scanStart; pos + PATCH_STRIDE <= pngStart; pos += 1) {
      if (readU32Le(bytes, pos) !== 3) continue;
      if (u8(bytes, pos + 9) !== 0xff) continue;
      const rgb = [u8(bytes, pos + 14), u8(bytes, pos + 15), u8(bytes, pos + 16)];
      const idx = rgbToIndex.get(rgbToKey(rgb));
      if (idx == null) continue;
      patches.push({
        x: readU32Le(bytes, pos + 4),
        y: u8(bytes, pos + 8),
        index: idx,
        offset: pos,
      });
      pos += PATCH_STRIDE - 1;
    }

    if (!patches.length) return { patches: [], sparseStart: pngStart };
    return { patches, sparseStart: pngStart };
  }

  function rgbToIndexHas(palette, rgb) {
    const key = rgbToKey(rgb);
    return palette.some((p) => rgbToKey(p.rgb) === key);
  }

  function readU32Le(bytes, i) {
    return (
      (bytes[i] |
        (bytes[i + 1] << 8) |
        (bytes[i + 2] << 16) |
        (bytes[i + 3] << 24)) >>>
      0
    );
  }

  function applySparsePatches(matrix, width, height, patches) {
    for (const patch of patches) {
      if (patch.x < width && patch.y < height) {
        matrix[patch.y * width + patch.x] = patch.index;
      }
    }
  }

  function decodeEmMatrix(bytes, matrixStart, palette, width, height, symbolMap, options = {}) {
    const colorCount = palette.length;
    const totalCells = width * height;
    const pngStart = findPngOffset(bytes);

    // Preferred path: the embedded PNG is the authoritative indexed matrix,
    // rendered to RGBA. Exact RGB->index mapping reproduces the grid 1:1.
    if (pngStart >= 0) {
      const png = decodePngRgbMatrix(bytes, palette, width, height, {
        pngStart,
        inflateSync: options.inflateSync,
      });
      if (png && png.unmapped === 0) {
        return { matrix: png.matrix, matrixEnd: pngStart, sparsePatches: [], mode: 'png-rgb' };
      }
    }

    const sparse = pngStart > 0 ? parseSparsePatches(bytes, palette, pngStart) : { patches: [], sparseStart: bytes.length };

    if (sparse.patches.length > 0) {
      const bgIndex = palette.reduce((best, p, i) =>
        p.count > palette[best].count ? i : best, 0);
      const matrix = new Uint8Array(totalCells);
      matrix.fill(bgIndex);
      applySparsePatches(matrix, width, height, sparse.patches);
      const earliest = Math.min(...sparse.patches.map((p) => p.offset ?? pngStart));
      return { matrix, matrixEnd: earliest, sparsePatches: sparse.patches, mode: 'sparse' };
    }

    const matrixEnd = findMatrixEnd(bytes, matrixStart, totalCells, colorCount);
    const rowMatrix = decodeRowSlotMatrix(bytes, matrixStart, palette, width, height);
    const seqMatrix = decodeRleMatrix(bytes, matrixStart, matrixEnd, colorCount, totalCells, symbolMap);
    const rowScore = validateMatrixCounts(rowMatrix, palette).matched;
    const seqScore = validateMatrixCounts(seqMatrix, palette).matched;

    const matrix = rowScore >= seqScore ? rowMatrix : seqMatrix;
    const mode = rowScore >= seqScore ? 'row-slots' : 'rle';

    return { matrix, matrixEnd, sparsePatches: [], mode };
  }

  function detectRowLayout(width, height) {
    if (width >= 500 || height >= 800) {
      return { rowBytes: 632, stitchWidth: width, storedWidth: width + 6 };
    }
    return { rowBytes: 404, stitchWidth: width, storedWidth: width };
  }

  function appendStitches(out, idx, run, stitchWidth) {
    const writable = Math.max(0, Math.min(run, stitchWidth - out.length));
    for (let k = 0; k < writable; k++) out.push(idx);
    return {
      written: writable,
      truncated: run - writable,
    };
  }

  const RLE_OP = 0;
  const RLE_RUN_LEN = 1;
  const RLE_RUN_IDX = 2;
  const RLE_EXT_IDX = 3;

  function findRowEndMarker(row) {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === 0x3f) return i;
    }
    return row.length;
  }

  /** Symbol tables including collision detection (one wire byte → multiple palette entries). */
  function buildSymbolTables(palette) {
    const symToIdx = new Map();
    const symOwners = new Map();
    const symCollisions = new Set();
    for (const entry of palette) {
      if (!symOwners.has(entry.symbol)) symOwners.set(entry.symbol, []);
      symOwners.get(entry.symbol).push(entry);
      if (symToIdx.has(entry.symbol)) symCollisions.add(entry.symbol);
      else symToIdx.set(entry.symbol, entry.index);
    }
    return { symToIdx, symOwners, symCollisions };
  }

  function buildSymbolMap(palette) {
    return buildSymbolTables(palette).symToIdx;
  }

  function resolveCollisionSymbol(sym, symOwners) {
    const owners = symOwners.get(sym) || [];
    if (!owners.length) return null;
    if (owners.length === 1) return owners[0].index;
    return owners.reduce((best, entry) => (entry.count >= best.count ? entry : best)).index;
  }

  /**
   * Index payload inside RUN_IDX / EXT_IDX.
   * Literal-first: values < colorCount are palette indices, not symbol aliases.
   */
  function resolveIndexPayload(raw, colorCount, tables, options) {
    const allowSymbol = options.allowIndexSymbol !== false;
    const resolveCollisions = options.resolveCollisions === true;
    if (raw < colorCount) {
      if (resolveCollisions && tables.symCollisions.has(raw)) {
        return resolveCollisionSymbol(raw, tables.symOwners);
      }
      return raw;
    }
    if (!allowSymbol) return null;
    if (tables.symCollisions.has(raw)) return resolveCollisionSymbol(raw, tables.symOwners);
    return tables.symToIdx.get(raw) ?? null;
  }

  function emitRleDebug(options, type, detail) {
    if (typeof options.onEvent === 'function') {
      options.onEvent({ type, ...detail });
    }
    if (options.debugRle) {
      const row = detail.row == null ? '?' : detail.row;
      const offset = detail.offset == null ? '?' : detail.offset;
      console.log(`[RLE ${type}] row=${row} off=${offset}`, detail);
    }
  }

  /**
   * Decode one row slot using the eCanvas RLE precedence state machine.
   * Returns palette indices for one row (length = stitchWidth).
   */
  function decodeRowRleStateMachine(row, stitchWidth, colorCount, tables, options = {}) {
    const padIndex = options.padIndex ?? 0;
    const f0Index = options.f0Index ?? padIndex;
    const resolveCollisions = options.resolveCollisions === true;
    const rowIndex = options.rowIndex;

    let end = row.length;
    if (options.useRowEnd3f) {
      end = findRowEndMarker(row);
      if (end < row.length) {
        emitRleDebug(options, 'end-3f', {
          row: rowIndex,
          offset: end,
          out: 0,
          remainingBytes: row.length - end - 1,
        });
      }
    }

    const out = [];
    let i = 0;
    let state = RLE_OP;
    let pendingRun = 0;
    let pendingCmd = 0;

    if (options.skipLeadingFF) {
      while (i < end && row[i] === 0xff) i++;
    }

    while (out.length < stitchWidth && i < end) {
      const b = row[i++];

      if (state === RLE_RUN_LEN) {
        pendingRun = b;
        if (pendingRun === 0xff) {
          emitRleDebug(options, 'ff-run-255', {
            row: rowIndex,
            offset: i - 1,
            out: out.length,
            nextByte: i < end ? row[i] : null,
          });
        }
        state = RLE_RUN_IDX;
        continue;
      }

      if (state === RLE_RUN_IDX) {
        const before = out.length;
        const idx = resolveIndexPayload(b, colorCount, tables, options);
        if (idx != null) {
          const write = appendStitches(out, idx, pendingRun, stitchWidth);
          if (pendingRun === 0xff || idx === options.traceIndex) {
            emitRleDebug(options, 'ff-run', {
              row: rowIndex,
              offset: i - 3,
              out: before,
              run: pendingRun,
              rawIndex: b,
              index: idx,
              after: out.length,
              truncated: write.truncated,
            });
          }
        } else {
          emitRleDebug(options, 'dropped-ff-run', {
            row: rowIndex,
            offset: i - 3,
            out: before,
            run: pendingRun,
            rawIndex: b,
          });
        }
        state = RLE_OP;
        pendingRun = 0;
        continue;
      }

      if (state === RLE_EXT_IDX) {
        const before = out.length;
        const idx = resolveIndexPayload(b, colorCount, tables, options);
        if (idx != null) {
          const run = pendingCmd - colorCount + 1;
          const write = appendStitches(out, idx, run, stitchWidth);
          if (idx === options.traceIndex) {
            emitRleDebug(options, 'ext-run', {
              row: rowIndex,
              offset: i - 2,
              out: before,
              cmd: pendingCmd,
              run,
              rawIndex: b,
              index: idx,
              after: out.length,
              truncated: write.truncated,
            });
          }
        } else {
          emitRleDebug(options, 'dropped-ext-run', {
            row: rowIndex,
            offset: i - 2,
            out: before,
            cmd: pendingCmd,
            run: pendingCmd - colorCount + 1,
            rawIndex: b,
          });
        }
        state = RLE_OP;
        pendingCmd = 0;
        continue;
      }

      if (b === 0x3f && options.useRowEnd3f) {
        emitRleDebug(options, 'break-3f', {
          row: rowIndex,
          offset: i - 1,
          out: out.length,
          missing: Math.max(0, stitchWidth - out.length),
        });
        break;
      }

      if (b === 0xff) {
        if (i < end && row[i] === 0xff) {
          emitRleDebug(options, 'ff-ff-candidate', {
            row: rowIndex,
            offset: i - 1,
            out: out.length,
            skipFFPaddingPair: options.skipFFPaddingPair === true,
            followingByte: i + 1 < end ? row[i + 1] : null,
          });
        }
        if (options.skipFFPaddingPair && i < end && row[i] === 0xff) {
          i++;
          continue;
        }
        if (i + 1 >= end) {
          emitRleDebug(options, 'dangling-ff', {
            row: rowIndex,
            offset: i - 1,
            out: out.length,
            missing: Math.max(0, stitchWidth - out.length),
          });
          break;
        }
        state = RLE_RUN_LEN;
        continue;
      }

      if (b === 0xfe) {
        emitRleDebug(options, 'fe-hit', {
          row: rowIndex,
          offset: i - 1,
          out: out.length,
          nextByte: i < end ? row[i] : null,
          feBreakRow: options.feBreakRow === true,
          treatFeAsOpcode: options.treatFeAsOpcode === true,
        });
        if (options.feBreakRow) {
          emitRleDebug(options, 'fe-break-row', {
            row: rowIndex,
            offset: i - 1,
            out: out.length,
            missing: Math.max(0, stitchWidth - out.length),
          });
          break;
        }
        if (!options.treatFeAsOpcode && i < end) {
          pendingCmd = b;
          state = RLE_EXT_IDX;
        }
        continue;
      }

      if ((b === 0xfc || b === 0xc0) && options.skipFcC0) continue;

      if (b === 0xf0 && options.treatF0AsZeroFill) {
        const before = out.length;
        while (i < end && row[i] === 0) i++;
        if (i >= end) {
          emitRleDebug(options, 'dropped-f0', {
            row: rowIndex,
            offset: i - 1,
            out: out.length,
            missing: Math.max(0, stitchWidth - out.length),
          });
          break;
        }
        const run = row[i++];
        const write = appendStitches(out, f0Index, run, stitchWidth);
        if (f0Index === options.traceIndex) {
          emitRleDebug(options, 'f0-run', {
            row: rowIndex,
            offset: i - 2,
            out: before,
            run,
            index: f0Index,
            after: out.length,
            truncated: write.truncated,
          });
        }
        continue;
      }

      if (b < colorCount) {
        if (resolveCollisions && tables.symCollisions.has(b)) {
          const idx = resolveCollisionSymbol(b, tables.symOwners);
          if (idx != null && out.length < stitchWidth) out.push(idx);
        } else {
          if (out.length < stitchWidth) out.push(b);
        }
        continue;
      }

      if (i < end) {
        pendingCmd = b;
        state = RLE_EXT_IDX;
      }
    }

    if (out.length < stitchWidth) {
      emitRleDebug(options, 'pad-row', {
        row: rowIndex,
        offset: i,
        out: out.length,
        missing: stitchWidth - out.length,
        padIndex,
        state,
      });
    }
    while (out.length < stitchWidth) out.push(padIndex);
    return out;
  }

  /** Per-row RLE within fixed-size row slots (dragon/DW60 layout). */
  function decodeRowSlotMatrix(bytes, matrixStart, palette, width, height, options = {}) {
    const colorCount = palette.length;
    const tables = buildSymbolTables(palette);
    const layout = detectRowLayout(width, height);
    const rowBytes = options.rowBytes ?? layout.rowBytes;
    const stitchWidth = options.stitchWidth ?? layout.stitchWidth;
    const matrix = new Uint8Array(width * height);
    const rowOptions = {
      skipLeadingFF: false,
      skipFFPaddingPair: false,
      useRowEnd3f: false,
      allowIndexSymbol: false,
      resolveCollisions: false,
      padIndex: 0,
      f0Index: 0,
      ...(options.rowOptions || {}),
    };

    for (let y = 0; y < height; y++) {
      // Strict row-slot boundary: reset to this absolute offset for every row,
      // decode exactly one slot, then jump to the next slot.
      const rowOffset = matrixStart + y * rowBytes;
      if (rowOffset + rowBytes > bytes.length) break;
      const row = bytes.subarray(rowOffset, rowOffset + rowBytes);
      const decoded = decodeRowRleStateMachine(row, stitchWidth, colorCount, tables, {
        ...rowOptions,
        rowIndex: y,
      });
      for (let x = 0; x < width; x++) {
        matrix[y * width + x] = decoded[x];
      }
    }

    return matrix;
  }

  function resolveIndex(raw, colorCount, symbolMap) {
    if (raw < colorCount) return raw;
    const mapped = symbolMap.get(raw);
    return mapped == null ? null : mapped;
  }

  /** Decompress RLE stitch stream into palette indices (Uint8Array). */
  function decodeRleMatrix(bytes, start, end, colorCount, totalCells, symbolMap) {
    const matrix = new Uint8Array(totalCells);
    let out = 0;
    let i = start;

    while (out < totalCells && i < end) {
      const v = bytes[i++];

      if (v === 0xff) {
        if (i + 1 >= end) break;
        const run = bytes[i++];
        const raw = bytes[i++];
        const idx = resolveIndex(raw, colorCount, symbolMap);
        if (idx == null) continue;
        for (let k = 0; k < run && out < totalCells; k++) matrix[out++] = idx;
        continue;
      }

      if (v === 0xfe) continue;

      if (v < colorCount) {
        matrix[out++] = v;
        continue;
      }

      const symIdx = symbolMap.get(v);
      if (symIdx != null) {
        matrix[out++] = symIdx;
        continue;
      }

      if (i >= end) break;
      const raw = bytes[i++];
      const idx = resolveIndex(raw, colorCount, symbolMap);
      if (idx == null) continue;
      const run = v - colorCount + 1;
      for (let k = 0; k < run && out < totalCells; k++) matrix[out++] = idx;
    }

    while (out < totalCells) matrix[out++] = 0;
    return matrix;
  }

  function validateMatrixCounts(matrix, palette) {
    const counts = new Uint32Array(palette.length);
    for (let cell = 0; cell < matrix.length; cell++) {
      const idx = matrix[cell];
      counts[idx]++;
    }
    let matched = 0;
    const mismatches = [];
    for (const entry of palette) {
      const got = counts[entry.index];
      if (got === entry.count) matched++;
      else if (mismatches.length < 8) mismatches.push({ dmc: entry.dmc, got, expected: entry.count });
    }
    return { matched, total: palette.length, ok: matched === palette.length, mismatches };
  }

  function parsePalette(bytes) {
    const entries = [];
    for (let pos = 16; pos < bytes.length - 3; pos++) {
      if (readU16Le(bytes, pos) !== 1) continue;
      const slen = u8(bytes, pos + 2);
      if (slen < 2 || slen > 5) continue;
      const rawDmc = readAscii(bytes, pos + 3, slen);
      if (!/^B?\d+$/i.test(rawDmc)) continue;
      const dmc = rawDmc.replace(/^B/i, '');
      const rgb = [u8(bytes, pos + 4 + slen), u8(bytes, pos + 5 + slen), u8(bytes, pos + 6 + slen)];
      const count = readU32Be(bytes, pos + 11 + slen);
      const symbol = u8(bytes, pos + 19 + slen - 1);
      entries.push({
        index: entries.length,
        dmc,
        rgb,
        hex: `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`,
        count,
        symbol,
        symbolChar: symbol >= 32 && symbol < 127 ? String.fromCharCode(symbol) : null,
      });
    }
    return entries;
  }

  function findDmcLibraryIndex(dmcCode, dmcLibrary) {
    const needle = String(dmcCode).trim().toUpperCase();
    const bare = (code) => String(code || '').toUpperCase().replace(/^DMC\s*/, '').trim();
    // Exact code match (handles numeric "154" and lettered "B5200"/"BLANC"/"ECRU").
    for (let i = 0; i < dmcLibrary.length; i++) {
      if (bare(dmcLibrary[i].code) === needle) return i;
    }
    // Fallback: compare digits only, for codes stored with stray formatting.
    const needleDigits = needle.replace(/[^0-9]/g, '');
    if (needleDigits) {
      for (let i = 0; i < dmcLibrary.length; i++) {
        if (bare(dmcLibrary[i].code).replace(/[^0-9]/g, '') === needleDigits) return i;
      }
    }
    return -1;
  }

  function mapMatrixToDmcIndices(emMatrix, emPalette, dmcLibrary) {
    const emToDmc = emPalette.map((entry) => {
      const libIdx = findDmcLibraryIndex(entry.dmc, dmcLibrary);
      return libIdx >= 0 ? libIdx : null;
    });

    const matrix = new Uint16Array(emMatrix.length);
    let unmapped = 0;
    for (let i = 0; i < emMatrix.length; i++) {
      const emIdx = emMatrix[i];
      const dmcIdx = emToDmc[emIdx];
      if (dmcIdx == null) {
        unmapped++;
        matrix[i] = 0;
      } else {
        matrix[i] = dmcIdx;
      }
    }

    const activeDmcIndices = [...new Set(emToDmc.filter((v) => v != null))];
    return { matrix, activeDmcIndices, unmappedColors: unmapped };
  }

  function parseEmFile(arrayBuffer, options = {}) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const warnings = [];

    const signature = readSignature(view);
    if (signature !== SIGNATURE) {
      throw new Error(`Unsupported .em signature "${signature}" (expected ${SIGNATURE})`);
    }

    const width = view.getUint16(10);
    const height = view.getUint16(12);
    const colorCount = view.getUint16(14);
    const palette = parsePalette(bytes);

    if (palette.length !== colorCount) {
      warnings.push(`Header color count ${colorCount} but parsed ${palette.length} palette entries.`);
    }

    let paletteEnd = 16;
    for (let pos = 16; pos < bytes.length - 3; pos++) {
      if (readU16Le(bytes, pos) !== 1) continue;
      const slen = u8(bytes, pos + 2);
      if (slen < 2 || slen > 5) continue;
      const dmc = readAscii(bytes, pos + 3, slen);
      if (/^B?\d+$/i.test(dmc)) paletteEnd = pos + 19 + slen;
    }

    const matrixStart = findMatrixStart(bytes, paletteEnd);
    const totalCells = width * height;
    const symbolMap = buildSymbolMap(palette);
    const decoded = decodeEmMatrix(bytes, matrixStart, palette, width, height, symbolMap, {
      inflateSync: options.inflateSync,
    });
    const emMatrix = decoded.matrix;
    const matrixEnd = decoded.matrixEnd;

    const validation = validateMatrixCounts(emMatrix, palette);
    if (!validation.ok) {
      warnings.push(
        `Matrix RLE decoded to ${totalCells} cells but only ${validation.matched}/${validation.total} palette stitch counts match.`
      );
    }

    const pngStart = findPngOffset(bytes);
    // Completed-stitch progress is a 1-bit-per-stitch bitmap stored directly before
    // the embedded PNG (byte-aligned rows, MSB-first, 1 = stitched).
    const doneMatrix = decodeDoneLayer(bytes, width, height, pngStart, paletteEnd);
    let doneCount = 0;
    if (doneMatrix) {
      for (let i = 0; i < doneMatrix.length; i++) doneCount += doneMatrix[i];
    }

    const ihdrOffset = findIhdrOffset(bytes);
    const result = {
      signature,
      width,
      height,
      colorCount: palette.length,
      palette,
      paletteEnd,
      matrixStart,
      matrixEnd,
      matrixByteLength: matrixEnd - matrixStart,
      hasEmbeddedPreview: ihdrOffset >= 0,
      previewOffset: ihdrOffset >= 0 ? ihdrOffset - 4 : null,
      emMatrix,
      doneMatrix,
      doneCount,
      sparsePatches: decoded.sparsePatches,
      decodeMode: decoded.mode,
      validation,
      warnings,
    };

    if (options.dmcLibrary) {
      const mapped = mapMatrixToDmcIndices(emMatrix, palette, options.dmcLibrary);
      result.pattern = {
        width,
        height,
        originX: 0,
        originY: 0,
        matrix: mapped.matrix,
        activeDmcIndices: mapped.activeDmcIndices,
        doneMatrix,
      };
      if (mapped.unmappedColors > 0) {
        warnings.push(`${mapped.unmappedColors} stitches use DMC codes not in the local library.`);
      }
    }

    return result;
  }

  const StitchifyEmParser: any = {
    parseEmFile,
    decodeRleMatrix,
    decodeRowRleStateMachine,
    decodeRowSlotMatrix,
    decodeHybridRleIdatMatrix,
    decodePngRgbMatrix,
    decodeDoneLayer,
    scanEmbeddedPng,
    inflateIdatPayload,
    unfilterPngScanlines,
    extractIdatIndexRows,
    buildSymbolTables,
    parsePalette,
    validateMatrixCounts,
    findMatrixStart,
    findMatrixEnd,
    findRowEndMarker,
    findPngOffset,
    PNG_SIGNATURE,
    RLE_OP,
    RLE_RUN_LEN,
    RLE_RUN_IDX,
    RLE_EXT_IDX,
  };

export { StitchifyEmParser };
export default StitchifyEmParser;
