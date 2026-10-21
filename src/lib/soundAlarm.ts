// ─── DARK SYNDICATE CYBER SOUND ALARM ENGINE ──────────────────────────────────
// Pure Web Audio API synthesized sound alarms for Staff & Floor Operations.
// Fully offline, zero external sound asset dependencies, autoplay-resilient.

let audioCtx: AudioContext | null = null;
let isUnlocked = false;

const ALARM_STORAGE_KEY = 'ds_staff_alarm_enabled';
const ALARM_VOLUME_KEY = 'ds_staff_alarm_volume';

/**
 * Get or create the singleton AudioContext instance.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

/**
 * Unlock AudioContext on the first user interaction (click, touch, key).
 */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  if (!isUnlocked) {
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      isUnlocked = true;
    } catch {}
  }
}

// Automatically attach unlock listeners in browser environment
if (typeof window !== 'undefined') {
  const handleUserGesture = () => {
    unlockAudio();
  };
  window.addEventListener('click', handleUserGesture, { passive: true });
  window.addEventListener('touchstart', handleUserGesture, { passive: true });
  window.addEventListener('keydown', handleUserGesture, { passive: true });
}

/**
 * Check if sound alarm is enabled (default is true).
 */
export function isAlarmSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(ALARM_STORAGE_KEY);
  if (stored === null) return true; // Default ON
  return stored === 'true';
}

/**
 * Toggle or set alarm sound enabled state.
 */
export function setAlarmSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ALARM_STORAGE_KEY, String(enabled));
  window.dispatchEvent(
    new CustomEvent('ds-alarm-sound-changed', { detail: { enabled } })
  );
  if (enabled) {
    unlockAudio();
    playTestChime();
  }
}

/**
 * Get current alarm volume (0.1 to 1.0, default 0.8).
 */
export function getAlarmVolume(): number {
  if (typeof window === 'undefined') return 0.8;
  const vol = Number(localStorage.getItem(ALARM_VOLUME_KEY));
  return isNaN(vol) || vol <= 0 ? 0.8 : Math.min(1.0, vol);
}

/**
 * Set alarm volume (0.1 to 1.0).
 */
export function setAlarmVolume(vol: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ALARM_VOLUME_KEY, String(Math.max(0.1, Math.min(1.0, vol))));
}

// ─── SYNTHESIZED SOUND EFFECTS ──────────────────────────────────────────────

/**
 * Play a rich two-tone synth tone with fundamental and harmonic support.
 */
function playDualTone(
  freq1: number,
  freq2: number,
  durationSec: number = 0.45,
  type: OscillatorType = 'sine',
  volumeFactor: number = 1.0
) {
  if (!isAlarmSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const masterVolume = getAlarmVolume() * 0.3 * volumeFactor;

  // Primary oscillator
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = type;
  osc1.frequency.setValueAtTime(freq1, now);
  osc1.frequency.exponentialRampToValueAtTime(freq2, now + durationSec * 0.4);

  gain1.gain.setValueAtTime(masterVolume, now);
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  // Harmonic warmth oscillator (octave lower or fifth)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq1 * 0.5, now);
  osc2.frequency.exponentialRampToValueAtTime(freq2 * 0.5, now + durationSec * 0.4);

  gain2.gain.setValueAtTime(masterVolume * 0.4, now);
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + durationSec);
  osc2.stop(now + durationSec);
}

/**
 * ALARM 1: "ENDING SOON" (<= 15m or <= 5m warning)
 * A distinct, resonant cyberpunk double chime (Ding-Dong / E5 -> A5).
 */
export function playEndingSoonAlarm() {
  if (!isAlarmSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const masterVolume = getAlarmVolume() * 0.35;

  const playChimeNote = (freq: number, startDelay: number, len: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + startDelay);

    gain.gain.setValueAtTime(0.0001, now + startDelay);
    gain.gain.exponentialRampToValueAtTime(masterVolume, now + startDelay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startDelay + len);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + startDelay);
    osc.stop(now + startDelay + len);
  };

  // Two pleasant, loud bell chimes (F#5 -> B5)
  playChimeNote(739.99, 0, 0.4);
  playChimeNote(987.77, 0.22, 0.55);
}

/**
 * ALARM 2: "OVERDUE / TIME UP / EXTRA TIME"
 * An urgent, repeating 3-pulse cyber buzzer alarm that cuts through arena noise.
 */
export function playOverdueAlarm() {
  if (!isAlarmSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const masterVolume = getAlarmVolume() * 0.45;

  const playPulse = (freq: number, startDelay: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + startDelay);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.1, now + startDelay + 0.12);

    gain.gain.setValueAtTime(0.0001, now + startDelay);
    gain.gain.exponentialRampToValueAtTime(masterVolume, now + startDelay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startDelay + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + startDelay);
    osc.stop(now + startDelay + 0.18);
  };

  // 3 sharp urgent alarm pulses (High alert A5 -> C6 -> D6)
  playPulse(880, 0);
  playPulse(1046.5, 0.2);
  playPulse(1174.66, 0.4);

  // Second burst after brief pause for unmistakable alarm sound
  playPulse(880, 0.7);
  playPulse(1046.5, 0.9);
  playPulse(1174.66, 1.1);
}

/**
 * ALARM 3: "UPCOMING BOOKING / DUE FOR CHECK-IN"
 * An ascending 3-note welcome chime (C5 -> E5 -> G5).
 */
export function playBookingDueAlarm() {
  if (!isAlarmSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const masterVolume = getAlarmVolume() * 0.32;

  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, idx) => {
    const startDelay = idx * 0.14;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + startDelay);

    gain.gain.setValueAtTime(0.0001, now + startDelay);
    gain.gain.exponentialRampToValueAtTime(masterVolume, now + startDelay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startDelay + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + startDelay);
    osc.stop(now + startDelay + 0.35);
  });
}

/**
 * Quick confirmation beep for testing or toggling sound.
 */
export function playTestChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.28);
}
