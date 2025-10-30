import { ref, get, update } from 'firebase/database';
import { db } from '../firebase';

/**
 * 修复现有房间的创建者信息
 * 从ownerId获取创建者昵称并更新到房间数据中
 */
export async function fixRoomCreatorInfo(): Promise<void> {
  console.log('开始修复房间创建者信息...');
  
  try {
    // 获取所有房间
    const roomsRef = ref(db, 'rooms');
    const roomsSnap = await get(roomsRef);
    
    if (!roomsSnap.exists()) {
      console.log('没有找到房间数据');
      return;
    }
    
    const rooms = roomsSnap.val();
    const updates: Record<string, any> = {};
    let fixedCount = 0;
    
    // 遍历所有房间
    for (const [roomId, roomData] of Object.entries(rooms)) {
      const room = roomData as any;
      
      // 跳过官方房间
      if (room.isOfficial === true) {
        continue;
      }
      
      // 如果房间没有creatorName但有ownerId
      if (!room.creatorName && room.ownerId) {
        try {
          // 获取创建者的profile信息
          const profileRef = ref(db, `profiles/${room.ownerId}`);
          const profileSnap = await get(profileRef);
          
          if (profileSnap.exists()) {
            const profile = profileSnap.val();
            const creatorName = profile.nickname || 'Unknown User';
            
            // 准备更新数据
            updates[`rooms/${roomId}/creatorName`] = creatorName;
            
            // 如果没有格式化时间，也添加一个
            if (!room.createdAtFormatted && room.createdAt) {
              updates[`rooms/${roomId}/createdAtFormatted`] = new Date(room.createdAt).toLocaleString();
            }
            
            fixedCount++;
            console.log(`准备修复房间 ${room.name}: 创建者 ${creatorName}`);
          }
        } catch (error) {
          console.warn(`获取房间 ${roomId} 的创建者信息失败:`, error);
        }
      }
    }
    
    // 批量更新
    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
      console.log(`✅ 成功修复了 ${fixedCount} 个房间的创建者信息`);
    } else {
      console.log('没有需要修复的房间');
    }
    
  } catch (error) {
    console.error('修复房间创建者信息失败:', error);
  }
}

// 暴露到全局，方便在控制台调用
(window as any).fixRoomCreatorInfo = fixRoomCreatorInfo;

console.log('房间创建者信息修复工具已加载');
console.log('在控制台运行: fixRoomCreatorInfo() 来修复现有房间的创建者信息');


