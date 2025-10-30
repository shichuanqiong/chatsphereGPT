/**
 * Rate Limiter for ChatSphere
 * - Manages slow mode and spam detection per user per room
 * - Local state for immediate feedback
 * - Optional RTDB sync for cross-tab/device consistency
 */

import { ref as rtdbRef, get as rtdbGet, set as rtdbSet, serverTimestamp, getDatabase } from 'firebase/database';
import { db } from '../firebase';

type UserRoomKey = string; // Format: "uid:roomId"

interface RateLimitState {
  lastMessageTime: number;
  messageCount: number; // 快速消息计数（用于 spam 检测）
  isInSpamMode: boolean;
  spamModeEndTime: number;
}

// 存储每个用户在每个房间的速率限制状态
const rateLimitStates = new Map<UserRoomKey, RateLimitState>();

// 常量配置
const SPAM_WINDOW_MS = 3000;        // 3 秒滑窗
const SPAM_BURST_COUNT = 3;         // 3 条消息触发
const BURST_SLOW_MS = 30000;        // 30 秒临时防护

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
 * 从 RTDB 检查跨标签页/设备的速率限制（可选）
 * 用于防止用户在多个标签页绕过限制
 */
export const checkRateLimitCrossTabs = async (
  uid: string,
  roomId: string,
  slowModeSeconds: number
): Promise<{ canSend: boolean; reason?: string; remainingSeconds?: number }> => {
  try {
    if (!uid || !roomId || slowModeSeconds <= 0) {
      return { canSend: true };
    }

    const database = getDatabase();
    const rtdbPath = rtdbRef(database, `rateLimits/${roomId}/${uid}`);
    const snap = await rtdbGet(rtdbPath);

    const data = snap.val();
    if (!data || !data.lastSent) {
      return { canSend: true };
    }

    const now = Date.now();
    const lastSent = data.lastSent; // Firebase serverTimestamp 返回毫秒
    const elapsedMs = now - lastSent;
    const cooldownMs = slowModeSeconds * 1000;

    if (elapsedMs < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      return {
        canSend: false,
        reason: `⏱️ Rate limited (global): wait ${remainingSeconds}s.`,
        remainingSeconds,
      };
    }

    return { canSend: true };
  } catch (err) {
    console.error('[rateLimiter] Error checking cross-tab limit:', err);
    // 如果 RTDB 失败，允许发送（优先用户体验）
    return { canSend: true };
  }
};

/**
 * 记录消息到 RTDB，确保跨标签页一致性
 */
export const recordMessageCrossTabs = async (
  uid: string,
  roomId: string
): Promise<void> => {
  try {
    if (!uid || !roomId) return;

    const database = getDatabase();
    const rtdbPath = rtdbRef(database, `rateLimits/${roomId}/${uid}`);
    await rtdbSet(rtdbPath, { lastSent: serverTimestamp() });
  } catch (err) {
    console.error('[rateLimiter] Error recording message to RTDB:', err);
    // 不阻断发送，继续
  }
};

/**
 * 检查是否可以发送消息（本地状态）
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
      reason: `🚫 Anti-spam active. Wait ${remainingSeconds}s.`,
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
        reason: `⏱️ Slow mode: wait ${remainingSeconds}s.`,
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

  if (timeSinceLastMessage < SPAM_WINDOW_MS) {
    state.messageCount++;
    console.log(
      `[Spam Detection] User ${uid} in room ${roomId}: ${state.messageCount}/${SPAM_BURST_COUNT} messages in ${SPAM_WINDOW_MS}ms`
    );

    // 达到 spam 阈值
    if (state.messageCount >= SPAM_BURST_COUNT) {
      state.isInSpamMode = true;
      state.spamModeEndTime = now + BURST_SLOW_MS;
      state.messageCount = 0;

      console.warn(
        `[Spam Mode] User ${uid} in room ${roomId} triggered ${BURST_SLOW_MS / 1000}s protection`
      );

      return {
        triggered: true,
        reason: `🚫 Sending too fast! Auto-protection for ${BURST_SLOW_MS / 1000}s.`,
      };
    }
  } else {
    // 超过窗口，重置计数
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
