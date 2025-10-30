import { ref, get, remove, query, orderByChild, endBefore } from 'firebase/database';
import { db } from '../firebase';

/**
 * 清理过期的房间
 * 删除创建时间超过8小时的房间及其相关数据
 */
export async function cleanupExpiredRooms(): Promise<{ cleaned: number; errors: string[] }> {
  const errors: string[] = [];
  let cleaned = 0;
  
  try {
    // 获取所有房间
    const roomsRef = ref(db, 'rooms');
    const roomsSnap = await get(roomsRef);
    
    if (!roomsSnap.exists()) {
      return { cleaned: 0, errors: [] };
    }
    
    const rooms = roomsSnap.val();
    const now = Date.now();
    const eightHoursAgo = now - (8 * 60 * 60 * 1000);
    
    // 检查每个房间的过期时间（expiresAt）
    for (const [roomId, roomData] of Object.entries(rooms)) {
      const room = roomData as any;
      
      // 跳过官方房间（它们不应该被自动关闭）
      if (room.isOfficial === true) {
        continue;
      }
      
      // 检查是否过期
      const expiresAt = room.expiresAt || (room.createdAt + (8 * 60 * 60 * 1000));
      if (expiresAt <= now) {
        try {
          await cleanupRoom(roomId);
          cleaned++;
          console.log(`Cleaned up expired room: ${room.name || roomId}`);
        } catch (error: any) {
          errors.push(`Failed to cleanup room ${roomId}: ${error.message}`);
          console.error(`Failed to cleanup room ${roomId}:`, error);
        }
      }
    }
    
  } catch (error: any) {
    errors.push(`Failed to get rooms: ${error.message}`);
    console.error('Failed to cleanup expired rooms:', error);
  }
  
  return { cleaned, errors };
}

/**
 * 清理单个房间的所有相关数据
 */
async function cleanupRoom(roomId: string): Promise<void> {
  const updates: Record<string, null> = {};
  
  // 要删除的路径列表
  const pathsToDelete = [
    `rooms/${roomId}`,
    `roomMembers/${roomId}`,
    `messages/${roomId}`,
    `roomsMeta/${roomId}`, // 这个路径可能不存在，但安全起见包含
    `kickEvents/${roomId}`,
    `rooms/${roomId}/bans`,
    `rooms/${roomId}/invites`,
  ];
  
  // 构建批量删除的更新对象
  pathsToDelete.forEach(path => {
    updates[path] = null;
  });
  
  // 执行批量删除
  const { update } = await import('firebase/database');
  await update(ref(db), updates);
  
  // 清理用户房间元数据（需要遍历所有用户）
  try {
    const roomsMetaRef = ref(db, 'roomsMeta');
    const roomsMetaSnap = await get(roomsMetaRef);
    
    if (roomsMetaSnap.exists()) {
      const roomsMeta = roomsMetaSnap.val();
      const userUpdates: Record<string, null> = {};
      
      // 遍历所有用户的房间元数据
      for (const [userId, userRooms] of Object.entries(roomsMeta)) {
        if (userRooms && typeof userRooms === 'object') {
          const userRoomsObj = userRooms as Record<string, any>;
          if (userRoomsObj[roomId]) {
            userUpdates[`roomsMeta/${userId}/${roomId}`] = null;
          }
        }
      }
      
      // 如果有用户房间元数据需要清理，执行更新
      if (Object.keys(userUpdates).length > 0) {
        await update(ref(db), userUpdates);
      }
    }
  } catch (error) {
    console.warn(`Failed to cleanup room meta for room ${roomId}:`, error);
    // 不抛出错误，因为主要清理已经完成
  }
}

/**
 * 启动定时清理任务
 * 每30分钟检查一次过期房间
 */
export function startRoomCleanupScheduler(): () => void {
  console.log('Starting room cleanup scheduler...');
  
  // 立即执行一次清理
  cleanupExpiredRooms().then(result => {
    if (result.cleaned > 0) {
      console.log(`Initial cleanup: ${result.cleaned} rooms cleaned`);
    }
    if (result.errors.length > 0) {
      console.warn('Cleanup errors:', result.errors);
    }
  });
  
  // 设置定时器，每30分钟执行一次
  const interval = setInterval(async () => {
    const result = await cleanupExpiredRooms();
    if (result.cleaned > 0) {
      console.log(`Scheduled cleanup: ${result.cleaned} rooms cleaned`);
    }
    if (result.errors.length > 0) {
      console.warn('Scheduled cleanup errors:', result.errors);
    }
  }, 30 * 60 * 1000); // 30分钟
  
  // 返回清理函数
  return () => {
    clearInterval(interval);
    console.log('Room cleanup scheduler stopped');
  };
}

/**
 * 手动清理过期房间（用于测试或管理）
 */
export async function manualCleanup(): Promise<void> {
  console.log('Starting manual room cleanup...');
  const result = await cleanupExpiredRooms();
  
  if (result.cleaned > 0) {
    console.log(`Manual cleanup completed: ${result.cleaned} rooms cleaned`);
  } else {
    console.log('Manual cleanup completed: no expired rooms found');
  }
  
  if (result.errors.length > 0) {
    console.warn('Manual cleanup errors:', result.errors);
  }
}


