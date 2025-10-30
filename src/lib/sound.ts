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

    // 页面任意交互后解锁
    const unlock = () => {
      if (this.unlocked) return;
      try {
        this.audio.muted = false;
        this.audio.volume = 1;
        // 某些浏览器需要先 load
        this.audio.load();
        this.unlocked = true;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      } catch {}
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
  mute() { this.muted = true; this.writeMuted(true); }
  unmute() { this.muted = false; this.writeMuted(false); }

  /**
   * 强制取消静音（调试/恢复用）
   */
  forceUnmute() { this.unmute(); this.unlocked = true; }

  /**
   * 播放提示音（自动回退多源，出错继续尝试下一源）
   */
  async play(name: keyof typeof SOURCES) {
    const now = Date.now();
    if (now - this.lastPlay < this.throttleMs) return;
    this.lastPlay = now;

    if (this.muted) return;

    const list = SOURCES[name];

    // 逐个源尝试：优先使用一次性 Audio 实例，规避某些浏览器对共享实例/隐藏标签页的限制
    for (const s of list) {
      try {
        const a = new Audio();
        a.crossOrigin = 'anonymous';
        a.preload = 'auto';
        a.src = s.src;
        if (!canPlay(a, s)) continue;
        a.volume = 1;
        await a.play();
        return; // 成功
      } catch {}
    }
    // 兜底：再尝试共享实例
    for (const s of list) {
      try {
        if (!canPlay(this.audio, s)) continue;
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.src = s.src;
        this.audio.volume = 1;
        this.audio.load();
        await this.audio.play();
        return;
      } catch {}
    }
    // 如果所有源都失败，静默；保留日志即可
    // console.error('No playable audio sources for', name);
  }
}

export const Sound = new SoundManager();