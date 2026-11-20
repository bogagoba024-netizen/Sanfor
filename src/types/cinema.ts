export type SceneId = 'berlin2006' | 'colosseumKiss' | 'romaCapitano';

export type AspectRatio = '9:16' | '16:9' | '1:1';

export type VisualPreset = 'golden_gladiator' | 'noir_stadium' | 'paint_energy';

export type MusicTheme = 'rome_epic' | 'berlin_adrenaline' | 'farewell_nostalgia' | 'custom';

export type DurationPreset = 15 | 18 | 27 | 36;

export type QuoteAnimationStyle = 'glow_fade' | 'word_by_word' | 'clean_banner';

export interface SceneStatCounter {
  label: string;
  target: number;
  suffix?: string;
}

export interface SceneConfig {
  id: SceneId;
  imageUrl: string;
  titleAr: string;
  subtitleIt: string;
  kicker: string;
  caption: string;
  accentHex: string;
  secondaryHex: string;
  stats: SceneStatCounter[];
  focalPoint: { x: number; y: number }; // normalized 0..1
  motionMode: 'zoom_in_tilt' | 'sweep_rise' | 'hero_push';
  fadingColors: boolean;
  softShimmer: boolean;
  loyaltyQuote: string;
}

export interface HiddenClue {
  id: string;
  sceneId: SceneId;
  titleAr: string;
  subtitleIt: string;
  hintAr: string;
  secretStoryAr: string;
  // Relative position inside that scene's normalized progress [0..1]
  sceneStartProgress: number;
  sceneEndProgress: number;
  // Normalized canvas coordinates (0..1)
  x: number;
  y: number;
  symbol: 'roman_ten' | 'minute_95' | 'cucchiaio' | 'coordinates' | 'heartbeat_ring' | 'crown_cipher';
  codeText: string;
}

export interface TouchOptions {
  embers: boolean;
  flashbulbs: boolean;
  kineticStats: boolean;
  hiddenClues: boolean;
  xrayClues: boolean;
  filmGrain: boolean;
  beatShake: boolean;
  spotlightSweeps: boolean;
  fadingColors: boolean;
  softShimmer: boolean;
  tiktokLetterbox: boolean;
  showLoyaltyQuotes: boolean;
  quoteStyle: QuoteAnimationStyle;
}

export interface AudioMixerState {
  theme: MusicTheme;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  crowdVolume: number;
  muted: boolean;
  customTrackName: string | null;
}

export interface ExportState {
  status: 'idle' | 'preparing' | 'recording' | 'done' | 'error';
  progress: number; // 0..1
  videoUrl: string | null;
  mimeType: string;
  errorMessage: string | null;
}

