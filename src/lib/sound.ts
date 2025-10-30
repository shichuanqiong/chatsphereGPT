// src/lib/sound.ts
type Source = { src: string; type: string };

export const SOURCES: Record<string, Source[]> = {
  // 主要提示音：使用实际存在的文件
  ding: [
    { src: 'sfx/new-notification-010-352755.mp3', type: 'audio/mpeg' },
    { src: 'sfx/pop_soft.wav', type: 'audio/wav' },
    { src: 'sfx/ding_soft.wav', type: 'audio/wav' },
    { src: 'https://cdn.jsdelivr.net/gh/antfu/static@main/sfx/notification.mp3', type: 'audio/mpeg' },
  ],
  
  // 可选：其他音效
  birds: [{ src: 'sfx/forest_birds_mix.wav', type: 'audio/wav' }],
  pop: [{ src: 'sfx/pop_soft.wav', type: 'audio/wav' }],
} as const;

class SoundManager {
  private unlocked = false;
  private muted = false;
  private lastPlay = 0;
  private throttleMs = 150;

  constructor() {
    this.muted = this.readMuted();
    console.log('[Sound] Initialized. Muted:', this.muted);

    // 页面任意交互后解锁
    const unlock = () => {
      if (this.unlocked) return;
      try {
        this.unlocked = true;
        console.log('[Sound] Audio unlocked by user interaction');
        // 预热音频，让浏览器允许后续播放
        this.play('ding').catch(() => {});
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

    // 逐个源尝试
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      try {
        console.log(`[Sound] Trying source ${i + 1}/${list.length}:`, s.src);
        
        const audio = new Audio();
        
        // 构建完整 URL（支持相对路径和子路径）
        let finalSrc = s.src;
        if (!s.src.startsWith('http')) {
          // 本地文件：使用 BASE_URL
          const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
          finalSrc = baseUrl ? `${baseUrl}/${s.src}` : s.src;
        }
        
        audio.src = finalSrc;
        audio.type = s.type;
        audio.crossOrigin = 'anonymous';
        
        // 先加载，避免 404/跨域无声
        if (audio.load) {
          audio.load();
        }
        
        console.log('[Sound] Playing:', finalSrc);
        await audio.play();
        console.log('[Sound] ✅ Successfully played:', s.src);
        return; // 成功
      } catch (err) {
        console.warn(`[Sound] Failed to play source ${i + 1}:`, err);
      }
    }
    
    console.error('[Sound] ❌ All audio sources failed');
  }
}

export const Sound = new SoundManager();