import { manualCleanup, cleanupExpiredRooms } from '../utils/roomCleanup';

// 将清理函数暴露到全局，方便在控制台测试
(window as any).testRoomCleanup = {
  // 手动清理过期房间
  manual: manualCleanup,
  
  // 检查过期房间（不删除）
  check: cleanupExpiredRooms,
  
  // 创建测试过期房间（用于测试）
  createTestExpiredRoom: async () => {
    const { ref, push, set } = await import('firebase/database');
    const { db, auth } = await import('../firebase');
    
    const owner = auth.currentUser?.uid;
    if (!owner) {
      console.error('No authenticated user');
      return;
    }
    
    const roomRef = push(ref(db, 'rooms'));
    const roomId = roomRef.key!;
    
    // 创建一个9小时前创建的房间（已过期）
    const nineHoursAgo = Date.now() - (9 * 60 * 60 * 1000);
    
    await set(roomRef, {
      id: roomId,
      name: 'Test Expired Room',
      visibility: 'public',
      ownerId: owner,
      icon: '🧪',
      createdAt: nineHoursAgo,
      expiresAt: nineHoursAgo + (8 * 60 * 60 * 1000), // 8小时后过期
    });
    
    // 添加房主为成员
    await set(ref(db, `roomMembers/${roomId}/${owner}`), true);
    
    console.log(`Created test expired room: ${roomId}`);
    return roomId;
  },
  
  // 创建测试即将过期房间（用于测试）
  createTestSoonExpiredRoom: async () => {
    const { ref, push, set } = await import('firebase/database');
    const { db, auth } = await import('../firebase');
    
    const owner = auth.currentUser?.uid;
    if (!owner) {
      console.error('No authenticated user');
      return;
    }
    
    const roomRef = push(ref(db, 'rooms'));
    const roomId = roomRef.key!;
    
    // 创建一个7.5小时前创建的房间（即将过期）
    const sevenAndHalfHoursAgo = Date.now() - (7.5 * 60 * 60 * 1000);
    
    await set(roomRef, {
      id: roomId,
      name: 'Test Soon Expired Room',
      visibility: 'public',
      ownerId: owner,
      icon: '⏰',
      createdAt: sevenAndHalfHoursAgo,
      expiresAt: sevenAndHalfHoursAgo + (8 * 60 * 60 * 1000), // 8小时后过期
    });
    
    // 添加房主为成员
    await set(ref(db, `roomMembers/${roomId}/${owner}`), true);
    
    console.log(`Created test soon expired room: ${roomId}`);
    return roomId;
  }
};

console.log('Room cleanup test functions available:');
console.log('- testRoomCleanup.manual() - 手动清理过期房间');
console.log('- testRoomCleanup.check() - 检查过期房间（不删除）');
console.log('- testRoomCleanup.createTestExpiredRoom() - 创建测试过期房间');
console.log('- testRoomCleanup.createTestSoonExpiredRoom() - 创建测试即将过期房间');


