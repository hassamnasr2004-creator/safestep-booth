import { useEffect, useState } from 'react';
import { generateQrDataUrl } from '../utils/qrRenderer';

interface QrImageProps {
  value: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
  className?: string;
  alt?: string;
}

export function QrImage({
  value,
  size = 360,
  darkColor = '#0F172A',
  lightColor = '#FFFFFF',
  className = '',
  alt = 'كود QR للسوار الذكي',
}: QrImageProps) {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let active = true;
    generateQrDataUrl(value, { width: size, darkColor, lightColor })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc('');
      });
    return () => {
      active = false;
    };
  }, [value, size, darkColor, lightColor]);

  if (!src) {
    return (
      <div
        className={`bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-xs text-[#475569] ${className}`}
      >
        جارٍ التوليد
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`block ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
