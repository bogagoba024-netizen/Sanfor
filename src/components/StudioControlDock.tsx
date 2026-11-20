import React, { useRef, useState } from 'react';
import {
  Camera,
  Check,
  Compass,
  Film,
  Flame,
  Heart,
  Music,
  Play,
  Search,
  Sliders,
  Type,
  Upload,
  Volume2,
  Zap,
} from 'lucide-react';
import { cinemaAudioEngine } from '../audio/cinemaAudioEngine';
import {
  HIDDEN_CLUES,
  LOYALTY_QUOTE_PRESETS,
  type AudioMixerState,
  type DurationPreset,
  type HiddenClue,
  type MusicTheme,
  type QuoteAnimationStyle,
  type SceneConfig,
  type SceneId,
  type TouchOptions,
  type VisualPreset,
} from '../types/cinema';

type BooleanTouchKey = Exclude<keyof TouchOptions, 'quoteStyle'>;

interface StudioControlDockProps {
  preset: VisualPreset;
  onPresetChange: (preset: VisualPreset) => void;
  durationSeconds: DurationPreset;
  onDurationChange: (dur: DurationPreset) => void;
  touches: TouchOptions;
  onToggleTouch: (key: BooleanTouchKey) => void;
  onQuoteStyleChange: (style: QuoteAnimationStyle) => void;
  onUpdateSceneQuote: (sceneId: SceneId, quote: string) => void;
  onPreviewScene: (sceneIndex: number) => void;
  onApplyLoyaltyVideoMode: () => void;
  mixer: AudioMixerState;
  onMixerChange: (next: AudioMixerState) => void;
  scenes: SceneConfig[];
  onSwapSceneOrder: (index: number, direction: -1 | 1) => void;
  onToggleSceneFx: (sceneId: SceneId, fx: 'fadingColors' | 'softShimmer') => void;
  discoveredClues: Set<string>;
  onJumpToClue: (clue: HiddenClue) => void;
  onRevealAllClues: () => void;
  isTikTokPresetActive: boolean;
  onApplyTikTokPreset: () => void;
}

type DockTab = 'quotes' | 'visuals' | 'audio' | 'clues';

