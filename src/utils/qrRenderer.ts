import QRCode from 'qrcode';
import { BandEdition } from '../types/safestep';

// Error Correction Level 'M' + clean quiet zone (margin: 3) for large, fast-scannable QR squares on smartphones
export async function generateQrDataUrl(
  content: string,
  options?: { width?: number; darkColor?: string; lightColor?: string }
): Promise<string> {
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: 'M',
    margin: 3,
    width: options?.width ?? 440,
    color: {
      dark: options?.darkColor ?? '#0F172A',
      light: options?.lightColor ?? '#FFFFFF',
    },
  });
}

export async function downloadStickerPng(params: {
  bandId: string;
  edition: BandEdition;
  url: string;
}): Promise<void> {
  const width = 700;
  const height = 780;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 32px Alexandria, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SafeStep', width / 2, 76);

  const qrSize = 480;
  const qrDataUrl = await generateQrDataUrl(params.url, {
    width: 960,
    darkColor: '#000000',
    lightColor: '#FFFFFF',
  });

  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = reject;
    qrImg.src = qrDataUrl;
  });

  ctx.drawImage(qrImg, (width - qrSize) / 2, 102, qrSize, qrSize);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 46px Alexandria, monospace';
  ctx.fillText(params.bandId, width / 2, 650);

  ctx.fillStyle = '#475569';
  ctx.font = '600 28px Alexandria, sans-serif';
  ctx.fillText(params.edition.shortName, width / 2, 706);

  const link = document.createElement('a');
  link.download = `SafeStep-${params.bandId}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
