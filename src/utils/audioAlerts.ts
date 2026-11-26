// Real Web Audio API emergency siren + short chimes + Vibration + Push Notification helper

let audioCtx: AudioContext | null = null;
let alarmIntervalId: number | null = null;
let vibrateIntervalId: number | null = null;

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startOffset);
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + startOffset + 0.015);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + startOffset + duration
  );
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startOffset);
  osc.stop(ctx.currentTime + startOffset + duration + 0.02);
}

// Call on user tap ("تفعيل تنبيهات الهاتف والصوت") to unlock iOS/Android Web Audio + Notification + Vibration
export async function unlockPhoneAlerts(): Promise<{
  audioUnlocked: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
}> {
  const ctx = ensureAudioContext();
  let audioUnlocked = false;
  if (ctx) {
    try {
      await ctx.resume();
      playTone(ctx, 660, 0, 0.09, 0.14, 'sine');
      playTone(ctx, 880, 0.1, 0.12, 0.14, 'sine');
      audioUnlocked = true;
    } catch {
      audioUnlocked = false;
    }
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(120);
    } catch {
      // Ignore unsupported vibrate
    }
  }

  let notificationPermission: NotificationPermission | 'unsupported' = 'unsupported';
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      notificationPermission = 'granted';
    } else if (Notification.permission !== 'denied') {
      try {
        notificationPermission = await Notification.requestPermission();
      } catch {
        notificationPermission = Notification.permission;
      }
    } else {
      notificationPermission = 'denied';
    }
  }

  return { audioUnlocked, notificationPermission };
}

export function playShortChime(kind: 'lock' | 'unlock' | 'denied'): void {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  try {
    if (kind === 'lock') {
      playTone(ctx, 523.25, 0, 0.09, 0.14, 'sine');
      playTone(ctx, 783.99, 0.1, 0.16, 0.15, 'sine');
    } else if (kind === 'unlock') {
      playTone(ctx, 783.99, 0, 0.09, 0.13, 'sine');
      playTone(ctx, 523.25, 0.11, 0.16, 0.13, 'sine');
    } else {
      playTone(ctx, 240, 0, 0.14, 0.18, 'triangle');
      playTone(ctx, 180, 0.16, 0.2, 0.18, 'triangle');
    }
  } catch {
    // Ignore autoplay restrictions
  }
}

function pulseEmergencySiren(severity: 'critical' | 'warning') {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  try {
    if (severity === 'critical') {
      // High-urgency loud dual-tone emergency siren
      playTone(ctx, 980, 0, 0.22, 0.28, 'sawtooth');
      playTone(ctx, 1320, 0.24, 0.22, 0.28, 'sawtooth');
      playTone(ctx, 980, 0.48, 0.22, 0.28, 'sawtooth');
      playTone(ctx, 1320, 0.72, 0.26, 0.28, 'sawtooth');
    } else {
      playTone(ctx, 780, 0, 0.2, 0.22, 'triangle');
      playTone(ctx, 980, 0.25, 0.24, 0.22, 'triangle');
    }
  } catch {
    // Ignore audio error
  }
}

export function startContinuousAlarm(
  severity: 'critical' | 'warning',
  pushTitle?: string,
  pushBody?: string
): void {
  stopContinuousAlarm();

  pulseEmergencySiren(severity);
  alarmIntervalId = window.setInterval(() => {
    pulseEmergencySiren(severity);
  }, 1500);

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const pattern = [500, 200, 500, 200, 800];
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore
    }
    vibrateIntervalId = window.setInterval(() => {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore
      }
    }, 2500);
  }

  if (
    pushTitle &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(pushTitle, {
        body: pushBody ?? '',
        tag: 'safestep-live-alarm',
        requireInteraction: true,
      });
    } catch {
      // Some mobile browsers restrict direct Notification constructor
    }
  }
}

export function stopContinuousAlarm(): void {
  if (alarmIntervalId !== null) {
    window.clearInterval(alarmIntervalId);
    alarmIntervalId = null;
  }
  if (vibrateIntervalId !== null) {
    window.clearInterval(vibrateIntervalId);
    vibrateIntervalId = null;
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      // Ignore
    }
  }
}