export const DEFAULT_SCENES: SceneConfig[] = [
  {
    id: 'berlin2006',
    imageUrl: '/assets/aistudio/IMG-20261119-WA0509_d69dbc25.jpg',
    titleAr: 'كأس العالم 2006',
    subtitleIt: 'CAMPIONI DEL MONDO · BERLINO',
    kicker: 'الفصل الأول · مجد برلين',
    caption: '58 مباراة مع إيطاليا · 9 أهداف · بطل العالم 2006',
    accentHex: '#38BDF8',
    secondaryHex: '#F2B705',
    stats: [
      { label: 'مباراة دولية', target: 58 },
      { label: 'أهداف حاسمة', target: 9 },
      { label: 'سنة التتويج', target: 2006 },
    ],
    focalPoint: { x: 0.46, y: 0.34 },
    motionMode: 'zoom_in_tilt',
    fadingColors: true,
    softShimmer: true,
    loyaltyQuote: 'الوفاء أن تصنع المجد لوطنك، ولا تنسَ من أين بدأت حكايتك',
  },
  {
    id: 'colosseumKiss',
    imageUrl: '/assets/aistudio/IMG-20261119-WA4697_606591d5.jpg',
    titleAr: 'أسطورة روما الخالدة',
    subtitleIt: 'UNA SQUADRA · UNA LEGGENDA',
    kicker: 'الفصل الثاني · قُبلة الوفاء',
    caption: 'فريق واحد · أسطورة واحدة · ملك روما الأبدي',
    accentHex: '#F2B705',
    secondaryHex: '#C81E3A',
    stats: [
      { label: 'فريق واحد', target: 1 },
      { label: 'مواسم متتالية', target: 25 },
      { label: 'كأس العالم', target: 1 },
    ],
    focalPoint: { x: 0.48, y: 0.38 },
    motionMode: 'sweep_rise',
    fadingColors: false,
    softShimmer: true,
    loyaltyQuote: 'فريق واحد، قلب واحد.. الوفاء لا يُقاس بالذهب بل بمن تبقى معك للأبد',
  },
  {
    id: 'romaCapitano',
    imageUrl: '/assets/aistudio/IMG-20261119-WA6286_bc521161.jpg',
    titleAr: 'كابيتانو روما',
    subtitleIt: 'IL CAPITANO · 1993 — 2017',
    kicker: 'الفصل الثالث · 25 سنة وفاء',
    caption: '786 مباراة مع روما · 307 هدف · رقم 10 الأبدي',
    accentHex: '#C81E3A',
    secondaryHex: '#F2B705',
    stats: [
      { label: 'مباراة بقميص روما', target: 786 },
      { label: 'هدفاً تاريخياً', target: 307 },
      { label: 'عاماً من الولاء', target: 25 },
    ],
    focalPoint: { x: 0.49, y: 0.32 },
    motionMode: 'hero_push',
    fadingColors: true,
    softShimmer: false,
    loyaltyQuote: 'خمسة وعشرون عاماً من العهد.. رحل الجميع وبقي الوفاء يرتدي الرقم عشرة',
  },
];

export const LOYALTY_QUOTE_PRESETS: Record<SceneId, string[]> = {
  berlin2006: [
    'الوفاء أن تصنع المجد لوطنك، ولا تنسَ من أين بدأت حكايتك',
    'تتبدل الملاعب وتبقى راية الوفاء مرفوعة في سماء المجد',
    'من يوفي لقميصه في الشدة، يكتب اسمه بالذهب في التاريخ',
  ],
  colosseumKiss: [
    'فريق واحد، قلب واحد.. الوفاء لا يُقاس بالذهب بل بمن تبقى معك للأبد',
    'قُبلة على الشعار تغني عن ألف وعد، فالأوفياء لا يبدّلون أوطانهم',
    'بعض القمصان ليست قماشاً.. بل عهدُ شرفٍ يدوم مدى الحياة',
  ],
  romaCapitano: [
    'خمسة وعشرون عاماً من العهد.. رحل الجميع وبقي الوفاء يرتدي الرقم عشرة',
    'الوفاء الحقيقي أن ترفض كل عروش الدنيا لتبقى ملكاً في بيتك',
    'قد تنتهي المباريات وتغيب الأضواء، لكن سيرة الأوفياء لا تموت أبداً',
  ],
};

