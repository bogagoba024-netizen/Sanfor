import {
  HIDDEN_CLUES,
  type AspectRatio,
  type HiddenClue,
  type SceneConfig,
  type TouchOptions,
  type VisualPreset,
} from '../types/cinema';

export interface RenderFrameParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  progress: number; // 0..1 across entire video
  durationSeconds: number;
  scenes: SceneConfig[];
  images: Record<string, HTMLImageElement>;
  preset: VisualPreset;
  touches: TouchOptions;
  beatPulse: number; // 0..1 from audio engine
  discoveredClues: Set<string>;
  highlightedClueId: string | null;
}

export interface SceneProgressInfo {
  sceneIndex: number;
  scene: SceneConfig;
  localProgress: number; // 0..1 within current scene
  nextScene: SceneConfig | null;
  transitionWeight: number; // 0..1 during transition at end of scene
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// Deterministic pseudo-random for stable particle motion & scrubbing
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function getCanvasDimensions(aspect: AspectRatio): { width: number; height: number } {
  switch (aspect) {
    case '16:9':
      return { width: 1280, height: 720 };
    case '1:1':
      return { width: 960, height: 960 };
    case '9:16':
    default:
      return { width: 720, height: 1280 };
  }
}

export function getSceneProgressInfo(progress: number, scenes: SceneConfig[]): SceneProgressInfo {
  const count = Math.max(1, scenes.length);
  const clamped = clamp(progress, 0, 0.9999);
  const scaled = clamped * count;
  const sceneIndex = Math.min(count - 1, Math.floor(scaled));
  const localProgress = scaled - sceneIndex;
  const scene = scenes[sceneIndex];
  const nextScene = sceneIndex < count - 1 ? scenes[sceneIndex + 1] : null;

  // Transition occurs in the final 14% of a scene (except last scene)
  const transitionStart = 0.86;
  const transitionWeight =
    nextScene && localProgress > transitionStart
      ? easeInOutCubic((localProgress - transitionStart) / (1 - transitionStart))
      : 0;

  return {
    sceneIndex,
    scene,
    localProgress,
    nextScene,
    transitionWeight,
  };
}

export function getActiveCluesAtProgress(
  progress: number,
  scenes: SceneConfig[]
): HiddenClue[] {
  const info = getSceneProgressInfo(progress, scenes);
  return HIDDEN_CLUES.filter(
    (clue) =>
      clue.sceneId === info.scene.id &&
      info.localProgress >= clue.sceneStartProgress &&
      info.localProgress <= clue.sceneEndProgress
  );
}

export function hitTestClue(
  normX: number,
  normY: number,
  progress: number,
  scenes: SceneConfig[]
): HiddenClue | null {
  const active = getActiveCluesAtProgress(progress, scenes);
  let closest: HiddenClue | null = null;
  let minDist = 0.14; // generous hit radius in normalized coords
  for (const clue of active) {
    const dx = normX - clue.x;
    const dy = normY - clue.y;
    const dist = Math.hypot(dx, dy);
    if (dist < minDist) {
      minDist = dist;
      closest = clue;
    }
  }
  return closest;
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  width: number,
  height: number,
  zoom: number,
  panX: number,
  panY: number,
  rotationRad: number,
  focalPoint: { x: number; y: number }
): void {
  if (!img || !img.complete || img.naturalWidth === 0) {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#1A1114');
    grad.addColorStop(1, '#090708');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = width / height;

  let drawW: number;
  let drawH: number;
  if (imgRatio > canvasRatio) {
    drawH = height;
    drawW = height * imgRatio;
  } else {
    drawW = width;
    drawH = width / imgRatio;
  }

  ctx.save();
  ctx.translate(width * 0.5 + panX, height * 0.5 + panY);
  ctx.rotate(rotationRad);
  ctx.scale(zoom, zoom);

  // Offset so focal point sits nicely centered when aspect ratio crops
  const offsetX = (0.5 - focalPoint.x) * (drawW - width) * 0.65;
  const offsetY = (0.5 - focalPoint.y) * (drawH - height) * 0.65;

  ctx.drawImage(img, -drawW * 0.5 + offsetX, -drawH * 0.5 + offsetY, drawW, drawH);
  ctx.restore();
}

function getCameraTransform(
  scene: SceneConfig,
  localP: number,
  width: number,
  height: number,
  beatPulse: number,
  enableShake: boolean
) {
  const eased = easeInOutCubic(localP);
  const shakeX = enableShake ? (Math.sin(localP * 190) * 5.5 * beatPulse) : 0;
  const shakeY = enableShake ? (Math.cos(localP * 230) * 4.5 * beatPulse) : 0;
  const beatZoom = enableShake ? beatPulse * 0.018 : 0;

  let zoom = 1.06;
  let panX = 0;
  let panY = 0;
  let rot = 0;

  if (scene.motionMode === 'zoom_in_tilt') {
    zoom = 1.04 + eased * 0.14 + beatZoom;
    panX = Math.sin(localP * Math.PI) * width * 0.018 + shakeX;
    panY = -eased * height * 0.018 + shakeY;
    rot = (eased - 0.5) * 0.022;
  } else if (scene.motionMode === 'sweep_rise') {
    zoom = 1.15 - eased * 0.08 + beatZoom;
    panX = (0.5 - eased) * width * 0.032 + shakeX;
    panY = (0.5 - eased) * height * 0.024 + shakeY;
    rot = Math.sin(localP * Math.PI) * -0.018;
  } else {
    // hero_push
    zoom = 1.03 + easeOutExpo(localP) * 0.16 + beatZoom;
    panX = Math.cos(localP * Math.PI * 1.5) * width * 0.012 + shakeX;
    panY = -eased * height * 0.015 + shakeY;
    rot = (0.5 - eased) * 0.015;
  }

  return { zoom, panX, panY, rot };
}

function drawSpotlightSweeps(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  accentHex: string
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < 2; i++) {
    const angle = (i === 0 ? -0.35 : 0.32) + Math.sin(t * 2.4 + i * 2.1) * 0.22;
    const originX = i === 0 ? width * 0.15 : width * 0.85;
    const originY = -height * 0.1;

    ctx.save();
    ctx.translate(originX, originY);
    ctx.rotate(angle);

    const beamGrad = ctx.createLinearGradient(0, 0, 0, height * 1.25);
    beamGrad.addColorStop(0, i === 0 ? 'rgba(255, 244, 214, 0.22)' : `${accentHex}33`);
    beamGrad.addColorStop(0.55, 'rgba(242, 183, 5, 0.06)');
    beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(-width * 0.05, 0);
    ctx.lineTo(width * 0.05, 0);
    ctx.lineTo(width * 0.34, height * 1.3);
    ctx.lineTo(-width * 0.34, height * 1.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawEmbersAndDust(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  accentHex: string,
  secondaryHex: string,
  beatPulse: number
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const count = 48;
  for (let i = 0; i < count; i++) {
    const seedX = hash(i * 3.17);
    const seedY = hash(i * 7.41);
    const speed = 0.045 + hash(i * 11.3) * 0.095;
    const driftFreq = 1.2 + hash(i * 5.9) * 2.2;
    const radius = (1.2 + hash(i * 13.7) * 3.1) * (1 + beatPulse * 0.35);

    const yNorm = (seedY - timeSec * speed) % 1;
    const y = (yNorm < 0 ? yNorm + 1 : yNorm) * height;
    const x = ((seedX + Math.sin(timeSec * driftFreq + i) * 0.035) % 1) * width;

    const alpha = 0.25 + Math.sin(timeSec * 3.5 + i * 1.7) * 0.25 + beatPulse * 0.2;
    const color = i % 3 === 0 ? '#FFF6D6' : i % 2 === 0 ? secondaryHex : accentHex;

    ctx.globalAlpha = clamp(alpha, 0.08, 0.85);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.2);
    glow.addColorStop(0, '#FFFFFF');
    glow.addColorStop(0.35, color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawFlashbulbs(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const slot = Math.floor(timeSec * 3.2);
  const sub = (timeSec * 3.2) - slot;
  if (hash(slot * 19.3) > 0.58 && sub < 0.28) {
    const intensity = Math.pow(1 - sub / 0.28, 2);
    const fx = (0.1 + hash(slot * 7.1) * 0.8) * width;
    const fy = (0.12 + hash(slot * 13.9) * 0.45) * height;
    const rad = Math.min(width, height) * (0.12 + hash(slot * 3.3) * 0.14);

    const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, rad);
    grad.addColorStop(0, `rgba(255, 255, 255, ${0.85 * intensity})`);
    grad.addColorStop(0.25, `rgba(255, 232, 180, ${0.42 * intensity})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(fx, fy, rad, 0, Math.PI * 2);
    ctx.fill();

    // Cross lens flare spike
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * intensity})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx - rad * 0.65, fy);
    ctx.lineTo(fx + rad * 0.65, fy);
    ctx.moveTo(fx, fy - rad * 0.65);
    ctx.lineTo(fx, fy + rad * 0.65);
    ctx.stroke();
  }

  ctx.restore();
}

function drawColorGrading(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  preset: VisualPreset
): void {
  ctx.save();
  if (preset === 'golden_gladiator') {
    ctx.globalCompositeOperation = 'soft-light';
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, 'rgba(242, 183, 5, 0.16)');
    grad.addColorStop(0.5, 'rgba(180, 45, 35, 0.10)');
    grad.addColorStop(1, 'rgba(20, 12, 10, 0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (preset === 'noir_stadium') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'rgba(120, 120, 120, 0.35)';
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(20, 26, 38, 0.28)';
    ctx.fillRect(0, 0, width, height);
  } else {
    // paint_energy
    ctx.globalCompositeOperation = 'overlay';
    const grad = ctx.createRadialGradient(width * 0.5, height * 0.4, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
    grad.addColorStop(0, 'rgba(255, 210, 90, 0.12)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function drawFadingColorsEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  localProgress: number,
  timeSec: number,
  intensityWeight: number,
  beatPulse: number
): void {
  if (intensityWeight <= 0.01) return;

  // Breathing color-dissolve wave: transitions smoothly between vivid paint/jersey tones and faded silver-sepia memory
  const fadeWave = 0.45 + 0.55 * Math.sin(localProgress * Math.PI * 2.2 - Math.PI * 0.35);
  const effectiveFade = clamp((fadeWave - beatPulse * 0.25) * intensityWeight, 0.12, 0.88);

  ctx.save();

  // 1. Selective desaturation wash (stronger toward the edges, keeping a living color core)
  ctx.globalCompositeOperation = 'saturation';
  const desatGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    Math.min(width, height) * 0.12,
    width * 0.5,
    height * 0.48,
    Math.max(width, height) * 0.72
  );
  desatGrad.addColorStop(0, `rgba(140, 140, 140, ${effectiveFade * 0.48})`);
  desatGrad.addColorStop(0.55, `rgba(130, 130, 130, ${effectiveFade * 0.82})`);
  desatGrad.addColorStop(1, `rgba(128, 128, 128, ${clamp(effectiveFade * 0.98, 0, 0.96)})`);
  ctx.fillStyle = desatGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Nostalgic warm-silver film fade lift in shadows
  ctx.globalCompositeOperation = 'screen';
  const washGrad = ctx.createLinearGradient(0, 0, width, height);
  const shift = Math.sin(timeSec * 1.1) * 0.04;
  washGrad.addColorStop(0, `rgba(195, 178, 155, ${0.12 * effectiveFade})`);
  washGrad.addColorStop(clamp(0.5 + shift, 0.2, 0.8), `rgba(120, 112, 118, ${0.06 * effectiveFade})`);
  washGrad.addColorStop(1, `rgba(210, 185, 145, ${0.14 * effectiveFade})`);
  ctx.fillStyle = washGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. Subtle fading color mist along corners
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = `rgba(186, 165, 140, ${0.24 * effectiveFade})`;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

function drawSoftShimmerEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  focalPoint: { x: number; y: number },
  accentHex: string,
  intensityWeight: number,
  beatPulse: number
): void {
  if (intensityWeight <= 0.01) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const fx = focalPoint.x * width;
  const fy = focalPoint.y * height;
  const breath = 0.72 + 0.28 * Math.sin(timeSec * 2.1) + beatPulse * 0.18;

  // 1. Soft diffuse halo bloom over subject focal point
  const haloR = Math.max(width, height) * 0.52;
  const halo = ctx.createRadialGradient(fx, fy, 0, fx, fy, haloR);
  halo.addColorStop(0, `rgba(255, 244, 214, ${0.21 * breath * intensityWeight})`);
  halo.addColorStop(0.35, `rgba(242, 183, 5, ${0.12 * breath * intensityWeight})`);
  halo.addColorStop(0.7, `${accentHex}14`);
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  // 2. Silky diagonal sheen wave gliding gently across the image
  const sweepPos = ((timeSec * 0.22) % 1.8) - 0.4; // -0.4 .. 1.4
  const cx = width * sweepPos;
  const cy = height * (0.25 + sweepPos * 0.45);
  const sheenGrad = ctx.createLinearGradient(
    cx - width * 0.35,
    cy - height * 0.2,
    cx + width * 0.35,
    cy + height * 0.2
  );
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  sheenGrad.addColorStop(0.45, `rgba(255, 246, 220, ${0.09 * intensityWeight})`);
  sheenGrad.addColorStop(0.5, `rgba(255, 250, 236, ${0.16 * intensityWeight})`);
  sheenGrad.addColorStop(0.55, `rgba(255, 246, 220, ${0.09 * intensityWeight})`);
  sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheenGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. Delicate micro-star glints (soft shimmer sparkles)
  const glintCount = 14;
  for (let i = 0; i < glintCount; i++) {
    const gx = (0.12 + hash(i * 17.3) * 0.76) * width;
    const gy = (0.14 + hash(i * 23.7) * 0.68) * height;
    const twinkle = Math.max(0, Math.sin(timeSec * (2.4 + hash(i * 5.1) * 2.5) + i * 1.9));
    const alpha = Math.pow(twinkle, 3) * 0.75 * intensityWeight;
    if (alpha < 0.04) continue;

    const arm = (6 + hash(i * 9.7) * 10) * (0.7 + twinkle * 0.5);
    ctx.save();
    ctx.translate(gx, gy);
    ctx.globalAlpha = alpha;

    const gGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, arm * 1.5);
    gGrad.addColorStop(0, 'rgba(255, 252, 235, 0.95)');
    gGrad.addColorStop(0.4, 'rgba(242, 183, 5, 0.45)');
    gGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gGrad;
    ctx.beginPath();
    ctx.arc(0, 0, arm * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 250, 230, 0.85)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-arm, 0);
    ctx.lineTo(arm, 0);
    ctx.moveTo(0, -arm);
    ctx.lineTo(0, arm);
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

function drawHiddenClueLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sceneInfo: SceneProgressInfo,
  timeSec: number,
  touches: TouchOptions,
  discoveredClues: Set<string>,
  highlightedClueId: string | null
): void {
  if (!touches.hiddenClues && !touches.xrayClues) return;

  const clues = HIDDEN_CLUES.filter(
    (c) =>
      c.sceneId === sceneInfo.scene.id &&
      sceneInfo.localProgress >= c.sceneStartProgress &&
      sceneInfo.localProgress <= c.sceneEndProgress
  );

  for (const clue of clues) {
    const span = clue.sceneEndProgress - clue.sceneStartProgress;
    const p = clamp((sceneInfo.localProgress - clue.sceneStartProgress) / Math.max(0.01, span), 0, 1);
    const fadeEnv = Math.sin(p * Math.PI); // smooth in/out
    const isXray = touches.xrayClues || discoveredClues.has(clue.id) || highlightedClueId === clue.id;

    const cx = clue.x * width;
    const cy = clue.y * height;
    const baseOpacity = isXray ? 0.92 : 0.42 * fadeEnv;

    ctx.save();
    ctx.globalAlpha = clamp(baseOpacity, 0, 1);

    // Draw unique artistic easter egg graphic
    const pulse = 1 + Math.sin(timeSec * 5) * 0.08;
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    if (clue.symbol === 'roman_ten') {
      ctx.globalCompositeOperation = 'screen';
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 56);
      glow.addColorStop(0, 'rgba(255, 230, 140, 0.7)');
      glow.addColorStop(1, 'rgba(242, 183, 5, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 56, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '800 34px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFE89E';
      ctx.fillText('X', 0, 0);
    } else if (clue.symbol === 'minute_95') {
      ctx.strokeStyle = '#F2B705';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2 * p);
      ctx.stroke();
      ctx.font = '700 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFF5D6';
      ctx.fillText("90+5'", 0, 0);
    } else if (clue.symbol === 'cucchiaio') {
      ctx.strokeStyle = '#F2B705';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(-65, 28);
      ctx.quadraticCurveTo(0, -45, 65, 16);
      ctx.stroke();
      ctx.setLineDash([]);
      // Ball glint along arc
      const bx = -65 + 130 * p;
      const by = Math.pow(1 - p, 2) * 28 + 2 * (1 - p) * p * (-45) + Math.pow(p, 2) * 16;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (clue.symbol === 'coordinates') {
      ctx.font = '600 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FDE68A';
      ctx.fillText('41.9341° N', 0, -8);
      ctx.fillText('12.4547° E', 0, 10);
    } else if (clue.symbol === 'heartbeat_ring') {
      const ringR = 14 + ((timeSec * 36) % 44);
      const ringAlpha = 1 - ((timeSec * 36) % 44) / 44;
      ctx.strokeStyle = `rgba(242, 183, 5, ${ringAlpha})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFF3C4';
      ctx.fillText('28·05·17', 0, 4);
    } else if (clue.symbol === 'crown_cipher') {
      ctx.strokeStyle = '#F2B705';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-22, 10);
      ctx.lineTo(-26, -10);
      ctx.lineTo(-10, 0);
      ctx.lineTo(0, -16);
      ctx.lineTo(10, 0);
      ctx.lineTo(26, -10);
      ctx.lineTo(22, 10);
      ctx.closePath();
      ctx.stroke();
      ctx.font = '700 11px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FDE68A';
      ctx.fillText('RE DI ROMA', 0, 24);
    }

    // X-Ray inspection reticle when enabled or found
    if (isXray) {
      ctx.strokeStyle = discoveredClues.has(clue.id) ? '#10B981' : '#F2B705';
      ctx.lineWidth = 1.5;
      const r = 42;
      // 4 crisp corner brackets
      const b = 10;
      ctx.beginPath();
      ctx.moveTo(-r, -r + b); ctx.lineTo(-r, -r); ctx.lineTo(-r + b, -r);
      ctx.moveTo(r - b, -r); ctx.lineTo(r, -r); ctx.lineTo(r, -r + b);
      ctx.moveTo(r, r - b); ctx.lineTo(r, r); ctx.lineTo(r - b, r);
      ctx.moveTo(-r + b, r); ctx.lineTo(-r, r); ctx.lineTo(-r, r - b);
      ctx.stroke();

      ctx.font = '700 12px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(clue.codeText, 0, r + 18);
    }

    ctx.restore();
  }
}

function wrapArabicText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth || !current) {
      current = testLine;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawKineticOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  aspectRatio: AspectRatio,
  sceneInfo: SceneProgressInfo,
  globalProgress: number,
  touches: TouchOptions
): void {
  const { scene, localProgress } = sceneInfo;
  const isCompact = aspectRatio === '16:9';

  // Top & Bottom measured gradient scrims for guaranteed legibility
  const barH = touches.tiktokLetterbox
    ? Math.round(height * (isCompact ? 0.115 : 0.088))
    : isCompact
      ? height * 0.055
      : height * 0.032;

  const topScrim = ctx.createLinearGradient(0, barH, 0, barH + height * 0.2);
  topScrim.addColorStop(0, 'rgba(6, 5, 7, 0.78)');
  topScrim.addColorStop(1, 'rgba(6, 5, 7, 0)');
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, barH, width, height * 0.2);

  const botScrim = ctx.createLinearGradient(0, height - barH - height * 0.42, 0, height - barH);
  botScrim.addColorStop(0, 'rgba(6, 5, 7, 0)');
  botScrim.addColorStop(0.45, 'rgba(6, 5, 7, 0.72)');
  botScrim.addColorStop(1, 'rgba(6, 5, 7, 0.94)');
  ctx.fillStyle = botScrim;
  ctx.fillRect(0, height - barH - height * 0.42, width, height * 0.42);

  // Entrance & exit animation envelope per scene
  const enterT = clamp(localProgress / 0.18, 0, 1);
  const exitT = clamp((1 - localProgress) / 0.12, 0, 1);
  const alpha = easeOutExpo(enterT) * clamp(exitT, 0, 1);
  const slideY = (1 - easeOutExpo(enterT)) * 24;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Top Roman Kicker
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.font = `700 ${isCompact ? 16 : 19}px Cairo, sans-serif`;
  ctx.fillStyle = '#F2B705';
  ctx.fillText(scene.kicker, width * 0.5, barH + (isCompact ? 32 : 42));

  // Subtitle Italian inscription
  ctx.direction = 'ltr';
  ctx.font = `700 ${isCompact ? 13 : 15}px Cinzel, serif`;
  ctx.fillStyle = 'rgba(245, 242, 236, 0.76)';
  ctx.fillText(scene.subtitleIt, width * 0.5, barH + (isCompact ? 54 : 68));

  // Bottom Chapter Title + Kinetic Stat Counters
  const baseBottomY = height - barH - (isCompact ? 28 : 42);

  if (touches.kineticStats && scene.stats.length > 0) {
    const countP = easeOutExpo(clamp(localProgress / 0.52, 0, 1));
    const statCount = scene.stats.length;
    const spread = isCompact ? width * 0.52 : width * 0.78;
    const startX = width * 0.5 - spread * 0.5;
    const stepX = statCount > 1 ? spread / (statCount - 1) : 0;

    scene.stats.forEach((stat, idx) => {
      const sx = statCount === 1 ? width * 0.5 : startX + idx * stepX;
      const sy = baseBottomY - (isCompact ? 58 : 78) + slideY * 0.5;
      const currentVal = Math.round(stat.target * countP);

      ctx.direction = 'ltr';
      ctx.font = `800 ${isCompact ? 28 : 36}px Cinzel, serif`;
      ctx.fillStyle = '#F2B705';
      ctx.fillText(String(currentVal), sx, sy);

      ctx.direction = 'rtl';
      ctx.font = `600 ${isCompact ? 13 : 15}px Cairo, sans-serif`;
      ctx.fillStyle = 'rgba(245, 242, 236, 0.85)';
      ctx.fillText(stat.label, sx, sy + (isCompact ? 22 : 26));
    });
  }

  // Loyalty Quote Overlay ("عبارات عن الوفاء" on each image)
  if (touches.showLoyaltyQuotes && scene.loyaltyQuote.trim()) {
    const quoteFontSize = isCompact ? 19 : 23;
    const lineHeight = isCompact ? 28 : 34;
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.font = `700 ${quoteFontSize}px Cairo, sans-serif`;

    let displayQuote = scene.loyaltyQuote.trim();
    if (touches.quoteStyle === 'word_by_word') {
      const words = displayQuote.split(/\s+/);
      const revealT = clamp((localProgress - 0.08) / 0.55, 0.05, 1);
      const visibleCount = Math.max(1, Math.ceil(words.length * revealT));
      displayQuote = words.slice(0, visibleCount).join(' ');
    } else if (touches.quoteStyle === 'clean_banner') {
      displayQuote = `« ${displayQuote} »`;
    }

    const maxQuoteW = isCompact ? width * 0.72 : width * 0.84;
    const lines = wrapArabicText(ctx, displayQuote, maxQuoteW);
    const statsClearance = touches.kineticStats ? (isCompact ? 112 : 138) : (isCompact ? 52 : 68);
    const quoteAnchorBottom = baseBottomY - statsClearance + slideY * 0.4;
    const blockHeight = lines.length * lineHeight;
    const firstLineY = quoteAnchorBottom - (lines.length - 1) * lineHeight;

    ctx.save();
    if (touches.quoteStyle === 'clean_banner') {
      const padX = 28;
      const padY = 14;
      const maxMeasured = Math.max(...lines.map((l) => ctx.measureText(l).width), 180);
      const boxW = Math.min(width * 0.9, maxMeasured + padX * 2);
      const boxH = blockHeight + padY * 1.4;
      const boxX = width * 0.5 - boxW * 0.5;
      const boxY = firstLineY - quoteFontSize - padY * 0.4;

      ctx.fillStyle = 'rgba(8, 7, 10, 0.72)';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = 'rgba(242, 183, 5, 0.55)';
      ctx.fillRect(boxX, boxY, boxW, 1.5);
      ctx.fillRect(boxX, boxY + boxH - 1.5, boxW, 1.5);
    } else if (touches.quoteStyle === 'glow_fade') {
      const glow = ctx.createRadialGradient(
        width * 0.5,
        firstLineY + blockHeight * 0.25,
        10,
        width * 0.5,
        firstLineY + blockHeight * 0.25,
        maxQuoteW * 0.6
      );
      glow.addColorStop(0, 'rgba(242, 183, 5, 0.16)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, firstLineY - 40, width, blockHeight + 70);
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = touches.quoteStyle === 'word_by_word' ? '#FDE68A' : '#FFF7E2';

    lines.forEach((line, idx) => {
      ctx.fillText(line, width * 0.5, firstLineY + idx * lineHeight);
    });
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Main Arabic Chapter Title
  ctx.direction = 'rtl';
  ctx.font = `900 ${isCompact ? 30 : 38}px Cairo, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 14;
  ctx.fillText(scene.titleAr, width * 0.5, baseBottomY + slideY);
  ctx.shadowBlur = 0;

  ctx.restore();

  // Solid Black Cinematic Letterbox Borders (drawn at full opacity)
  ctx.save();
  ctx.fillStyle = '#040305';
  ctx.fillRect(0, 0, width, barH);
  ctx.fillRect(0, height - barH, width, barH);

  if (touches.tiktokLetterbox) {
    // Crisp golden cinematic border hairlines
    ctx.fillStyle = 'rgba(242, 183, 5, 0.35)';
    ctx.fillRect(0, barH - 1, width, 1);
    ctx.fillRect(0, height - barH, width, 1);

    // Top & Bottom "أسطورة روما" Cinematic Frame Titles
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.font = `900 ${isCompact ? 20 : 26}px Cairo, sans-serif`;
    ctx.fillStyle = '#F2B705';
    ctx.fillText('أسطورة روما', width * 0.5, barH * 0.5);

    ctx.fillStyle = '#F5F2EC';
    ctx.fillText('أسطورة روما', width * 0.5, height - barH * 0.5);
  }

  // Thin progress hairline at the very bottom
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(0, height - 3, width, 3);
  ctx.fillStyle = '#F2B705';
  ctx.fillRect(0, height - 3, width * globalProgress, 3);
  ctx.restore();
}

function drawFilmGrainAndVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  enableGrain: boolean
): void {
  // Cinematic radial vignette
  const vig = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    Math.min(width, height) * 0.32,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.78
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(4,3,5,0.68)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  if (!enableGrain) return;

  // Subtle lightweight dynamic film speckles
  ctx.save();
  ctx.fillStyle = 'rgba(255, 248, 230, 0.055)';
  const frameSeed = Math.floor(timeSec * 24);
  for (let i = 0; i < 65; i++) {
    const gx = hash(frameSeed * 1.3 + i * 7.7) * width;
    const gy = hash(frameSeed * 2.9 + i * 13.1) * height;
    ctx.fillRect(gx, gy, 1.6, 1.6);
  }
  ctx.restore();
}

export function renderCinemaFrame(params: RenderFrameParams): void {
  const {
    ctx,
    width,
    height,
    aspectRatio,
    progress,
    durationSeconds,
    scenes,
    images,
    preset,
    touches,
    beatPulse,
    discoveredClues,
    highlightedClueId,
  } = params;

  const timeSec = progress * durationSeconds;
  const sceneInfo = getSceneProgressInfo(progress, scenes);
  const { scene, localProgress, nextScene, transitionWeight } = sceneInfo;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#060507';
  ctx.fillRect(0, 0, width, height);

  // 1. Primary scene image with 2.5D Ken Burns & beat-reactive motion
  const cam = getCameraTransform(scene, localProgress, width, height, beatPulse, touches.beatShake);
  const transitionZoomPush = transitionWeight > 0 ? transitionWeight * 0.22 : 0;

  ctx.save();
  if (transitionWeight > 0) {
    ctx.globalAlpha = 1 - transitionWeight;
  }
  drawCoverImage(
    ctx,
    images[scene.id],
    width,
    height,
    cam.zoom + transitionZoomPush,
    cam.panX,
    cam.panY,
    cam.rot,
    scene.focalPoint
  );
  ctx.restore();

  // 2. Incoming next scene cross-whip transition
  if (nextScene && transitionWeight > 0) {
    const nextCam = getCameraTransform(nextScene, 0, width, height, beatPulse, touches.beatShake);
    ctx.save();
    ctx.globalAlpha = transitionWeight;
    drawCoverImage(
      ctx,
      images[nextScene.id],
      width,
      height,
      nextCam.zoom + (1 - transitionWeight) * 0.16,
      nextCam.panX,
      nextCam.panY,
      nextCam.rot,
      nextScene.focalPoint
    );
    ctx.restore();

    // Golden energy flash wipe on transition peak
    const flashPeak = Math.sin(transitionWeight * Math.PI);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const flare = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, width * 0.75);
    flare.addColorStop(0, `rgba(255, 240, 195, ${0.62 * flashPeak})`);
    flare.addColorStop(0.4, `rgba(242, 183, 5, ${0.32 * flashPeak})`);
    flare.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = flare;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // 3. Color Grading LUT pass
  drawColorGrading(ctx, width, height, preset);

  // 3B. Per-image & global Special Visual Effects ("الألوان المتلاشية" + "اللمعان الخافت")
  const fadeWeight = touches.fadingColors
    ? (scene.fadingColors ? 1 - transitionWeight : 0) +
      (nextScene && nextScene.fadingColors ? transitionWeight : 0)
    : 0;
  if (fadeWeight > 0) {
    drawFadingColorsEffect(ctx, width, height, localProgress, timeSec, fadeWeight, beatPulse);
  }

  const shimmerWeight = touches.softShimmer
    ? (scene.softShimmer ? 1 - transitionWeight : 0) +
      (nextScene && nextScene.softShimmer ? transitionWeight : 0)
    : 0;
  if (shimmerWeight > 0) {
    drawSoftShimmerEffect(
      ctx,
      width,
      height,
      timeSec,
      scene.focalPoint,
      scene.accentHex,
      shimmerWeight,
      beatPulse
    );
  }

  // 4. Volumetric Stadium Spotlights
  if (touches.spotlightSweeps) {
    drawSpotlightSweeps(ctx, width, height, timeSec, scene.accentHex);
  }

  // 5. Press Camera Flashbulbs
  if (touches.flashbulbs) {
    drawFlashbulbs(ctx, width, height, timeSec);
  }

  // 6. Rising Golden Embers & Dust
  if (touches.embers) {
    drawEmbersAndDust(ctx, width, height, timeSec, scene.accentHex, scene.secondaryHex, beatPulse);
  }

  // 7. Hidden Easter Eggs ("اللمسات التي يبحث عنها المشاهد")
  drawHiddenClueLayer(
    ctx,
    width,
    height,
    sceneInfo,
    timeSec,
    touches,
    discoveredClues,
    highlightedClueId
  );

  // 8. Kinetic Arabic/Italian Typography & Stat Counters
  drawKineticOverlay(ctx, width, height, aspectRatio, sceneInfo, progress, touches);

  // 9. Film Grain & Cinematic Vignette
  drawFilmGrainAndVignette(ctx, width, height, timeSec, touches.filmGrain);
}
