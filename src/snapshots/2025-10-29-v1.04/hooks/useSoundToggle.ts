import { useEffect, useState } from 'react';
import { Sound } from '../lib/sound';

export function useSoundToggle() {
  const [muted, setMuted] = useState<boolean>(() => Sound.isMuted());

  useEffect(() => {
    // 同步到 Sound
    if (muted) {
      Sound.mute();
    } else {
      Sound.unmute();
    }
  }, [muted]);

  return {
    muted,
    toggle: () => setMuted((v) => !v),
  };
}

