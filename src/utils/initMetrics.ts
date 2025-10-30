/**
 * Initialize metrics/runtime document in Firestore
 * Run once to set up initial data
 */

import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function initializeMetricsDocument() {
  try {
    const db = getFirestore();
    
    // Create 24-hour buckets
    const buckets = Array.from({ length: 24 }, (_, i) => ({
      h: i,
      c: 0,
    }));

    // Sample top rooms
    const topRooms = [
      { name: 'General Chat', count: 0 },
      { name: 'Photography', count: 0 },
      { name: 'Technology', count: 0 },
    ];

    // Create metrics document
    await setDoc(doc(db, 'metrics', 'runtime'), {
      onlineNow: 0,
      msg24h: 0,
      dau: 0,
      buckets,
      topRooms,
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Metrics document initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize metrics:', error);
    return false;
  }
}

