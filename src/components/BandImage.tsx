import { useState } from 'react';
import { BandEdition } from '../types/safestep';

interface BandImageProps {
  edition: BandEdition;
  className?: string;
}

export function BandImage({ edition, className = '' }: BandImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#F1F5F9] text-[#0F172A] p-3 ${className}`}
      >
        <div
          className="w-10 h-10 rounded-full border-2 mb-1.5"
          style={{ borderColor: edition.swatch, backgroundColor: '#FFFFFF' }}
        />
        <span className="text-xs font-bold">{edition.shortName}</span>
      </div>
    );
  }

  return (
    <img
      src={edition.imageUrl}
      alt={edition.shortName}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
