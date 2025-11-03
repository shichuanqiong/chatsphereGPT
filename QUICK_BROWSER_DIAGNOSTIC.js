/**
 * TalkiSphere Admin Diagnostic Script
 * 复制整个脚本，粘贴到浏览器 DevTools Console 运行
 * 会自动诊断所有问题
 */

async function diagnoseAdmin() {
  console.log('🔍 开始诊断 TalkiSphere Admin...\n');
  
  // 1. 检查 Firebase 连接
  console.log('📡 1. Firebase 连接诊断');
  try {
    const db = window.firebase?.database?.();
    if (!db) throw new Error('Firebase 未初始化');
    
    const presence = await new Promise(resolve => {
      db.ref('/presence').once('value', snap => resolve(snap.val() || {}));
    });
    console.log(`✅ Firebase 连接正常，presence 记录数: ${Object.keys(presence).length}`);
  } catch (e) {
    console.error(`❌ Firebase 连接失败: ${e.message}`);
    return;
  }
  
  // 2. 检查代码版本
  console.log('\n📦 2. 代码版本检查');
  const scripts = Array.from(document.querySelectorAll('script[src*="index"]'));
  if (scripts.length > 0) {
    const scriptSrc = scripts[0].src;
    const hasTimestamp = scriptSrc.includes('?');
    console.log(`最后加载时间: ${new Date().toLocaleString()}`);
    console.log(`script tag: ${scriptSrc.substring(0, 80)}...`);
    if (!hasTimestamp) {
      console.warn('⚠️  Script 没有时间戳，可能是缓存版本');
    }
  }
  
  // 3. 检查网络请求
  console.log('\n🌐 3. 网络请求检查');
  const requests = window.performance?.getEntries?.() || [];
  const adminRequests = requests.filter(r => r.name.includes('/admin'));
  const cloudFunctionRequests = requests.filter(r => r.name.includes('cloudfunctions'));
  const rtdbRequests = requests.filter(r => r.name.includes('firebaseio'));
  
  console.log(`Cloud Functions 请求: ${cloudFunctionRequests.length} 个`);
  if (cloudFunctionRequests.length > 0) {
    console.warn('⚠️  还在使用旧的 Cloud Functions API（应该用 RTDB）');
    cloudFunctionRequests.slice(0, 3).forEach(r => {
      console.log(`  - ${r.name.substring(r.name.length - 60)}`);
    });
  }
  
  console.log(`RTDB 请求: ${rtdbRequests.length} 个`);
  if (rtdbRequests.length > 0) {
    console.log('✅ 正在使用 RTDB（正确）');
  }
  
  // 4. 检查 localStorage
  console.log('\n💾 4. 本地存储检查');
  const storageSize = new Blob(Object.values(localStorage)).size;
  console.log(`localStorage 大小: ${(storageSize / 1024).toFixed(2)} KB`);
  console.log(`存储键数: ${Object.keys(localStorage).length}`);
  
  // 5. 检查当前用户
  console.log('\n👤 5. 当前用户检查');
  const uid = window._uid || window.currentUser?.uid;
  if (!uid) {
    console.warn('⚠️  未获取到 UID（可能未登录）');
  } else {
    console.log(`✅ 当前用户 UID: ${uid.substring(0, 20)}...`);
    
    const db = window.firebase?.database?.();
    const myPresence = await new Promise(resolve => {
      db.ref(`/presence/${uid}`).once('value', snap => resolve(snap.val()));
    });
    console.log(`Presence 状态:`, myPresence);
  }
  
  // 6. 检查数据源
  console.log('\n📊 6. Admin 数据源检查');
  const adminContainer = document.querySelector('[class*="admin"]');
  if (adminContainer?.innerHTML?.includes('useAdminStats')) {
    console.log('✅ Admin 正在使用 useAdminStats（新数据源）');
  }
  if (adminContainer?.innerHTML?.includes('AdminAPI')) {
    console.warn('⚠️  Admin 还在使用 AdminAPI（旧数据源）');
  }
  
  // 7. 性能检查
  console.log('\n⚡ 7. 性能检查');
  const paintEntries = performance?.getEntriesByType?.('paint') || [];
  const paintInfo = paintEntries.map(p => `${p.name}: ${p.startTime.toFixed(0)}ms`);
  if (paintInfo.length > 0) {
    console.log(`首屏加载:`, paintInfo.join(', '));
  }
  
  // 8. 建议
  console.log('\n💡 8. 建议修复步骤');
  console.log('根据诊断结果：');
  if (cloudFunctionRequests.length > 0) {
    console.log('1️⃣  ❌ 还在使用 Cloud Functions API');
    console.log('   解决：');
    console.log('   - 按 Ctrl+Shift+Delete 清除所有缓存');
    console.log('   - 或按 Ctrl+Shift+R 硬刷新');
    console.log('   - 或重启浏览器');
  } else {
    console.log('1️⃣  ✅ 已使用 RTDB API（最新代码）');
  }
  
  if (!uid) {
    console.log('2️⃣  ❌ 未登录或 UID 丢失');
    console.log('   解决：');
    console.log('   - 刷新页面重新登录');
    console.log('   - 或清除 localStorage 重新开始');
  } else {
    console.log('2️⃣  ✅ 用户登录正常');
  }
  
  console.log('\n✨ 诊断完成！');
  console.log('如果问题仍未解决，按照上面的建议操作');
}

// 运行诊断
diagnoseAdmin().catch(e => console.error('诊断出错:', e));