export const HIDDEN_CLUES: HiddenClue[] = [
  {
    id: 'clue_roman_x',
    sceneId: 'berlin2006',
    titleAr: 'الرمز الروماني X (الرقم 10)',
    subtitleIt: 'NUMERUS DECIMUS',
    hintAr: 'راقب أضواء الملعب العلوية في الفصل الأول بحثاً عن وميض رقم 10 الروماني.',
    secretStoryAr: 'لم يرتدِ توتي القميص رقم 10 فقط، بل جعله رمزاً للموهبة الإيطالية الخالصة في مونديال ألمانيا رغم عودته من إصابة كادت تنهي مسيرته.',
    sceneStartProgress: 0.14,
    sceneEndProgress: 0.44,
    x: 0.78,
    y: 0.24,
    symbol: 'roman_ten',
    codeText: 'X · IL DIECI',
  },
  {
    id: 'clue_min_95',
    sceneId: 'berlin2006',
    titleAr: 'شفرة الدقيقة 90+5',
    subtitleIt: 'BERLINO · MINUTO 95',
    hintAr: 'قرب الكأس الذهبية في أسفل اليسار يظهر توقيت اللحظة التي حبست أنفاس إيطاليا.',
    secretStoryAr: 'في الدقيقة 90+5 أمام أستراليا، سدد توتي ركلة الجزاء القاتلة في الزاوية العليا ليبقي حلم إيطاليا حياً نحو اللقب الرابع.',
    sceneStartProgress: 0.56,
    sceneEndProgress: 0.88,
    x: 0.16,
    y: 0.68,
    symbol: 'minute_95',
    codeText: "90+5' · AUS 0-1 ITA",
  },
  {
    id: 'clue_cucchiaio',
    sceneId: 'colosseumKiss',
    titleAr: 'مسار الكوتشيايو السحري',
    subtitleIt: 'IL CUCCHIAIO · TRAJECTORIA',
    hintAr: 'في سماء الكولوسيوم يرتسم قوس ذهبي خفيف فوق الأعلام الإيطالية.',
    secretStoryAr: 'التمريرة الساقطة (الملعقة - Il Cucchiaio) التي ابتكرها توتي في يورو 2000 وأسقط بها الحراس في الدوري الإيطالي لربع قرن.',
    sceneStartProgress: 0.16,
    sceneEndProgress: 0.48,
    x: 0.72,
    y: 0.28,
    symbol: 'cucchiaio',
    codeText: 'IL CUCCHIAIO',
  },
  {
    id: 'clue_olimpico',
    sceneId: 'colosseumKiss',
    titleAr: 'إحداثيات الأولمبيكو',
    subtitleIt: '41.9341° N · 12.4547° E',
    hintAr: 'نقش إحداثيات تاريخية مخفي على أقواس الكولوسيوم في منتصف الفيديو.',
    secretStoryAr: 'هذه الإحداثيات الجغرافية الدقيقة لملعب الأولمبيكو في روما، المسرح الذي شهد 786 معركة كروية لقائده الأبدي.',
    sceneStartProgress: 0.54,
    sceneEndProgress: 0.88,
    x: 0.22,
    y: 0.34,
    symbol: 'coordinates',
    codeText: '41.9341° N · 12.4547° E',
  },
  {
    id: 'clue_heartbeat',
    sceneId: 'romaCapitano',
    titleAr: 'نبضة 28 مايو 2017',
    subtitleIt: '28 MAGGIO 2017 · ADDIO',
    hintAr: 'دوائر نبض ذهبية تنبعث من شعار الذئبة على صدر القميص أثناء دقات القلب.',
    secretStoryAr: 'في 28 مايو 2017، بكى 70 ألف مشجع في الأولمبيكو مع وداع توتي التاريخي بعد 25 عاماً لم يخن فيها قميص روما أبداً.',
    sceneStartProgress: 0.15,
    sceneEndProgress: 0.50,
    x: 0.56,
    y: 0.55,
    symbol: 'heartbeat_ring',
    codeText: '28·05·2017',
  },
  {
    id: 'clue_crown',
    sceneId: 'romaCapitano',
    titleAr: 'تاج ملك روما الثامن',
    subtitleIt: 'OTTAVO RE DI ROMA',
    hintAr: 'في اللحظات الأخيرة تتشكل هالة تاج خفي فوق شارة القيادة الذهبية.',
    secretStoryAr: 'لقبه جمهور روما بـ"ملك روما الثامن" (L\'Ottavo Re di Roma) بعد ملوك روما السبعة الأسطوريين في التاريخ القديم.',
    sceneStartProgress: 0.55,
    sceneEndProgress: 0.92,
    x: 0.82,
    y: 0.62,
    symbol: 'crown_cipher',
    codeText: 'VIII RE · 786/307',
  },
];
