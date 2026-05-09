import html2canvas from 'html2canvas';

export async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  const canvas = await html2canvas(el, {
    useCORS: true,
    allowTaint: true,
    logging: false,
  });
  return canvas;
}

export function samplePixel(canvas: HTMLCanvasElement, x: number, y: number): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#000000';

  const clampedX = Math.max(0, Math.min(x, canvas.width - 1));
  const clampedY = Math.max(0, Math.min(y, canvas.height - 1));
  const data = ctx.getImageData(clampedX, clampedY, 1, 1).data;

  const r = data[0].toString(16).padStart(2, '0');
  const g = data[1].toString(16).padStart(2, '0');
  const b = data[2].toString(16).padStart(2, '0');

  return `#${r}${g}${b}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace(/^#/, '');
  if (cleaned.length !== 6) return null;
  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

export function colorsMatch(a: string, b: string, tolerance = 10): boolean {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a === b;

  return (
    Math.abs(ca.r - cb.r) <= tolerance &&
    Math.abs(ca.g - cb.g) <= tolerance &&
    Math.abs(ca.b - cb.b) <= tolerance
  );
}
