import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { BandEditionId } from '../types/safestep';
import {
  BAND_EDITIONS,
  buildParentBandUrl,
  getEditionById,
} from '../data/safestepData';
import { downloadStickerPng } from '../utils/qrRenderer';
import { BandImage } from './BandImage';
import { QrImage } from './QrImage';

interface PrintQrTabProps {
  baseUrl: string;
  onChangeBaseUrl: (url: string) => void;
  defaultBandId?: string;
}

type SheetMode = 'single' | 'a4_6' | 'a4_12';

export function PrintQrTab({
  baseUrl,
  onChangeBaseUrl,
  defaultBandId,
}: PrintQrTabProps) {
  const [sheetMode, setSheetMode] = useState<SheetMode>('a4_6');
  const [prefix, setPrefix] = useState(() =>
    defaultBandId ? defaultBandId.split('-')[0] || 'SKB' : 'SKB'
  );
  const [startNum, setStartNum] = useState(() => {
    if (!defaultBandId) return 101;
    const parsed = parseInt(defaultBandId.split('-')[1] || '101', 10);
    return Number.isNaN(parsed) ? 101 : parsed;
  });
  const [editionMode, setEditionMode] = useState<BandEditionId | 'mixed'>('mixed');

  const items = useMemo(() => {
    const count = sheetMode === 'single' ? 1 : sheetMode === 'a4_6' ? 6 : 12;
    const cleanPrefix = (prefix.trim().toUpperCase() || 'SKB').slice(0, 4);
    return Array.from({ length: count }, (_, i) => {
      const bandId = `${cleanPrefix}-${String(Math.max(1, startNum) + i).padStart(
        3,
        '0'
      )}`;
      const edId: BandEditionId =
        editionMode === 'mixed'
          ? BAND_EDITIONS[i % BAND_EDITIONS.length].id
          : editionMode;
      const edition = getEditionById(edId);
      return {
        bandId,
        edition,
        url: buildParentBandUrl(baseUrl, bandId),
      };
    });
  }, [sheetMode, prefix, startNum, editionMode, baseUrl]);

  const handleDownloadFirst = () => {
    const first = items[0];
    if (!first) return;
    downloadStickerPng({
      bandId: first.bandId,
      edition: first.edition,
      url: first.url,
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Compact Print Controls (Hidden on Print) */}
      <section className="no-print bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-bold text-[#0F172A]">
            طباعة ملصقات QR للأساور
          </h1>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadFirst}
              className="px-4 py-2.5 bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#CBD5E1] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" strokeWidth={1.75} />
              <span>تحميل PNG</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-[#1E3A8A] hover:bg-[#172D6B] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" strokeWidth={1.75} />
              <span>طباعة الملصقات الآن</span>
            </button>
          </div>
        </div>

        {/* Public Base URL */}
        <div>
          <label
            htmlFor="print-base-url"
            className="block text-xs font-bold text-[#475569] mb-1"
          >
            رابط الموقع العام للموبايل
          </label>
          <input
            id="print-base-url"
            type="url"
            dir="ltr"
            value={baseUrl}
            onChange={(e) => onChangeBaseUrl(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-md bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
          />
        </div>

        {/* Sheet Mode + Prefix + Number + Character */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5 grid grid-cols-3 gap-1.5 p-1 bg-[#F1F5F9] rounded-lg border border-[#E2E8F0]">
            {(
              [
                { id: 'single', label: 'ملصق واحد' },
                { id: 'a4_6', label: '6 ملصقات' },
                { id: 'a4_12', label: '12 ملصق' },
              ] as { id: SheetMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSheetMode(m.id)}
                className={`py-2 text-xs font-bold rounded-md cursor-pointer ${
                  sheetMode === m.id
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#475569]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="sm:col-span-2">
            <input
              type="text"
              dir="ltr"
              maxLength={4}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              aria-label="البادئة"
              className="w-full h-10 px-3 text-xs font-bold text-center border border-[#CBD5E1] rounded-lg uppercase tabular-nums focus:outline-none focus:border-[#1E3A8A]"
            />
          </div>

          <div className="sm:col-span-2">
            <input
              type="number"
              min={1}
              max={9999}
              value={startNum}
              onChange={(e) =>
                setStartNum(Math.max(1, parseInt(e.target.value || '1', 10)))
              }
              aria-label="رقم البداية"
              className="w-full h-10 px-3 text-xs font-bold text-center border border-[#CBD5E1] rounded-lg tabular-nums focus:outline-none focus:border-[#1E3A8A]"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={editionMode}
              onChange={(e) =>
                setEditionMode(e.target.value as BandEditionId | 'mixed')
              }
              aria-label="الشخصية"
              className="w-full h-10 px-3 text-xs font-bold border border-[#CBD5E1] rounded-lg bg-white text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
            >
              <option value="mixed">توزيع كل الشخصيات</option>
              {BAND_EDITIONS.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.shortName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* PRINT-ONLY STICKERS SHEET */}
      <section className="print-only-container bg-white border border-[#E2E8F0] rounded-xl p-6">
        <div
          className={`print-sheet-grid grid gap-5 ${
            sheetMode === 'single'
              ? 'grid-cols-1 max-w-[260px] mx-auto'
              : sheetMode === 'a4_6'
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
          }`}
        >
          {items.map((item) => (
            <div
              key={item.bandId}
              className="crop-mark-card print-card-item relative p-4 bg-white border border-dashed border-[#94A3B8] flex flex-col items-center text-center"
            >
              <div className="w-full flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#E2E8F0]">
                <span className="text-xs font-bold text-[#0F172A]">SafeStep</span>
                <div className="flex items-center gap-1.5">
                  <BandImage
                    edition={item.edition}
                    className="w-6 h-5 rounded-xs border border-[#E2E8F0]"
                  />
                  <span className="text-[11px] font-bold text-[#475569]">
                    {item.edition.shortName}
                  </span>
                </div>
              </div>

              <QrImage
                value={item.url}
                size={320}
                darkColor="#000000"
                className="w-36 h-36 my-1"
                alt={`ملصق ${item.bandId}`}
              />

              <p className="text-base font-bold text-[#0F172A] tabular-nums mt-2">
                {item.bandId}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
