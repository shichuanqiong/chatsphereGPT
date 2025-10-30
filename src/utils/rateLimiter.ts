/**
 * Rate Limiter for ChatSphere
 * Manages slow mode and spam detection per user per room
 */

type UserRoomKey = string; // Format: "uid:roomId"

interface RateLimitState {
  lastMessageTime: number;
  messageCount: number; // 快速消息计数（用于 spam 检测）
  isInSpamMode: boolean;
  spamModeEndTime: number;
}

// 存储每个用户在每个房间的速率限制状态
const rateLimitStates = new Map<UserRoomKey, RateLimitState>();

/**
 * 生成用户房间的唯一 key
 */
export const getRoomRateLimitKey = (uid: string, roomId: string): UserRoomKey => {
  return `${uid}:${roomId}`;
};

/**
 * 获取或创建用户房间的限制状态
 */
const getOrCreateState = (key: UserRoomKey): RateLimitState => {
  if (!rateLimitStates.has(key)) {
    rateLimitStates.set(key, {
      lastMessageTime: 0,
      messageCount: 0,
      isInSpamMode: false,
      spamModeEndTime: 0,
    });
  }
  return rateLimitStates.get(key)!;
};

/**
 * 检查是否可以发送消息
 * @returns { canSend: boolean, reason?: string, remainingSeconds?: number }
 */
export const checkRateLimit = (
  uid: string,
  roomId: string,
  slowModeSeconds: number
): { canSend: boolean; reason?: string; remainingSeconds?: number } => {
  const key = getRoomRateLimitKey(uid, roomId);
  const state = getOrCreateState(key);
  const now = Date.now();

  // 检查 Spam Mode（30秒防护）
  if (state.isInSpamMode && now < state.spamModeEndTime) {
    const remainingSeconds = Math.ceil((state.spamModeEndTime - now) / 1000);
    return {
      canSend: false,
      reason: `🚫 You're in anti-spam mode. Please wait ${remainingSeconds}s.`,
      remainingSeconds,
    };
  }

  // Spam Mode 过期，重置
  if (state.isInSpamMode && now >= state.spamModeEndTime) {
    state.isInSpamMode = false;
    state.messageCount = 0;
  }

  // 检查基础 Slow Mode
  if (slowModeSeconds > 0) {
    const timeSinceLastMessage = now - state.lastMessageTime;
    const cooldownMs = slowModeSeconds * 1000;

    if (timeSinceLastMessage < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastMessage) / 1000);
      return {
        canSend: false,
        reason: `⏱️ Slow mode: Wait ${remainingSeconds}s before sending.`,
        remainingSeconds,
      };
    }
  }

  return { canSend: true };
};

/**
 * 记录消息发送，检测 spam 行为
 * 如果检测到 spam，自动激活 30 秒的 spam mode
 * @returns { triggered: boolean, reason?: string }
 */
export const recordMessage = (
  uid: string,
  roomId: string
): { triggered: boolean; reason?: string } => {
  const key = getRoomRateLimitKey(uid, roomId);
  const state = getOrCreateState(key);
  const now = Date.now();

  // 检测快速连续发言（3 秒内发 3 条）
  const timeSinceLastMessage = now - state.lastMessageTime;

  if (timeSinceLastMessage < 3000) {
    state.messageCount++;
    console.log(`[Spam Detection] User ${uid} in room ${roomId}: ${state.messageCount} messages in 3s`);

    // 达到 spam 阈值
    if (state.messageCount >= 3) {
      state.isInSpamMode = true;
      state.spamModeEndTime = now + 30000; // 30 秒
      state.messageCount = 0;

      console.warn(
        `[Spam Mode Activated] User ${uid} in room ${roomId} for 30s due to rapid messages`
      );

      return {
        triggered: true,
        reason: '🚫 You are sending too fast! Anti-spam mode activated for 30s.',
      };
    }
  } else {
    // 超过 3 秒，重置计数
    state.messageCount = 1;
  }

  // 更新最后消息时间
  state.lastMessageTime = now;

  return { triggered: false };
};

/**
 * 获取当前状态（用于调试）
 */
export const getState = (uid: string, roomId: string): RateLimitState => {
  const key = getRoomRateLimitKey(uid, roomId);
  return getOrCreateState(key);
};

/**
 * 清空状态（用于用户登出或房间清理）
 */
export const clearState = (uid: string, roomId: string) => {
  const key = getRoomRateLimitKey(uid, roomId);
  rateLimitStates.delete(key);
};

/**
 * 从 localStorage 读取 slow mode 设置
 */
export const getSlowModeFromSettings = (): number => {
  try {
    const settings = localStorage.getItem('system-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.slowMode || 0;
    }
  } catch (error) {
    console.error('Failed to get slow mode from settings:', error);
  }
  return 0;
};
