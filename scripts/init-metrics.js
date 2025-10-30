/**
 * Initialize metrics/runtime document in Firestore
 * Run: node scripts/init-metrics.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../.env.json'); // You need to download this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'chatspheregpt',
});

const db = admin.firestore();

const metricsData = {
  onlineNow: 0,
  msg24h: 0,
  dau: 0,
  buckets: Array.from({ length: 24 }, (_, i) => ({
    h: i,
    c: 0,
  })),
  topRooms: [
    { name: 'General Chat', count: 0 },
    { name: 'Photography', count: 0 },
  ],
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

async function initMetrics() {
  try {
    await db.collection('metrics').doc('runtime').set(metricsData);
    console.log('✅ metrics/runtime document created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create metrics/runtime:', error);
    process.exit(1);
  }
}

initMetrics();

