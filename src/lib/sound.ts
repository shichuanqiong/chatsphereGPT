// src/lib/sound.ts
type Source = { src: string; type?: string };

const SOURCES: Record<string, Source[]> = {
  // "叮"提示音，多源回退：优先本地文件 → CDN备用
  ding: [
    { src: '/sfx/new-notification-010-352755.mp3', type: 'audio/mpeg' },
    { src: 'https://cdn.jsdelivr.net/gh/antfu/static/sfx/notification.mp3', type: 'audio/mpeg' },
  ],
};

const canPlay = (audio: HTMLAudioElement, s: Source) =>
  !s.type || audio.canPlayType(s.type) !== '';

class SoundManager {
  private audio = new Audio();
  private unlocked = false;
  private muted = false;
  private lastPlay = 0;
  private throttleMs = 150; // 最短间隔，避免短时间多次ding

  constructor() {
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.muted = this.readMuted();
    
    console.log('[Sound] Initialized. Muted:', this.muted);

    // 页面任意交互后解锁
    const unlock = () => {
      if (this.unlocked) return;
      try {
        this.audio.muted = false;
        this.audio.volume = 1;
        // 某些浏览器需要先 load
        this.audio.load();
        this.unlocked = true;
        console.log('[Sound] Audio unlocked by user interaction');
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      } catch (err) {
        console.error('[Sound] Error unlocking audio:', err);
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    (window as any).Sound = this; // 调试用
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

  /**
   * 强制取消静音（调试/恢复用）
   */
  forceUnmute() { 
    this.unmute(); 
    this.unlocked = true; 
    console.log('[Sound] Force unmuted and unlocked');
  }

  /**
   * 播放提示音（自动回退多源，出错继续尝试下一源）
   */
  async play(name: keyof typeof SOURCES) {
    const now = Date.now();
    if (now - this.lastPlay < this.throttleMs) {
      console.log('[Sound] Throttled - too soon to play again');
      return;
    }
    this.lastPlay = now;

    if (this.muted) {
      console.log('[Sound] Muted - skipping playback');
      return;
    }
    
    if (!this.unlocked) {
      console.warn('[Sound] Audio not unlocked yet - need user interaction first');
    }

    console.log('[Sound] Playing:', name, '- Unlocked:', this.unlocked);

    const list = SOURCES[name];
    if (!list) {
      console.error('[Sound] No sources found for:', name);
      return;
    }

    // 逐个源尝试：优先使用一次性 Audio 实例，规避某些浏览器对共享实例/隐藏标签页的限制
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      try {
        console.log(`[Sound] Trying source ${i + 1}/${list.length}:`, s.src);
        const a = new Audio();
        a.crossOrigin = 'anonymous';
        a.preload = 'auto';
        a.src = s.src;
        if (!canPlay(a, s)) {
          console.log('[Sound] Browser cannot play this format:', s.type);
          continue;
        }
        a.volume = 1;
        console.log('[Sound] Playing new Audio instance...');
        await a.play();
        console.log('[Sound] ✅ Successfully played:', s.src);
        return; // 成功
      } catch (err) {
        console.warn(`[Sound] Failed to play source ${i + 1}:`, err);
      }
    }
    
    // 兜底：再尝试共享实例
    console.log('[Sound] Trying fallback with shared instance...');
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      try {
        console.log(`[Sound] Trying shared audio ${i + 1}/${list.length}:`, s.src);
        if (!canPlay(this.audio, s)) {
          console.log('[Sound] Shared audio cannot play format:', s.type);
          continue;
        }
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.src = s.src;
        this.audio.volume = 1;
        this.audio.load();
        console.log('[Sound] Playing shared Audio instance...');
        await this.audio.play();
        console.log('[Sound] ✅ Successfully played with shared instance:', s.src);
        return;
      } catch (err) {
        console.warn(`[Sound] Failed with shared audio ${i + 1}:`, err);
      }
    }
    
    console.error('[Sound] ❌ All audio sources failed');
  }
}

export const Sound = new SoundManager();