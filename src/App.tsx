import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cinemaAudioEngine } from './audio/cinemaAudioEngine';
import { ExportModal } from './components/ExportModal';
import { SourceGallerySection } from './components/SourceGallerySection';
import { StudioControlDock } from './components/StudioControlDock';
import { TopBar } from './components/TopBar';
import { VideoStudioStage } from './components/VideoStudioStage';
import {
  getCanvasDimensions,
  getSceneProgressInfo,
  hitTestClue,
  renderCinemaFrame,
} from './engine/videoRenderer';
import {
  DEFAULT_SCENES,
  HIDDEN_CLUES,
  type AspectRatio,
  type AudioMixerState,
  type DurationPreset,
  type ExportState,
  type HiddenClue,
  type QuoteAnimationStyle,
  type SceneConfig,
  type SceneId,
  type TouchOptions,
  type VisualPreset,
} from './types/cinema';

export default function App() {
  const [scenes, setScenes] = useState<SceneConfig[]>(DEFAULT_SCENES);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [preset, setPreset] = useState<VisualPreset>('golden_gladiator');
  const [durationSeconds, setDurationSeconds] = useState<DurationPreset>(27);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  const [touches, setTouches] = useState<TouchOptions>({
    embers: true,
    flashbulbs: true,
    kineticStats: true,
    hiddenClues: true,
    xrayClues: false,
    filmGrain: true,
    beatShake: true,
    spotlightSweeps: true,
    fadingColors: true,
    softShimmer: true,
    tiktokLetterbox: false,
    showLoyaltyQuotes: true,
    quoteStyle: 'glow_fade',
  });

  const [mixer, setMixer] = useState<AudioMixerState>({
    theme: 'rome_epic',
    masterVolume: 0.85,
    musicVolume: 0.78,
    sfxVolume: 0.88,
    crowdVolume: 0.55,
    muted: false,
    customTrackName: null,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imagesReady, setImagesReady] = useState(false);

  const [discoveredClues, setDiscoveredClues] = useState<Set<string>>(() => new Set());
  const [lastDiscoveredClue, setLastDiscoveredClue] = useState<HiddenClue | null>(null);
  const [highlightedClueId, setHighlightedClueId] = useState<string | null>(null);

  const [exportState, setExportState] = useState<ExportState>({
    status: 'idle',
    progress: 0,
    videoUrl: null,
    mimeType: 'video/webm',
    errorMessage: null,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const progressRef = useRef(0);
  const isPlayingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const exportCancelledRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  // Sync refs
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Sync audio mixer
  useEffect(() => {
    cinemaAudioEngine.updateMixer(mixer);
  }, [mixer]);

  // Preload all 3 Totti images
  useEffect(() => {
    let loaded = 0;
    const total = DEFAULT_SCENES.length;
    DEFAULT_SCENES.forEach((sc) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loaded++;
        if (loaded >= total) {
          setImagesReady(true);
        }
      };
      img.onerror = () => {
        loaded++;
        if (loaded >= total) {
          setImagesReady(true);
        }
      };
      img.src = sc.imageUrl;
      imagesRef.current[sc.id] = img;
    });
  }, []);

  // Resize canvas backing buffer on aspectRatio change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dims = getCanvasDimensions(aspectRatio);
    canvas.width = dims.width;
    canvas.height = dims.height;
  }, [aspectRatio]);

  // Draw current frame whenever state updates or animation loop ticks
  const drawFrameAt = useCallback(
    (p: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dims = getCanvasDimensions(aspectRatio);
      if (canvas.width !== dims.width || canvas.height !== dims.height) {
        canvas.width = dims.width;
        canvas.height = dims.height;
      }

      renderCinemaFrame({
        ctx,
        width: canvas.width,
        height: canvas.height,
        aspectRatio,
        progress: p,
        durationSeconds,
        scenes,
        images: imagesRef.current,
        preset,
        touches,
        beatPulse: cinemaAudioEngine.getBeatPulse(),
        discoveredClues,
        highlightedClueId,
      });
    },
    [aspectRatio, durationSeconds, scenes, preset, touches, discoveredClues, highlightedClueId]
  );

  // Re-render paused frame when settings change
  useEffect(() => {
    if (!isPlaying) {
      drawFrameAt(progressRef.current);
    }
  }, [drawFrameAt, isPlaying, imagesReady, progress]);

  // Main 60fps animation loop when playing
  useEffect(() => {
    if (!isPlaying) return;

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      let nextP = progressRef.current + (dt * playbackSpeed) / durationSeconds;
      if (nextP >= 1) {
        if (exportState.status === 'recording') {
          nextP = 1;
          progressRef.current = 1;
          setProgress(1);
          drawFrameAt(1);
          return;
        }
        nextP = 0;
        cinemaAudioEngine.resetTimelineCues();
      }

      progressRef.current = nextP;
      setProgress(nextP);

      const info = getSceneProgressInfo(nextP, scenes);
      cinemaAudioEngine.syncTimelineEvents(nextP, info.sceneIndex);

      drawFrameAt(nextP);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, playbackSpeed, durationSeconds, scenes, drawFrameAt, exportState.status]);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      cinemaAudioEngine.stopPlayback();
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      cinemaAudioEngine.stopPlayback();
      setIsPlaying(false);
    } else {
      cinemaAudioEngine.ensureContext();
      cinemaAudioEngine.startPlayback(progressRef.current * durationSeconds);
      setIsPlaying(true);
    }
  }, [durationSeconds]);

  // Spacebar play/pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay]);

  const handleRestart = () => {
    progressRef.current = 0;
    setProgress(0);
    cinemaAudioEngine.resetTimelineCues();
    if (isPlaying) {
      cinemaAudioEngine.stopPlayback();
      cinemaAudioEngine.startPlayback(0);
    } else {
      drawFrameAt(0);
    }
  };

  const handleScrub = (nextProgress: number) => {
    const clamped = Math.max(0, Math.min(0.999, nextProgress));
    progressRef.current = clamped;
    setProgress(clamped);
    cinemaAudioEngine.resetTimelineCues();
    if (isPlaying) {
      cinemaAudioEngine.stopPlayback();
      cinemaAudioEngine.startPlayback(clamped * durationSeconds);
    } else {
      drawFrameAt(clamped);
    }
  };

  const handleToggleTouch = (key: Exclude<keyof TouchOptions, 'quoteStyle'>) => {
    setTouches((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleQuoteStyleChange = (style: QuoteAnimationStyle) => {
    setTouches((prev) => ({ ...prev, quoteStyle: style, showLoyaltyQuotes: true }));
  };

  const handleUpdateSceneQuote = (sceneId: SceneId, quote: string) => {
    setScenes((prev) =>
      prev.map((sc) => (sc.id === sceneId ? { ...sc, loyaltyQuote: quote } : sc))
    );
  };

  const handleApplyLoyaltyVideoMode = () => {
    setTouches((prev) => ({
      ...prev,
      showLoyaltyQuotes: true,
      fadingColors: true,
      softShimmer: true,
    }));
    setMixer((prev) => ({
      ...prev,
      theme: 'farewell_nostalgia',
    }));
    progressRef.current = 0;
    setProgress(0);
    cinemaAudioEngine.resetTimelineCues();
    cinemaAudioEngine.ensureContext();
    cinemaAudioEngine.stopPlayback();
    cinemaAudioEngine.startPlayback(0);
    setIsPlaying(true);
    document.getElementById('cinema-stage')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSwapSceneOrder = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= scenes.length) return;
    setScenes((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  const handleToggleSceneFx = (sceneId: SceneId, fx: 'fadingColors' | 'softShimmer') => {
    setScenes((prev) =>
      prev.map((sc) => (sc.id === sceneId ? { ...sc, [fx]: !sc[fx] } : sc))
    );
  };

  const isTikTokPresetActive =
    aspectRatio === '9:16' && durationSeconds === 15 && touches.tiktokLetterbox;

  const handleApplyTikTokPreset = () => {
    setAspectRatio('9:16');
    setDurationSeconds(15);
    setTouches((prev) => ({
      ...prev,
      tiktokLetterbox: true,
    }));
  };

  const showDiscoveryToast = (clue: HiddenClue) => {
    setLastDiscoveredClue(clue);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setLastDiscoveredClue(null);
    }, 4800);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;

    const hit = hitTestClue(normX, normY, progressRef.current, scenes);
    if (hit) {
      cinemaAudioEngine.playSecretChime();
      setDiscoveredClues((prev) => {
        const next = new Set(prev);
        next.add(hit.id);
        return next;
      });
      setHighlightedClueId(hit.id);
      showDiscoveryToast(hit);
    } else {
      handleTogglePlay();
    }
  };

  const handleJumpToClue = (clue: HiddenClue) => {
    const sceneIdx = scenes.findIndex((s) => s.id === clue.sceneId);
    if (sceneIdx === -1) return;
    const midLocal = (clue.sceneStartProgress + clue.sceneEndProgress) / 2;
    const globalP = (sceneIdx + midLocal) / scenes.length;

    setTouches((prev) => ({ ...prev, hiddenClues: true }));
    setPlaybackSpeed(0.5);
    setHighlightedClueId(clue.id);
    setDiscoveredClues((prev) => {
      const next = new Set(prev);
      next.add(clue.id);
      return next;
    });
    cinemaAudioEngine.playSecretChime();
    showDiscoveryToast(clue);
    handleScrub(globalP);
    document.getElementById('cinema-stage')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRevealAllClues = () => {
    cinemaAudioEngine.playSecretChime();
    setTouches((prev) => ({ ...prev, hiddenClues: true, xrayClues: true }));
    setDiscoveredClues(new Set(HIDDEN_CLUES.map((c) => c.id)));
  };

  const handlePlayScene = (sceneIndex: number) => {
    const p = sceneIndex / scenes.length + 0.004;
    handleScrub(p);
    if (!isPlaying) {
      cinemaAudioEngine.ensureContext();
      cinemaAudioEngine.startPlayback(p * durationSeconds);
      setIsPlaying(true);
    }
    document.getElementById('cinema-stage')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFullscreen = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (canvas.requestFullscreen) {
      void canvas.requestFullscreen();
    }
  };

  // Real-Time Video + Audio Export using MediaRecorder
  const handleStartExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    exportCancelledRef.current = false;
    setExportState({
      status: 'preparing',
      progress: 0,
      videoUrl: null,
      mimeType: 'video/webm',
      errorMessage: null,
    });

    try {
      cinemaAudioEngine.stopPlayback();
      setIsPlaying(false);

      const audioStream = cinemaAudioEngine.getExportStream();
      const canvasStream = canvas.captureStream(60);

      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));
      if (audioStream) {
        audioStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
      }

      const candidateTypes = [
        'video/mp4;codecs=avc1,mp4a',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const mimeType =
        candidateTypes.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000,
      });
      mediaRecorderRef.current = recorder;

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = () => {
        cinemaAudioEngine.stopPlayback();
        setIsPlaying(false);
        if (exportCancelledRef.current) return;

        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setExportState({
          status: 'done',
          progress: 1,
          videoUrl: url,
          mimeType,
          errorMessage: null,
        });
      };

      recorder.onerror = () => {
        cinemaAudioEngine.stopPlayback();
        setIsPlaying(false);
        setExportState({
          status: 'error',
          progress: 0,
          videoUrl: null,
          mimeType,
          errorMessage: 'فشل ترميز الفيديو في المتصفح.',
        });
      };

      // Reset timeline to 00:00 and begin synchronized recording
      progressRef.current = 0;
      setProgress(0);
      setPlaybackSpeed(1);
      cinemaAudioEngine.resetTimelineCues();
      drawFrameAt(0);

      recorder.start(250);
      cinemaAudioEngine.startPlayback(0);

      setExportState({
        status: 'recording',
        progress: 0,
        videoUrl: null,
        mimeType,
        errorMessage: null,
      });

      const startTs = performance.now();
      const totalMs = durationSeconds * 1000;

      const exportTick = (now: number) => {
        if (exportCancelledRef.current) return;
        const elapsed = now - startTs;
        const p = Math.min(1, elapsed / totalMs);

        progressRef.current = p;
        setProgress(p);

        const info = getSceneProgressInfo(p, scenes);
        cinemaAudioEngine.syncTimelineEvents(p, info.sceneIndex);
        drawFrameAt(p);

        setExportState((prev) =>
          prev.status === 'recording' ? { ...prev, progress: p } : prev
        );

        if (p < 1) {
          requestAnimationFrame(exportTick);
        } else {
          window.setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop();
            }
          }, 180);
        }
      };

      requestAnimationFrame(exportTick);
    } catch {
      setExportState({
        status: 'error',
        progress: 0,
        videoUrl: null,
        mimeType: 'video/webm',
        errorMessage: 'المتصفح الحالي لا يدعم تصدير الفيديو المباشر.',
      });
    }
  };

  const handleCloseExport = () => {
    exportCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (exportState.videoUrl) {
      URL.revokeObjectURL(exportState.videoUrl);
    }
    setExportState({
      status: 'idle',
      progress: 0,
      videoUrl: null,
      mimeType: 'video/webm',
      errorMessage: null,
    });
  };

  return (
    <div className="min-h-screen bg-[#080708] text-[#F5F2EC]">
      <TopBar
        onExportClick={handleStartExport}
        isExporting={exportState.status === 'recording' || exportState.status === 'preparing'}
      />

      <main className="mx-auto max-w-[1380px] px-4 py-8 sm:px-6 lg:py-10">
        {/* Editorial Hero Header */}
        <section className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#F2B705]">
              فيلم الأساطير · فرانشيسكو توتي · برلين وروما
            </p>
            <h1 className="mt-1.5 max-w-2xl text-3xl font-black tracking-tight text-[#F5F2EC] sm:text-4xl [text-wrap:balance]">
              فيديو سينمائي خارق بالصوت والموسيقى والأسرار الخفية
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[#A89FA6]">
            <span>حركة 2.5D سينمائية</span>
            <span aria-hidden="true">·</span>
            <span>موسيقى أوركسترالية ومؤثرات ملاعب</span>
            <span aria-hidden="true">·</span>
            <span>6 لمسات سرية داخل الإطارات</span>
          </div>
        </section>

        {/* Primary Two-Column Studio Workspace */}
        <section
          id="cinema-stage"
          className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
        >
          <div className="lg:col-span-7 xl:col-span-8">
            <VideoStudioStage
              canvasRef={canvasRef}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onRestart={handleRestart}
              progress={progress}
              durationSeconds={durationSeconds}
              onScrub={handleScrub}
              playbackSpeed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              muted={mixer.muted}
              onToggleMute={() => setMixer((m) => ({ ...m, muted: !m.muted }))}
              xrayClues={touches.xrayClues}
              onToggleXray={() => handleToggleTouch('xrayClues')}
              scenes={scenes}
              discoveredClues={discoveredClues}
              lastDiscoveredClue={lastDiscoveredClue}
              onCanvasClick={handleCanvasClick}
              onFullscreen={handleFullscreen}
              isTikTokPresetActive={isTikTokPresetActive}
              onApplyTikTokPreset={handleApplyTikTokPreset}
            />
          </div>

          <div className="lg:col-span-5 xl:col-span-4">
            <StudioControlDock
              preset={preset}
              onPresetChange={setPreset}
              durationSeconds={durationSeconds}
              onDurationChange={setDurationSeconds}
              touches={touches}
              onToggleTouch={handleToggleTouch}
              onQuoteStyleChange={handleQuoteStyleChange}
              onUpdateSceneQuote={handleUpdateSceneQuote}
              onPreviewScene={handlePlayScene}
              onApplyLoyaltyVideoMode={handleApplyLoyaltyVideoMode}
              mixer={mixer}
              onMixerChange={setMixer}
              scenes={scenes}
              onSwapSceneOrder={handleSwapSceneOrder}
              onToggleSceneFx={handleToggleSceneFx}
              discoveredClues={discoveredClues}
              onJumpToClue={handleJumpToClue}
              onRevealAllClues={handleRevealAllClues}
              isTikTokPresetActive={isTikTokPresetActive}
              onApplyTikTokPreset={handleApplyTikTokPreset}
            />
          </div>
        </section>

        {/* Original 3 Posters Showcase */}
        <SourceGallerySection scenes={scenes} onPlayScene={handlePlayScene} />
      </main>

      <footer className="mt-14 border-t border-[#241F25] py-6">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-4 px-6 text-xs text-[#8E848C]">
          <span>كابيتانو ستوديو · تحية لأسطورة روما فرانشيسكو توتي</span>
          <span className="font-display tracking-wider">UNA SQUADRA · UNA LEGGENDA</span>
        </div>
      </footer>

      <ExportModal
        exportState={exportState}
        durationSeconds={durationSeconds}
        onClose={handleCloseExport}
        onStartExport={handleStartExport}
      />
    </div>
  );
}
