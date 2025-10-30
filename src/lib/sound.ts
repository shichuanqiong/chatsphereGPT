// src/lib/sound.ts
type Source = { src: string; type: string };

const BASE = (import.meta as any).env?.BASE_URL || '/';

const url = (p: string) => new URL(p, BASE).toString();

export const SOURCES: Record<string, Source[]> = {
  ding: [
    { src: url('sfx/ding.mp3'), type: 'audio/mpeg' },
    { src: url('sfx/ding.ogg'), type: 'audio/ogg' },
    { src: url('sfx/ding.wav'), type: 'audio/wav' },
    { src: 'https://cdn.jsdelivr.net/gh/antfu/static@main/sfx/notification.mp3', type: 'audio/mpeg' }, // 兜底
  ],
} as const;

class SoundManager {
  private unlocked = false;
  private muted = false;
  private lastPlay = 0;
  private throttleMs = 150;

  constructor() {
    this.muted = this.readMuted();
    console.log('[Sound] Initialized. Muted:', this.muted);

    // 首个用户交互后预热音频
    const unlock = () => {
      if (this.unlocked) return;
      try {
        this.unlocked = true;
        console.log('[Sound] Unlocked by user interaction');
        this.play('ding').catch(() => {});
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      } catch (err) {
        console.error('[Sound] Error unlocking:', err);
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    (window as any).Sound = this;
  }

  private readMuted() {
    try { return localStorage.getItem('mute') === '1'; } catch { return false; }
  }
  
  private writeMuted(v: boolean) {
    try { localStorage.setItem('mute', v ? '1' : '0'); } catch {}
  }

  isMuted() { return this.muted; }
  
  mute() { 
    this.muted = true; 
    this.writeMuted(true); 
    console.log('[Sound] Muted');
  }
  
  unmute() { 
    this.muted = false; 
    this.writeMuted(false); 
    console.log('[Sound] Unmuted');
  }

  forceUnmute() { 
    this.unmute(); 
    this.unlocked = true; 
    console.log('[Sound] Force unmuted and unlocked');
  }

  /**
   * 播放提示音（自动回退多源）
   */
  async play(name: keyof typeof SOURCES) {
    const now = Date.now();
    if (now - this.lastPlay < this.throttleMs) {
      console.log('[Sound] Throttled');
      return;
    }
    this.lastPlay = now;

    if (this.muted) {
      console.log('[Sound] Muted - skipping playback');
      return;
    }
    
    if (!this.unlocked) {
      console.warn('[Sound] Not unlocked yet');
    }

    console.log('[Sound] Playing:', name);

    const list = SOURCES[name];
    if (!list) {
      console.error('[Sound] No sources for:', name);
      return;
    }

    // 逐个源尝试，打印完整 URL
    for (const s of list) {
      try {
        console.log('[Sound] Trying:', s.src);
        
        const audio = new Audio(s.src);
        audio.type = s.type;
        audio.crossOrigin = 'anonymous';
        
        await audio.play();
        console.log('[Sound] ✅ Played:', s.src);
        return;
      } catch (err) {
        console.warn('[Sound] Failed:', s.src, err);
      }
    }
    
    console.error('[Sound] ❌ All sources failed');
  }
}

export const Sound = new SoundManager();