import { Download } from 'lucide-react';

interface TopBarProps {
  onExportClick: () => void;
  isExporting: boolean;
}

export function TopBar({ onExportClick, isExporting }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#241F25] bg-[#080708]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#cinema-stage"
          className="font-display text-lg font-bold tracking-tight text-[#F5F2EC] whitespace-nowrap shrink-0"
        >
          كابيتانو ستوديو
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#A89FA6]">
          <a
            href="#cinema-stage"
            className="hover:text-[#F5F2EC] transition-colors whitespace-nowrap shrink-0"
          >
            العرض السينمائي
          </a>
          <a
            href="#studio-controls"
            className="hover:text-[#F5F2EC] transition-colors whitespace-nowrap shrink-0"
          >
            المؤثرات والموسيقى
          </a>
          <a
            href="#hidden-clues"
            className="hover:text-[#F5F2EC] transition-colors whitespace-nowrap shrink-0"
          >
            الأسرار الخفية
          </a>
          <a
            href="#source-gallery"
            className="hover:text-[#F5F2EC] transition-colors whitespace-nowrap shrink-0"
          >
            الصور الأصلية
          </a>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onExportClick}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-lg bg-[#D99B26] px-4 py-2 text-xs font-bold text-[#080708] hover:bg-[#E7AD3B] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>{isExporting ? 'جاري التصدير...' : 'تصدير لتيك توك'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
