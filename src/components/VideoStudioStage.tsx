import React from 'react';
import {
  Eye,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  HIDDEN_CLUES,
  type AspectRatio,
  type HiddenClue,
  type SceneConfig,
} from '../types/cinema';

interface VideoStudioStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  progress: number;
  durationSeconds: number;
  onScrub: (nextProgress: number) => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  xrayClues: boolean;
  onToggleXray: () => void;
  scenes: SceneConfig[];
  discoveredClues: Set<string>;
  lastDiscoveredClue: HiddenClue | null;
  onCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onFullscreen: () => void;
  isTikTokPresetActive: boolean;
  onApplyTikTokPreset: () => void;
}

function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

export function VideoStudioStage({
  canvasRef,
  aspectRatio,
  onAspectRatioChange,
  isPlaying,
  onTogglePlay,
  onRestart,
  progress,
  durationSeconds,
  onScrub,
  playbackSpeed,
  onSpeedChange,
  muted,
  onToggleMute,
  xrayClues,
  onToggleXray,
  scenes,
  discoveredClues,
  lastDiscoveredClue,
  onCanvasClick,
  onFullscreen,
  isTikTokPresetActive,
  onApplyTikTokPreset,
}: VideoStudioStageProps) {
  const currentTime = progress * durationSeconds;

  const containerSizeClass =
    aspectRatio === '9:16'
      ? 'max-w-[390px] aspect-[9/16]'
      : aspectRatio === '1:1'
        ? 'max-w-[540px] aspect-square'
        : 'max-w-[820px] aspect-video';

  return (
    <div className="flex flex-col rounded-2xl border border-[#241F25] bg-[#110F12] p-4 sm:p-6">
      {/* Stage Top Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#241F25] pb-4">
        <div className="flex items-center gap-2 text-xs text-[#A89FA6]">
          <span className="font-semibold text-[#F5F2EC]">معاينة العرض المباشر</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">60 FPS</span>
          <span aria-hidden="true">·</span>
          <span>
            الأسرار المكتشفة {discoveredClues.size}/{HIDDEN_CLUES.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Aspect Ratio Segmented Control */}
          <div className="flex items-center gap-1 rounded-lg bg-[#1A161C] p-1">
            {(['9:16', '16:9', '1:1'] as AspectRatio[]).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => onAspectRatioChange(ratio)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  aspectRatio === ratio
                    ? 'bg-[#D99B26] text-[#080708] font-bold'
                    : 'text-[#A89FA6] hover:text-[#F5F2EC]'
                }`}
              >
                {ratio === '9:16' ? 'عمودي 9:16' : ratio === '16:9' ? 'سينما 16:9' : 'مربع 1:1'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onApplyTikTokPreset}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isTikTokPresetActive
                ? 'border-[#D99B26] bg-[#D99B26] text-[#080708]'
                : 'border-[#2A242B] bg-[#18141A] text-[#F2B705] hover:border-[#D99B26]'
            }`}
          >
            <span>TikTok Preset · 15s</span>
          </button>

          <button
            type="button"
            onClick={onToggleXray}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              xrayClues
                ? 'border-[#D99B26] bg-[#D99B26]/15 text-[#F2B705]'
                : 'border-[#2A242B] bg-[#18141A] text-[#C6BDC4] hover:text-[#F5F2EC]'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{xrayClues ? 'إخفاء مؤشرات الأسرار' : 'كشف الأسرار'}</span>
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative flex min-h-[420px] items-center justify-center rounded-xl bg-[#070608] p-3 sm:p-5">
        <div className={`relative w-full ${containerSizeClass} overflow-hidden rounded-xl border border-[#2C262E] shadow-2xl`}>
          <canvas
            ref={canvasRef}
            onClick={onCanvasClick}
            className="h-full w-full cursor-crosshair block bg-[#050406]"
          />

          {/* Discovery Toast Banner inside viewport */}
          {lastDiscoveredClue && (
            <div className="pointer-events-none absolute inset-x-4 top-12 rounded-lg border border-[#D99B26]/50 bg-[#0D0B0E]/90 px-3.5 py-2.5 text-center backdrop-blur-md">
              <p className="text-xs font-bold text-[#F2B705]">
                تم التقاط لمسة خفية: {lastDiscoveredClue.titleAr}
              </p>
              <p className="mt-0.5 text-[11px] text-[#D8D1D6]">
                {lastDiscoveredClue.secretStoryAr}
              </p>
            </div>
          )}

          {/* Center Play Overlay when paused at start */}
          {!isPlaying && progress === 0 && (
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label="تشغيل الفيديو السينمائي"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/35 transition-opacity hover:bg-black/25 cursor-pointer"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D99B26] text-[#080708] shadow-lg transition-transform hover:scale-105">
                <Play className="h-7 w-7 fill-current translate-x-[-1px]" />
              </span>
              <span className="text-sm font-bold text-[#F5F2EC]">
                اضغط لتشغيل الفيديو بالصوت والموسيقى
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Timeline Scrubber & Clue Markers */}
      <div className="mt-4 space-y-3">
        <div className="relative pt-2">
          {/* Chapter & Clue indicators along timeline */}
          <div className="relative mb-1.5 h-3 w-full">
            {scenes.map((sc, idx) => {
              const startPct = (idx / scenes.length) * 100;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onScrub(idx / scenes.length + 0.005)}
                  style={{ right: `${startPct}%` }}
                  className="absolute top-0 text-[11px] font-medium text-[#A89FA6] hover:text-[#F2B705] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {idx + 1}. {sc.titleAr}
                </button>
              );
            })}
          </div>

          {/* Scrubber Bar (LTR direction for standard video scrubbing math) */}
          <div dir="ltr" className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(e) => onScrub(Number(e.target.value) / 1000)}
              aria-label="شريط التقدم الزمني"
              className="studio-slider w-full"
            />
            {/* Hidden Clue Diamond Markers on timeline */}
            {HIDDEN_CLUES.map((clue) => {
              const sceneIdx = scenes.findIndex((s) => s.id === clue.sceneId);
              if (sceneIdx === -1) return null;
              const midLocal = (clue.sceneStartProgress + clue.sceneEndProgress) / 2;
              const globalPct = ((sceneIdx + midLocal) / scenes.length) * 100;
              const found = discoveredClues.has(clue.id);
              return (
                <button
                  key={clue.id}
                  type="button"
                  title={`${clue.titleAr} (اضغط للانتقال)`}
                  onClick={() => onScrub(globalPct / 100)}
                  style={{ left: `${globalPct}%` }}
                  className={`pointer-events-auto absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border transition-transform hover:scale-150 cursor-pointer ${
                    found
                      ? 'border-emerald-300 bg-emerald-400'
                      : 'border-[#080708] bg-[#F2B705]'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Transport Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              className="inline-flex items-center gap-2 rounded-lg bg-[#D99B26] px-4 py-2 text-xs font-bold text-[#080708] hover:bg-[#E7AD3B] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              <span>{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
            </button>

            <button
              type="button"
              onClick={onRestart}
              aria-label="إعادة من البداية"
              className="inline-flex items-center justify-center rounded-lg border border-[#2A242B] bg-[#18141A] p-2 text-[#C6BDC4] hover:text-[#F5F2EC] transition-colors cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
              className="inline-flex items-center justify-center rounded-lg border border-[#2A242B] bg-[#18141A] p-2 text-[#C6BDC4] hover:text-[#F5F2EC] transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <span className="font-mono-tabular px-2 text-xs text-[#C6BDC4]" dir="ltr">
              {formatTimecode(currentTime)} / {formatTimecode(durationSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-[#1A161C] p-1">
              {[0.5, 1, 1.25].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onSpeedChange(spd)}
                  className={`rounded-md px-2.5 py-1 font-mono-tabular text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    playbackSpeed === spd
                      ? 'bg-[#2C252E] text-[#F2B705] font-bold'
                      : 'text-[#A89FA6] hover:text-[#F5F2EC]'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onFullscreen}
              aria-label="ملء الشاشة"
              className="inline-flex items-center justify-center rounded-lg border border-[#2A242B] bg-[#18141A] p-2 text-[#C6BDC4] hover:text-[#F5F2EC] transition-colors cursor-pointer"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