export function StudioControlDock({
  preset,
  onPresetChange,
  durationSeconds,
  onDurationChange,
  touches,
  onToggleTouch,
  onQuoteStyleChange,
  onUpdateSceneQuote,
  onPreviewScene,
  onApplyLoyaltyVideoMode,
  mixer,
  onMixerChange,
  scenes,
  onSwapSceneOrder,
  onToggleSceneFx,
  discoveredClues,
  onJumpToClue,
  onRevealAllClues,
  isTikTokPresetActive,
  onApplyTikTokPreset,
}: StudioControlDockProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('quotes');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCustomAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const name = await cinemaAudioEngine.loadCustomAudio(file);
      onMixerChange({
        ...mixer,
        theme: 'custom',
        customTrackName: name,
      });
    } catch {
      setUploadError('تعذر قراءة الملف الصوتي. يرجى اختيار ملف MP3 أو WAV صالح.');
    }
  };

  const presetItems: { id: VisualPreset; title: string; subtitle: string }[] = [
    {
      id: 'golden_gladiator',
      title: 'توهج روما الذهبي',
      subtitle: 'دفء سينمائي ذهبي ولمعان درامي',
    },
    {
      id: 'noir_stadium',
      title: 'دراما المدرجات',
      subtitle: 'تباين عميق وأجواء وثائقية فاخرة',
    },
    {
      id: 'paint_energy',
      title: 'انفجار الألوان',
      subtitle: 'إبراز طلاء الجداريات وألوان الأزوري',
    },
  ];

  const touchItems: { key: BooleanTouchKey; label: string; desc: string }[] = [
    { key: 'showLoyaltyQuotes', label: 'عبارات الوفاء على الصور', desc: 'إظهار عبارة وفاء خاصة على كل مشهد' },
    { key: 'tiktokLetterbox', label: 'حدود سينمائية: أسطورة روما', desc: 'إطار أسود علوي وسفلي مع النص الذهبي' },
    { key: 'fadingColors', label: 'تأثير الألوان المتلاشية', desc: 'تلاشي درامي للألوان نحو طابع الذكريات' },
    { key: 'softShimmer', label: 'تأثير اللمعان الخافت', desc: 'هالة ضوئية ناعمة وبريق ذهبي هادئ' },
    { key: 'embers', label: 'شرارات الذهب والملعب', desc: 'جزيئات متوهجة صاعدة' },
    { key: 'spotlightSweeps', label: 'كشافات الأولمبيكو', desc: 'أشعة إضاءة متحركة' },
    { key: 'flashbulbs', label: 'فلاشات المصورين', desc: 'ومضات كاميرا عشوائية' },
    { key: 'kineticStats', label: 'العدادات الرقمية الحية', desc: '786 مباراة · 307 هدف' },
    { key: 'beatShake', label: 'اهتزاز الإيقاع', desc: 'تفاعل الكاميرا مع الطبول' },
    { key: 'filmGrain', label: 'تحبيب الفيلم السينمائي', desc: 'ملمس سينمائي 35mm' },
    { key: 'hiddenClues', label: 'تضمين الأسرار الخفية', desc: '6 لمسات يبحث عنها المشاهد' },
  ];

  const musicThemes: { id: MusicTheme; label: string; desc: string }[] = [
    {
      id: 'rome_epic',
      label: 'ملحمة روما الخالدة',
      desc: 'أوركسترا وتريات وطبول تايكو · 98 BPM',
    },
    {
      id: 'berlin_adrenaline',
      label: 'أدرينالين نهائي برلين',
      desc: 'إيقاع حماسي متسارع · 118 BPM',
    },
    {
      id: 'farewell_nostalgia',
      label: 'نوستالجيا الوداع (25 عاماً)',
      desc: 'بيانو عاطفي وأوتار دافئة · 78 BPM',
    },
  ];

  return (
    <aside
      id="studio-controls"
      className="flex flex-col rounded-2xl border border-[#241F25] bg-[#110F12] p-5"
    >
      {/* Segmented Navigation Tabs */}
      <div className="mb-5 grid grid-cols-4 gap-1 rounded-xl bg-[#1A161C] p-1">
        <button
          type="button"
          onClick={() => setActiveTab('quotes')}
          className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'quotes'
              ? 'bg-[#D99B26] text-[#080708] font-bold'
              : 'text-[#A89FA6] hover:text-[#F5F2EC]'
          }`}
        >
          <Type className="h-3.5 w-3.5 shrink-0" />
          <span>الوفاء</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('visuals')}
          className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'visuals'
              ? 'bg-[#D99B26] text-[#080708] font-bold'
              : 'text-[#A89FA6] hover:text-[#F5F2EC]'
          }`}
        >
          <Sliders className="h-3.5 w-3.5 shrink-0" />
          <span>اللمسات</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audio')}
          className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'audio'
              ? 'bg-[#D99B26] text-[#080708] font-bold'
              : 'text-[#A89FA6] hover:text-[#F5F2EC]'
          }`}
        >
          <Music className="h-3.5 w-3.5 shrink-0" />
          <span>الصوت</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('clues')}
          className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'clues'
              ? 'bg-[#D99B26] text-[#080708] font-bold'
              : 'text-[#A89FA6] hover:text-[#F5F2EC]'
          }`}
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span>الأسرار</span>
        </button>
      </div>

      {/* TAB 0: LOYALTY QUOTES PER IMAGE */}
      {activeTab === 'quotes' && (
        <div className="space-y-5">
          {/* Quick Action: Play Loyalty Video Mode */}
          <div className="rounded-xl border border-[#D99B26]/35 bg-[#D99B26]/10 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-[#F2B705]">فيديو عبارات الوفاء الجاهز</h3>
                <p className="mt-0.5 text-[11px] text-[#D8D1D6]">
                  يجمع الصور الثلاث بعبارات الوفاء وموسيقى الوداع واللمعان الخافت.
                </p>
              </div>
              <button
                type="button"
                onClick={onApplyLoyaltyVideoMode}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#D99B26] px-3 py-2 text-xs font-bold text-[#080708] hover:bg-[#E7AD3B] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>تشغيل الفيديو</span>
              </button>
            </div>
          </div>

          {/* Toggle Show Quotes */}
          <button
            type="button"
            onClick={() => onToggleTouch('showLoyaltyQuotes')}
            className="flex w-full items-center justify-between rounded-xl border border-[#252027] bg-[#161318] px-3.5 py-2.5 text-right hover:border-[#352D37] transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-semibold text-[#F5F2EC]">إظهار عبارات الوفاء على الفيديو</div>
              <div className="text-[11px] text-[#8E848C]">عرض عبارة مستقلة فوق كل صورة</div>
            </div>
            <span
              className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                touches.showLoyaltyQuotes ? 'bg-[#D99B26]' : 'bg-[#2C262E]'
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-[#080708] transition-transform ${
                  touches.showLoyaltyQuotes ? '-translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
          </button>

          {/* Quote Animation Style */}
          <div>
            <h3 className="mb-2 text-xs font-bold text-[#F5F2EC]">أسلوب ظهور العبارة</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'glow_fade', label: 'توهج سينمائي' },
                  { id: 'word_by_word', label: 'كلمة بكلمة' },
                  { id: 'clean_banner', label: 'شريط أنيق' },
                ] as { id: QuoteAnimationStyle; label: string }[]
              ).map((styleItem) => (
                <button
                  key={styleItem.id}
                  type="button"
                  onClick={() => onQuoteStyleChange(styleItem.id)}
                  className={`rounded-lg border py-2 px-2 text-center text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    touches.quoteStyle === styleItem.id
                      ? 'border-[#D99B26] bg-[#D99B26]/15 text-[#F2B705]'
                      : 'border-[#252027] bg-[#161318] text-[#B8B0B7] hover:text-[#F5F2EC]'
                  }`}
                >
                  {styleItem.label}
                </button>
              ))}
            </div>
          </div>

          {/* Per-Image Loyalty Quote Editors */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#F5F2EC]">تعديل عبارة كل صورة</h3>
            {scenes.map((sc, idx) => {
              const presets = LOYALTY_QUOTE_PRESETS[sc.id] || [];
              return (
                <div
                  key={sc.id}
                  className="rounded-xl border border-[#252027] bg-[#161318] p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={sc.imageUrl}
                        alt={sc.titleAr}
                        referrerPolicy="no-referrer"
                        className="h-9 w-7 rounded object-cover shrink-0 border border-[#2D262F]"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#F5F2EC]">
                          0{idx + 1}. {sc.titleAr}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPreviewScene(idx)}
                      className="rounded-md bg-[#231E25] px-2.5 py-1 text-[11px] font-semibold text-[#F2B705] hover:bg-[#2E2730] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      معاينة المشهد
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    value={sc.loyaltyQuote}
                    onChange={(e) => onUpdateSceneQuote(sc.id, e.target.value)}
                    placeholder="اكتب عبارة عن الوفاء لهذه الصورة..."
                    className="w-full resize-none rounded-lg border border-[#2B252D] bg-[#0D0B0E] px-3 py-2 text-xs leading-relaxed text-[#F5F2EC] placeholder-[#6E656D] focus:border-[#D99B26] focus:outline-none"
                  />

                  {presets.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {presets.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          type="button"
                          onClick={() => onUpdateSceneQuote(sc.id, q)}
                          className={`rounded border px-2 py-0.5 text-[10px] transition-colors cursor-pointer ${
                            sc.loyaltyQuote === q
                              ? 'border-[#D99B26] bg-[#D99B26]/15 text-[#F2B705]'
                              : 'border-[#2A242B] bg-[#110F12] text-[#A89FA6] hover:text-[#F5F2EC]'
                          }`}
                        >
                          عبارة مقترحة {qIdx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: VISUAL TOUCHES & PACING */}
      {activeTab === 'visuals' && (
        <div className="space-y-6">
          {/* TikTok Preset One-Click Display Configuration */}
          <div>
            <h3 className="mb-2.5 text-sm font-bold text-[#F5F2EC]">إعدادات العرض السريعة</h3>
            <button
              type="button"
              onClick={onApplyTikTokPreset}
              className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-right transition-colors cursor-pointer ${
                isTikTokPresetActive
                  ? 'border-[#D99B26] bg-[#D99B26]/15'
                  : 'border-[#2B252D] bg-[#161318] hover:border-[#D99B26]/70'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Film className="mt-0.5 h-4 w-4 text-[#F2B705] shrink-0" />
                <div>
                  <div className="text-xs font-bold text-[#F5F2EC]" dir="ltr">
                    TikTok Preset
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#B8B0B7]">
                    تنسيق 9:16 · حدود سوداء «أسطورة روما» · مدة 15 ثانية
                  </div>
                </div>
              </div>
              {isTikTokPresetActive ? (
                <Check className="h-4 w-4 text-[#F2B705] shrink-0" />
              ) : (
                <span className="text-[11px] font-bold text-[#F2B705] whitespace-nowrap shrink-0">
                  تطبيق
                </span>
              )}
            </button>
          </div>

          {/* Color Grade Presets */}
          <div>
            <h3 className="mb-2.5 text-sm font-bold text-[#F5F2EC]">الطابع البصري واللون</h3>
            <div className="grid gap-2">
              {presetItems.map((item) => {
                const active = preset === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onPresetChange(item.id)}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-right transition-colors cursor-pointer ${
                      active
                        ? 'border-[#D99B26] bg-[#D99B26]/10'
                        : 'border-[#252027] bg-[#161318] hover:border-[#3A323C]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-[#F5F2EC]">{item.title}</div>
                      <div className="text-[11px] text-[#A89FA6]">{item.subtitle}</div>
                    </div>
                    {active && <Check className="h-4 w-4 text-[#F2B705] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration / Rhythm */}
          <div>
            <h3 className="mb-2.5 text-sm font-bold text-[#F5F2EC]">إيقاع ومدة الفيديو</h3>
            <div className="grid grid-cols-4 gap-2">
              {([15, 18, 27, 36] as DurationPreset[]).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onDurationChange(sec)}
                  className={`rounded-lg border py-2 text-center text-xs font-semibold transition-colors cursor-pointer ${
                    durationSeconds === sec
                      ? 'border-[#D99B26] bg-[#D99B26]/15 text-[#F2B705]'
                      : 'border-[#252027] bg-[#161318] text-[#B8B0B7] hover:text-[#F5F2EC]'
                  }`}
                >
                  <span className="font-mono-tabular block text-sm font-bold">{sec}s</span>
                  <span className="text-[10px] text-[#8E848C]">
                    {sec === 15
                      ? 'تيك توك'
                      : sec === 18
                        ? 'سريع ريلز'
                        : sec === 27
                          ? 'ملحمي'
                          : 'وثائقي'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Toggleable Visual Touches */}
          <div>
            <h3 className="mb-2.5 text-sm font-bold text-[#F5F2EC]">اللمسات البصرية المضافة</h3>
            <div className="space-y-2">
              {touchItems.map((item) => {
                const enabled = touches[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onToggleTouch(item.key)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#252027] bg-[#161318] px-3.5 py-2.5 text-right hover:border-[#352D37] transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[#F5F2EC]">{item.label}</div>
                      <div className="text-[11px] text-[#8E848C]">{item.desc}</div>
                    </div>
                    <span
                      className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                        enabled ? 'bg-[#D99B26]' : 'bg-[#2C262E]'
                      }`}
                    >
                      <span
                        className={`h-4 w-4 rounded-full bg-[#080708] transition-transform ${
                          enabled ? '-translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scene Sequence & Per-Image Effects */}
          <div>
            <h3 className="mb-2.5 text-sm font-bold text-[#F5F2EC]">ترتيب الفصول ومؤثرات كل صورة</h3>
            <div className="space-y-2.5">
              {scenes.map((sc, idx) => (
                <div
                  key={sc.id}
                  className="rounded-xl border border-[#252027] bg-[#161318] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={sc.imageUrl}
                        alt={sc.titleAr}
                        referrerPolicy="no-referrer"
                        className="h-10 w-8 rounded object-cover shrink-0 border border-[#2D262F]"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#F5F2EC]">{sc.titleAr}</p>
                        <p className="truncate text-[11px] text-[#8E848C]">{sc.kicker}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => onSwapSceneOrder(idx, -1)}
                        className="rounded border border-[#2C262E] px-2 py-1 text-[11px] text-[#C6BDC4] hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        أعلى
                      </button>
                      <button
                        type="button"
                        disabled={idx === scenes.length - 1}
                        onClick={() => onSwapSceneOrder(idx, 1)}
                        className="rounded border border-[#2C262E] px-2 py-1 text-[11px] text-[#C6BDC4] hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        أسفل
                      </button>
                    </div>
                  </div>

                  {/* Per-Image Effect Toggles */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[#221D24] pt-2.5">
                    <button
                      type="button"
                      onClick={() => onToggleSceneFx(sc.id, 'fadingColors')}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        sc.fadingColors
                          ? 'border-[#D99B26] bg-[#D99B26]/15 text-[#F2B705]'
                          : 'border-[#2B252D] bg-[#120F14] text-[#8E848C] hover:text-[#D8D1D6]'
                      }`}
                    >
                      الألوان المتلاشية {sc.fadingColors ? '· مفعل' : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleSceneFx(sc.id, 'softShimmer')}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        sc.softShimmer
                          ? 'border-[#D99B26] bg-[#D99B26]/15 text-[#F2B705]'
                          : 'border-[#2B252D] bg-[#120F14] text-[#8E848C] hover:text-[#D8D1D6]'
                      }`}
                    >
                      اللمعان الخافت {sc.softShimmer ? '· مفعل' : ''}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MUSIC & SOUND EFFECTS */}
      {activeTab === 'audio' && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2.5 text-sm font-bold text-[#F5F2EC]">الموسيقى التصويرية</h3>
            <div className="space-y-2">
              {musicThemes.map((theme) => {
                const active = mixer.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onMixerChange({ ...mixer, theme: theme.id })}
                    className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-right transition-colors cursor-pointer ${
                      active
                        ? 'border-[#D99B26] bg-[#D99B26]/10'
                        : 'border-[#252027] bg-[#161318] hover:border-[#3A323C]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-[#F5F2EC]">{theme.label}</div>
                      <div className="text-[11px] text-[#A89FA6]">{theme.desc}</div>
                    </div>
                    {active && <Check className="h-4 w-4 text-[#F2B705] shrink-0" />}
                  </button>
                );
              })}

              {/* Custom Audio Upload */}
              <div className="pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleCustomAudioUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                    mixer.theme === 'custom'
                      ? 'border-[#D99B26] bg-[#D99B26]/10 text-[#F2B705]'
                      : 'border-[#332B35] bg-[#141116] text-[#B8B0B7] hover:border-[#D99B26]/60'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[240px]">
                    {mixer.customTrackName
                      ? `مقطوعة مخصصة: ${mixer.customTrackName}`
                      : 'أو ارفع موسيقاك الخاصة (MP3 / WAV)'}
                  </span>
                </button>
                {uploadError && (
                  <p className="mt-1.5 text-[11px] text-rose-400">{uploadError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Mixer Sliders */}
          <div className="space-y-4 border-t border-[#241F25] pt-4">
            <h3 className="text-sm font-bold text-[#F5F2EC]">موازن الصوت الاحترافي</h3>
            {[
              { key: 'musicVolume' as const, label: 'الموسيقى الأوركسترالية' },
              { key: 'sfxVolume' as const, label: 'المؤثرات السينمائية (SFX)' },
              { key: 'crowdVolume' as const, label: 'هدير جماهير الملعب' },
            ].map((slider) => (
              <div key={slider.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#C6BDC4]">{slider.label}</span>
                  <span className="font-mono-tabular text-[#F2B705]">
                    {Math.round(mixer[slider.key] * 100)}%
                  </span>
                </div>
                <div dir="ltr">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(mixer[slider.key] * 100)}
                    onChange={(e) =>
                      onMixerChange({
                        ...mixer,
                        [slider.key]: Number(e.target.value) / 100,
                      })
                    }
                    className="studio-slider w-full"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Interactive SFX Soundboard */}
          <div className="border-t border-[#241F25] pt-4">
            <h3 className="mb-2.5 text-sm font-bold text-[#F5F2EC]">لوحة تجربة المؤثرات الفورية</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cinemaAudioEngine.playWhistle()}
                className="flex items-center gap-2 rounded-lg border border-[#2A242B] bg-[#18141A] px-3 py-2 text-xs text-[#E5DFE4] hover:border-[#D99B26] transition-colors cursor-pointer"
              >
                <Volume2 className="h-3.5 w-3.5 text-[#F2B705]" />
                <span>صافرة البداية</span>
              </button>
              <button
                type="button"
                onClick={() => cinemaAudioEngine.playCrowdRoar(2.2, 0.8)}
                className="flex items-center gap-2 rounded-lg border border-[#2A242B] bg-[#18141A] px-3 py-2 text-xs text-[#E5DFE4] hover:border-[#D99B26] transition-colors cursor-pointer"
              >
                <Flame className="h-3.5 w-3.5 text-[#F2B705]" />
                <span>زئير الأولمبيكو</span>
              </button>
              <button
                type="button"
                onClick={() => cinemaAudioEngine.playBassDrop()}
                className="flex items-center gap-2 rounded-lg border border-[#2A242B] bg-[#18141A] px-3 py-2 text-xs text-[#E5DFE4] hover:border-[#D99B26] transition-colors cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5 text-[#F2B705]" />
                <span>ضربة انتقال سينمائية</span>
              </button>
              <button
                type="button"
                onClick={() => cinemaAudioEngine.playFlashBurst()}
                className="flex items-center gap-2 rounded-lg border border-[#2A242B] bg-[#18141A] px-3 py-2 text-xs text-[#E5DFE4] hover:border-[#D99B26] transition-colors cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5 text-[#F2B705]" />
                <span>فلاش الصحافة</span>
              </button>
              <button
                type="button"
                onClick={() => cinemaAudioEngine.playHeartbeat()}
                className="flex items-center gap-2 rounded-lg border border-[#2A242B] bg-[#18141A] px-3 py-2 text-xs text-[#E5DFE4] hover:border-[#D99B26] transition-colors cursor-pointer"
              >
                <Heart className="h-3.5 w-3.5 text-[#C81E3A]" />
                <span>نبض الوفاء</span>
              </button>
              <button
                type="button"
                onClick={() => cinemaAudioEngine.playSecretChime()}
                className="flex items-center gap-2 rounded-lg border border-[#2A242B] bg-[#18141A] px-3 py-2 text-xs text-[#E5DFE4] hover:border-[#D99B26] transition-colors cursor-pointer"
              >
                <Compass className="h-3.5 w-3.5 text-[#F2B705]" />
                <span>رنين السر الخفي</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HIDDEN EASTER EGGS HUNTER */}
      {activeTab === 'clues' && (
        <div id="hidden-clues" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#F5F2EC]">اللمسات التي يبحث عنها المشاهد</h3>
              <p className="mt-0.5 text-[11px] text-[#A89FA6]">
                اضغط على الوميض داخل الفيديو أثناء المشاهدة أو انتقل للحظة لاكتشاف كل سر.
              </p>
            </div>
            <button
              type="button"
              onClick={onRevealAllClues}
              className="rounded-lg border border-[#2F2831] bg-[#1A161C] px-2.5 py-1.5 text-[11px] font-semibold text-[#F2B705] hover:bg-[#231D26] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              إظهار الكل
            </button>
          </div>

          <div className="space-y-2.5">
            {HIDDEN_CLUES.map((clue, index) => {
              const found = discoveredClues.has(clue.id);
              return (
                <div
                  key={clue.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    found
                      ? 'border-emerald-500/40 bg-emerald-950/15'
                      : 'border-[#252027] bg-[#161318]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-[#F5F2EC]">
                        <span className="font-mono-tabular text-[#F2B705]">0{index + 1}.</span>
                        <span>{clue.titleAr}</span>
                      </div>
                      <div className="mt-0.5 font-display text-[10px] tracking-wider text-[#9A9098]">
                        {clue.subtitleIt}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onJumpToClue(clue)}
                      className="rounded-md bg-[#231E25] px-2.5 py-1 text-[11px] font-semibold text-[#F2B705] hover:bg-[#2E2730] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      افحص اللحظة
                    </button>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-[#C6BDC4]">
                    {found ? clue.secretStoryAr : clue.hintAr}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
