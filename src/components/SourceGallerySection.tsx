import { Play } from 'lucide-react';
import type { SceneConfig } from '../types/cinema';

interface SourceGallerySectionProps {
  scenes: SceneConfig[];
  onPlayScene: (sceneIndex: number) => void;
}

export function SourceGallerySection({ scenes, onPlayScene }: SourceGallerySectionProps) {
  return (
    <section
      id="source-gallery"
      className="mt-14 border-t border-[#241F25] pt-12"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#F2B705]">المشاهد الأصلية · 3 فصول</p>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[#F5F2EC]">
            اللوحات التي صُنع منها الفيلم
          </h2>
        </div>
        <p className="max-w-md text-sm text-[#A89FA6]">
          اضغط على أي لوحة للانتقال المباشر إلى فصلها داخل الفيديو ومراقبة الحركة والمؤثرات.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {scenes.map((scene, idx) => (
          <article
            key={scene.id}
            className="group flex flex-col overflow-hidden rounded-2xl border border-[#241F25] bg-[#110F12] transition-colors hover:border-[#3A323C]"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#09070A]">
              <img
                src={scene.imageUrl}
                alt={scene.titleAr}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
              <button
                type="button"
                onClick={() => onPlayScene(idx)}
                className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-lg bg-[#D99B26] px-3.5 py-2 text-xs font-bold text-[#080708] shadow-lg hover:bg-[#E7AD3B] transition-colors cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>شغّل هذا الفصل</span>
              </button>
            </div>

            <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#A89FA6]">
                  <span className="font-mono-tabular text-[#F2B705]">0{idx + 1}</span>
                  <span aria-hidden="true">·</span>
                  <span>{scene.kicker}</span>
                </div>
                <h3 className="mt-1.5 text-lg font-bold text-[#F5F2EC]">{scene.titleAr}</h3>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#F5E6C4]">
                  « {scene.loyaltyQuote} »
                </p>
                <p className="mt-1.5 text-[11px] text-[#9A9098]">{scene.caption}</p>
              </div>

              <div className="mt-4 border-t border-[#221D24] pt-3 font-display text-[11px] tracking-wider text-[#8E848C]">
                {scene.subtitleIt}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
