/**
 * touchbytiha — Client-side image pipeline
 *
 * Quality-first. A makeup portfolio is judged on skin texture, gradient
 * blending and lash detail, so we do not chase a small file size.
 *
 *   1. Decode with an <img> (reliable EXIF rotation on phones).
 *   2. Downscale by repeated halving — a single huge drawImage step from
 *      4000px softens edges, halving keeps them crisp.
 *   3. Encode WebP at 0.92. Only step down if the file exceeds the cap.
 *   4. If still too big, shrink dimensions rather than wreck the quality.
 */

/** Long edge of the stored file. Portfolio tiles are ~1200 CSS px wide, so
 *  2400 covers 2x screens without wasting bytes. */
const MAX_EDGE = 2400;

/** Screenshots are text-heavy: they need resolution more than size. */
const MAX_EDGE_SCREENSHOT = 2000;

/** Above this we re-encode lower. Generous on purpose — a 2 MB photo is
 *  cheap next to the 7.3 MB JPEGs the repo used to ship. */
const MAX_BYTES = 2 * 1024 * 1024;

/** Storage rules reject anything at or above 5 MB. */
const HARD_LIMIT_BYTES = 4.5 * 1024 * 1024;

/** Try these in order. 0.92 is visually close to source. */
const QUALITY_STEPS = [0.92, 0.88, 0.84];

/** Last resort: shrink by 15% at a time instead of dropping quality. */
const DOWNSCALE_STEPS = [0.85, 0.72, 0.6];

const MIN_EDGE = 1200;

/**
 * @typedef {'portfolio' | 'screenshot'} ImageKind
 */

/**
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };

    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Image compression failed.'))),
      type,
      quality
    );
  });
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Your browser could not process this image.');

  // Flatten onto white: photos have no transparency, and alpha in WebP
  // costs bytes for nothing.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  return { canvas, ctx };
}

/**
 * Downscale in halving steps so fine detail survives.
 * @param {HTMLImageElement} img
 * @param {number} targetW
 * @param {number} targetH
 */
function downscaleSmoothly(img, targetW, targetH) {
  let source = img;
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  // Stop while both axes are still at least target-sized, so the final
  // drawImage is always a downscale and never an upscale.
  while (width / 2 >= targetW && height / 2 >= targetH) {
    const nextW = Math.max(targetW, Math.round(width / 2));
    const nextH = Math.max(targetH, Math.round(height / 2));
    const { canvas, ctx } = createCanvas(nextW, nextH);
    ctx.drawImage(source, 0, 0, nextW, nextH);

    // Keep the intermediate canvas as the new source for the next pass.
    source = canvas;
    width = nextW;
    height = nextH;
  }

  const { canvas, ctx } = createCanvas(targetW, targetH);
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas;
}

/**
 * Compress an image file for the site.
 *
 * @param {File} file
 * @param {{ kind?: ImageKind }} [options]
 * @returns {Promise<{blob: Blob, width: number, height: number, quality: number, originalBytes: number}>}
 */
export async function compressImage(file, { kind = 'portfolio' } = {}) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  const img = await decodeImage(file);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  if (!srcW || !srcH) throw new Error('That image has no readable dimensions.');

  const maxEdge = kind === 'screenshot' ? MAX_EDGE_SCREENSHOT : MAX_EDGE;
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));

  let width = Math.max(1, Math.round(srcW * scale));
  let height = Math.max(1, Math.round(srcH * scale));

  let canvas = downscaleSmoothly(img, width, height);

  // WebP at high quality; step quality down only if we blow the cap.
  let blob = null;
  let quality = QUALITY_STEPS[0];

  for (const step of QUALITY_STEPS) {
    blob = await canvasToBlob(canvas, 'image/webp', step);
    quality = step;
    if (blob.type === 'image/webp' && blob.size <= MAX_BYTES) break;
  }

  // Browsers without a WebP encoder hand back PNG. Retry as JPEG rather than
  // uploading a multi-megabyte PNG.
  if (blob && blob.type !== 'image/webp') {
    blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    quality = 0.92;
  }

  // Still too large: give up pixels, not fidelity.
  if (blob && blob.size > MAX_BYTES) {
    for (const factor of DOWNSCALE_STEPS) {
      const nextW = Math.max(MIN_EDGE, Math.round(width * factor));
      const nextH = Math.round((nextW / width) * height);

      width = nextW;
      height = nextH;
      canvas = downscaleSmoothly(img, width, height);

      const type = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
      blob = await canvasToBlob(canvas, type, QUALITY_STEPS[0]);
      quality = QUALITY_STEPS[0];

      if (blob.size <= MAX_BYTES) break;
    }
  }

  if (!blob) throw new Error('Image compression failed.');

  if (blob.size > HARD_LIMIT_BYTES) {
    throw new Error('Image is still too large after compression. Try a smaller photo.');
  }

  // Already small and already sized correctly (e.g. a photo exported from
  // Lightroom): keep the original rather than re-encoding it larger.
  const alreadyFine = scale === 1
    && file.size <= MAX_BYTES
    && file.size <= blob.size
    && (file.type === 'image/webp' || file.type === 'image/jpeg');

  if (alreadyFine) {
    return {
      blob: file,
      width: srcW,
      height: srcH,
      quality: 1,
      originalBytes: file.size,
      keptOriginal: true
    };
  }

  return {
    blob,
    width,
    height,
    quality,
    originalBytes: file.size,
    keptOriginal: false
  };
}

/**
 * @param {number} bytes
 */
export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
