export const PREVIEW_SIZE = 300;
// 2 MB is interpreted conservatively as 2,000,000 bytes (not 2 MiB).
export const MAX_OUTPUT_BYTES = 2_000_000;
export const MAX_INPUT_BYTES = 20_000_000;
export const OUTPUT_PRESETS = {
  libecity: { label: 'リベシティ', size: 500, suffix: '_s' },
  ovice: { label: 'oVice', size: 200, suffix: '_ss' },
} as const;

export type OutputTarget = keyof typeof OUTPUT_PRESETS;
export type OutputShape = 'square' | 'round';
export type Position = { x: number; y: number };

export function inputError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'JPG・PNG・WebPの画像を選んでください。';
  }
  if (file.size > MAX_INPUT_BYTES) {
    return 'このツールで読み込める画像は20 MB以下です。小さくしてから選び直してください。';
  }
  return null;
}

export function outputFilename(target: OutputTarget): string {
  return `profile_icon${OUTPUT_PRESETS[target].suffix}.png`;
}

export function drawExport(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  position: Position,
  scale: number,
  size: number,
  shape: OutputShape,
) {
  const ratio = size / PREVIEW_SIZE;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (shape === 'round') {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
  }
  ctx.drawImage(image, position.x * ratio, position.y * ratio,
    image.width * scale * ratio, image.height * scale * ratio);
  ctx.restore();
}

export function encodePng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.size === 0 || blob.type !== 'image/png') {
        reject(new Error('PNGの作成に失敗しました。画像を選び直してお試しください。'));
      } else if (blob.size > MAX_OUTPUT_BYTES) {
        reject(new Error('出力が2 MBを超えたため保存を中止しました。別の画像でお試しください。'));
      } else {
        resolve(blob);
      }
    }, 'image/png');
  });
}
