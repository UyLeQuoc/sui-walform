import type { Area } from 'react-easy-crop';

const MAX_OUTPUT_WIDTH = 1600;
const JPEG_QUALITY = 0.9;
/**
 * Hard ceiling on the cropped data URL length. The cover image
 * round-trips through IDB and (on publish) the on-chain JSON, so we
 * have to cap it. ~700 KB of base64 ≈ ~520 KB of JPEG bytes — large
 * enough for a sharp 1600px banner, small enough to keep the form
 * payload reasonable.
 */
const MAX_DATA_URL_BYTES = 700_000;
/** Quality steps used by {@link encodeWithCap}; tried in order. */
const QUALITY_RAMP = [JPEG_QUALITY, 0.8, 0.7, 0.6, 0.5];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load source image'));
    img.src = src;
  });
}

/**
 * Encode the canvas as JPEG, walking the quality ramp until the data URL
 * fits under {@link MAX_DATA_URL_BYTES}. If even the lowest-quality
 * encoding overflows, we throw so the caller can warn the user instead
 * of silently bloating storage.
 */
function encodeWithCap(canvas: HTMLCanvasElement): string {
  let last = '';
  for (const q of QUALITY_RAMP) {
    last = canvas.toDataURL('image/jpeg', q);
    if (last.length <= MAX_DATA_URL_BYTES) return last;
  }
  throw new Error(
    `Cover image is too large after compression (${Math.round(last.length / 1024)} KB). ` +
      'Try a smaller crop.',
  );
}

/**
 * Draws `cropPixels` out of `sourceDataUrl` into an off-screen canvas and
 * returns a JPEG data URL downscaled to at most {@link MAX_OUTPUT_WIDTH}
 * and re-encoded at progressively lower quality until it fits under
 * {@link MAX_DATA_URL_BYTES}. Callers should persist only this return
 * value — the original image never leaves React state.
 */
export async function cropImageToDataUrl(sourceDataUrl: string, cropPixels: Area): Promise<string> {
  const img = await loadImage(sourceDataUrl);

  const scale = Math.min(1, MAX_OUTPUT_WIDTH / cropPixels.width);
  const outW = Math.max(1, Math.round(cropPixels.width * scale));
  const outH = Math.max(1, Math.round(cropPixels.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    img,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outW,
    outH,
  );

  return encodeWithCap(canvas);
}
