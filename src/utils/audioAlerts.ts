// Persistent Web Audio API Alarm Engine (never mutes on 2nd/3rd/10th trigger) + Vibration + Push

let persistentAudioCtx: AudioContext | null = null;
let sirenIntervalId: number | null = null;
let vibrateIntervalId: number | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!persistentAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtx) {
      persistentAudioCtx = new AudioCtx();
    }
  }
  return persistentAudioCtx;
}

async function ensureResumedContext(): Promise<AudioContext | null> {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // Browser may block until gesture
    }
  }
  return ctx;
}

function scheduleTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now + startOffset);
  gain.gain.setValueAtTime(0.0001, now + startOffset);
  gain.gain.exponentialRampToValueAtTime(volume, now + startOffset + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now + startOffset);
  osc.stop(now + startOffset + duration + 0.025);
}

// Unlock persistent AudioContext + Notification + Vibration on first user tap
export async function unlockPhoneAlerts(): Promise<{
  audioUnlocked: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
}> {
  const ctx = await ensureResumedContext();
  let audioUnlocked = false;
  if (ctx) {
    try {
      scheduleTone(ctx, 660, 0, 0.08, 0.14, 'sine');
      scheduleTone(ctx, 880, 0.09, 0.11, 0.14, 'sine');
      audioUnlocked = true;
    } catch {
      audioUnlocked = false;
    }
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(100);
    } catch {
      // Ignore
    }
  }

  let notificationPermission: NotificationPermission | 'unsupported' =
    'unsupported';
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

export async function playShortChime(
  kind: 'lock' | 'unlock' | 'denied' | 'step'
): Promise<void> {
  const ctx = await ensureResumedContext();
  if (!ctx) return;
  try {
    if (kind === 'lock') {
      scheduleTone(ctx, 523.25, 0, 0.09, 0.14, 'sine');
      scheduleTone(ctx, 783.99, 0.1, 0.15, 0.15, 'sine');
    } else if (kind === 'unlock') {
      scheduleTone(ctx, 783.99, 0, 0.09, 0.13, 'sine');
      scheduleTone(ctx, 523.25, 0.11, 0.16, 0.13, 'sine');
    } else if (kind === 'step') {
      scheduleTone(ctx, 440, 0, 0.04, 0.07, 'sine');
    } else {
      scheduleTone(ctx, 230, 0, 0.14, 0.18, 'triangle');
      scheduleTone(ctx, 180, 0.16, 0.2, 0.18, 'triangle');
    }
  } catch {
    // Ignore
  }
}

async function pulseEmergencySiren(severity: 'critical' | 'warning') {
  const ctx = await ensureResumedContext();
  if (!ctx) return;
  try {
    if (severity === 'critical') {
      scheduleTone(ctx, 980, 0, 0.22, 0.28, 'sawtooth');
      scheduleTone(ctx, 1340, 0.24, 0.22, 0.28, 'sawtooth');
      scheduleTone(ctx, 980, 0.48, 0.22, 0.28, 'sawtooth');
      scheduleTone(ctx, 1340, 0.72, 0.26, 0.28, 'sawtooth');
    } else {
      scheduleTone(ctx, 760, 0, 0.2, 0.24, 'triangle');
      scheduleTone(ctx, 980, 0.24, 0.24, 0.24, 'triangle');
    }
  } catch {
    // Ignore
  }
}

export function startRepeatableAlarm(
  severity: 'critical' | 'warning',
  pushTitle?: string,
  pushBody?: string,
  alertTag?: string
): void {
  stopRepeatableAlarm();

  void pulseEmergencySiren(severity);
  sirenIntervalId = window.setInterval(() => {
    void pulseEmergencySiren(severity);
  }, 1450);

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
    }, 2400);
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
        tag: alertTag ?? `safestep-alarm-${Date.now()}`,
        requireInteraction: true,
      });
    } catch {
      // Ignore mobile browser restriction
    }
  }
}

export function stopRepeatableAlarm(): void {
  if (sirenIntervalId !== null) {
    window.clearInterval(sirenIntervalId);
    sirenIntervalId = null;
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
