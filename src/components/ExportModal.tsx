import { useState } from 'react';
import { Check, CheckCircle2, Copy, Download, Film, X } from 'lucide-react';
import type { ExportState } from '../types/cinema';

interface ExportModalProps {
  exportState: ExportState;
  durationSeconds: number;
  onClose: () => void;
  onStartExport: () => void;
}

const TIKTOK_CAPTION = `6 أسرار مخفية عن ملك روما فرانشيسكو توتي... كم واحداً لاحظت في الفيديو؟ 👀⚽️🇮🇹

25 سنة وفاء، 786 مباراة، وبطل كأس العالم 2006 🏆
اكتب عدد الأسرار التي اكتشفتها في التعليقات 👇

#فرانشيسكو_توتي #توتي #روما #كأس_العالم #كرة_القدم #تيك_توك_الرياضي #Totti #FrancescoTotti #ASRoma #ForzaRoma #Calcio`;

export function ExportModal({
  exportState,
  durationSeconds,
  onClose,
  onStartExport,
}: ExportModalProps) {
  const [copiedCaption, setCopiedCaption] = useState(false);

  if (exportState.status === 'idle') return null;

  const pct = Math.round(exportState.progress * 100);
  const fileExt = exportState.mimeType.includes('mp4') ? 'mp4' : 'webm';

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(TIKTOK_CAPTION);
      setCopiedCaption(true);
      window.setTimeout(() => setCopiedCaption(false), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2B252C] bg-[#110F12] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#241F25] pb-4">
          <div className="flex items-center gap-2.5">
            <Film className="h-5 w-5 text-[#F2B705]" />
            <h2 id="export-modal-title" className="text-base font-bold text-[#F5F2EC]">
              تصدير فيديو تيك توك (1080×1920)
            </h2>
          </div>
          {exportState.status !== 'recording' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="rounded-lg p-1.5 text-[#A89FA6] hover:bg-[#1E1A20] hover:text-[#F5F2EC] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-5 space-y-4">
          {exportState.status === 'preparing' && (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm font-semibold text-[#F5F2EC]">
                جاري تهيئة مسار تيك توك 9:16 بدقة عالية والصوت الاستريو...
              </p>
              <p className="text-xs text-[#A89FA6]">
                سيتم دمج الصور والمؤثرات والموسيقى والأسرار الخفية في ملف واحد جاهز للنشر.
              </p>
            </div>
          )}

          {exportState.status === 'recording' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#C6BDC4]">
                  جاري التسجيل والدمج بالزمن الحقيقي ({durationSeconds} ثانية)...
                </span>
                <span className="font-mono-tabular font-bold text-[#F2B705]">{pct}%</span>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#221D24]">
                <div
                  className="h-full bg-[#D99B26] transition-[width] duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="text-[11px] text-[#8E848C]">
                يرجى إبقاء هذه النافذة مفتوحة حتى يكتمل التصدير بنسبة 100% لضمان جودة الإطارات والصوت.
              </p>
            </div>
          )}

          {exportState.status === 'done' && exportState.videoUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>الفيديو جاهز للنشر على تيك توك!</span>
              </div>

              <video
                src={exportState.videoUrl}
                controls
                playsInline
                className="mx-auto max-h-[290px] w-auto rounded-xl border border-[#29232B] bg-black"
              />

              {/* TikTok Caption + Hashtags Helper */}
              <div className="rounded-xl border border-[#252027] bg-[#161318] p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#F2B705]">
                    وصف وهاشتاغات تيك توك المقترحة
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#2D262F] bg-[#1E1920] px-2.5 py-1 text-[11px] font-semibold text-[#F5F2EC] hover:border-[#D99B26] transition-colors cursor-pointer"
                  >
                    {copiedCaption ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>نسخ الوصف</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="whitespace-pre-line text-[11px] leading-relaxed text-[#C6BDC4]">
                  {TIKTOK_CAPTION}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-[#2C262E] px-4 py-2 text-xs font-semibold text-[#C6BDC4] hover:text-[#F5F2EC] cursor-pointer"
                >
                  إغلاق
                </button>
                <a
                  href={exportState.videoUrl}
                  download={`totti-tiktok-9x16.${fileExt}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D99B26] px-5 py-2 text-xs font-bold text-[#080708] hover:bg-[#E7AD3B] transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>تحميل فيديو تيك توك ({fileExt.toUpperCase()})</span>
                </a>
              </div>
            </div>
          )}

          {exportState.status === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-rose-400">
                {exportState.errorMessage || 'حدث خطأ أثناء تسجيل الفيديو في هذا المتصفح.'}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-[#2C262E] px-4 py-2 text-xs text-[#C6BDC4] cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={onStartExport}
                  className="rounded-lg bg-[#D99B26] px-4 py-2 text-xs font-bold text-[#080708] cursor-pointer"
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
