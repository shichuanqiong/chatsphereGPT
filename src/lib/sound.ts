// src/lib/sound.ts
type Source = { src: string; type?: string };

const SOURCES: Record<string, Source[]> = {
  // "叮"提示音，多源回退：本地mp3/ogg/wav -> CDN备用
  ding: [
    { src: '/sfx/ding.mp3', type: 'audio/mpeg' },
    { src: '/sfx/ding.ogg', type: 'audio/ogg' },
    { src: '/sfx/ding.wav', type: 'audio/wav' },
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

    if (this.muted || !this.unlocked) return;

    const list = SOURCES[name];
    for (const s of list) {
      try {
        if (!canPlay(this.audio, s)) continue;
        // 切源前先停掉
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.src = s.src;
        // 立即加载，确保 canplay 触发
        this.audio.load();

        // 等待一小会，若能play就播；否则换下一个
        await new Promise<void>((resolve, reject) => {
          const onCanPlay = async () => {
            cleanup();
            try {
              await this.audio.play();
              resolve();
            } catch (e) {
              reject(e);
            }
          };
          const onError = () => { cleanup(); reject(new Error('source error')); };
          const cleanup = () => {
            this.audio.removeEventListener('canplaythrough', onCanPlay);
            this.audio.removeEventListener('error', onError);
          };

          this.audio.addEventListener('canplaythrough', onCanPlay, { once: true });
          this.audio.addEventListener('error', onError, { once: true });
          // 超时回退
          setTimeout(() => onError(), 1200);
        });

        // 成功播出，直接return
        return;
      } catch (err) {
        // console.warn('Sound source failed:', s.src, err);
        continue; // 尝试下一源
      }
    }
    // 如果所有源都失败，静默；保留日志即可
    // console.error('No playable audio sources for', name);
  }
}

export const Sound = new SoundManager();