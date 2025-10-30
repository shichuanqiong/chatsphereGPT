# ChatSphere Rate Limiting - Production Guide

## Overview

This guide documents the production-grade implementation of rate limiting in ChatSphere, supporting:
- **Slow Mode**: Configurable message cooldown per room
- **Anti-Spam**: Auto-detection of rapid messages (3 msgs in 3s → 30s protection)
- **Cross-Tab Consistency**: Via Firebase RTDB for multi-tab/device support
- **Room-Only**: DMs are exempt from all rate limiting

---

## Architecture

### 1. Local State (In-Memory)
- **File**: `src/utils/rateLimiter.ts`
- **Purpose**: Immediate feedback, no RTDB latency
- **Storage**: `Map<UserRoomKey, RateLimitState>`
- **Pros**: Instant response, no network delay
- **Cons**: Only valid for current tab

### 2. Cross-Tab State (RTDB Optional)
- **Path**: `rateLimits/{roomId}/{uid}/lastSent`
- **Purpose**: Prevent multi-tab bypass
- **Updates**: After successful message send
- **Pros**: Global consistency
- **Cons**: Adds network latency (~100-200ms)

### 3. Backend Validation (Optional)
- **Location**: Cloud Functions (future enhancement)
- **Purpose**: Server-side enforcement, final fallback
- **Behavior**: Reject messages from over-limit users

---

## Implementation Details

### Rate Limiter (`src/utils/rateLimiter.ts`)

#### Key Functions

```typescript
// Check if user can send (local state)
checkRateLimit(uid, roomId, slowModeSeconds)
  → { canSend: boolean, reason?: string, remainingSeconds?: number }

// Check cross-tab limit (RTDB read)
checkRateLimitCrossTabs(uid, roomId, slowModeSeconds)
  → Promise<{ canSend: boolean, reason?: string, remainingSeconds?: number }>

// Record message locally
recordMessage(uid, roomId)
  → { triggered: boolean, reason?: string }

// Sync to RTDB
recordMessageCrossTabs(uid, roomId)
  → Promise<void>

// Read settings from localStorage
getSlowModeFromSettings()
  → number (seconds)
```

#### Behavior

**Slow Mode** (e.g., 5 seconds):
```
User sends message at t=0
→ lastMessageTime = 0
→ Next message blocked until t >= 5000ms
→ Message at t=5500 allowed
```

**Spam Detection** (3 messages in 3s → 30s block):
```
t=0: msg 1 (count=1)
t=500: msg 2 (count=2, within 3s window)
t=1000: msg 3 (count=3, SPAM DETECTED)
  → isInSpamMode = true, endTime = t+30000
  → User blocked until t=31000
t=5000: msg attempt → REJECTED (still in spam mode)
t=31500: msg allowed (spam mode expired)
```

### Composer Integration (`src/components/Composer.tsx`)

**Flow**:
```
1. User clicks "Send"
   ↓
2. Check local rate limit (instant)
   ↓
3. Check cross-tab limit (async RTDB)
   ↓
4. Check spam pattern (local)
   ↓
5. Send message
   ↓
6. Record to RTDB (sync cross-tab)
```

**Code**:
```typescript
const sendRecord = async (content: string) => {
  if (target.roomId) {
    const slowModeSeconds = getSlowMode();
    
    // 1) Local check
    const check1 = checkRateLimit(uid, target.roomId, slowModeSeconds);
    if (!check1.canSend) return;
    
    // 2) Cross-tab check (RTDB)
    const check2 = await checkRateLimitCrossTabs(uid, target.roomId, slowModeSeconds);
    if (!check2.canSend) return;
    
    // 3) Spam pattern
    const check3 = recordMessage(uid, target.roomId);
    if (check3.triggered) return;
  }
  
  // Send message...
  await push(dbRef(db, `/messages/${roomId}`), payload);
  
  // 4) Sync to RTDB
  if (target.roomId) {
    await recordMessageCrossTabs(uid, target.roomId);
  }
};
```

---

## Configuration

### Admin Settings (localStorage)

**Key**: `system-settings`  
**Format**:
```json
{
  "slowMode": 5,
  "maxMessageLength": 5000,
  "enableReports": true,
  "savedAt": "2025-10-30T12:00:00Z"
}
```

**Where to Set**:
- Admin Dashboard → Settings tab
- Stored in `localStorage` for persistence
- Applies to all rooms globally

### RTDB Rules (`firebase.rules.json`)

```json
{
  "rules": {
    "rateLimits": {
      "$roomId": {
        "$uid": {
          ".read": "auth != null && auth.uid == $uid",
          ".write": "auth != null && auth.uid == $uid",
          "lastSent": {}
        }
      }
    }
  }
}
```

**Behavior**:
- User can only read/write their own rate limit record
- Each room is isolated (`$roomId`)
- Prevents users from reading others' limits

### Deploy Rules

```bash
firebase deploy --only database
```

---

## Constants

Located in `src/utils/rateLimiter.ts`:

```typescript
const SPAM_WINDOW_MS = 3000;        // 3-second detection window
const SPAM_BURST_COUNT = 3;         // 3 messages = trigger
const BURST_SLOW_MS = 30000;        // 30-second protection
```

**Tuning**:
- `SPAM_WINDOW_MS`: Increase to catch slower spam
- `SPAM_BURST_COUNT`: Decrease to be stricter
- `BURST_SLOW_MS`: Duration of protection

---

## User Experience

### Messages

| Scenario | Message |
|----------|---------|
| Slow mode waiting | `⏱️ Slow mode: wait 3s.` |
| Spam detected | `🚫 Sending too fast! Auto-protection for 30s.` |
| Cross-tab limit | `⏱️ Rate limited (global): wait 2s.` |
| Anti-spam active | `🚫 Anti-spam active. Wait 28s.` |

### Button State

```
Normal: "Send" (enabled)
Waiting: "Wait 5s" (disabled, countdown)
Blocked: "Wait 30s" (disabled, long countdown)
```

---

## Testing

### Local Testing (Single Tab)

```typescript
// In browser console
const { recordMessage, checkRateLimit } = window.__rateLimiter;

// Send 3 messages rapidly
recordMessage("user123", "room456");
recordMessage("user123", "room456");
recordMessage("user123", "room456");

// Check state
checkRateLimit("user123", "room456", 5);
// → { canSend: false, reason: "🚫 Sending too fast!...", remainingSeconds: 30 }
```

### Cross-Tab Testing

1. Open room in Tab A
2. Open same room in Tab B
3. Send message in Tab A → rate limit recorded in RTDB
4. Try to send in Tab B immediately → should be blocked (if using `checkRateLimitCrossTabs`)

### Admin Testing

1. Go to Admin Dashboard → Settings
2. Set "Slow Mode" to 10 seconds
3. Open a room, try to send messages rapidly
4. Should see "Wait 10s" on button

---

## Optional: Backend Validation (Cloud Functions)

For enhanced security, add server-side rate limiting:

```typescript
// functions/src/index.ts
exports.sendMessage = functions.https.onCall(async (data, context) => {
  const userId = context.auth.uid;
  const roomId = data.roomId;
  const now = Date.now();
  
  // Read last sent from Firestore
  const rateDoc = db.collection("rateLimitsSrv").doc(`${roomId}_${userId}`);
  const snap = await rateDoc.get();
  const lastSent = snap.exists ? snap.data()?.lastSent : 0;
  
  // Check limit
  const slowModeSeconds = 5; // Or read from settings
  if (now - lastSent < slowModeSeconds * 1000) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Too many messages, slow down."
    );
  }
  
  // Update record
  await rateDoc.set({ lastSent: now }, { merge: true });
  
  // Process message...
});
```

**Deploy**:
```bash
firebase deploy --only functions
```

---

## Limitations & Trade-offs

| Feature | Limitation | Trade-off |
|---------|-----------|-----------|
| Local rate limit | Current tab only | No RTDB latency |
| Cross-tab check | ~100-200ms RTDB latency | Catches multi-tab abuse |
| Spam detection | Client-side only | Can be bypassed if RTDB fails |
| No whitelist | Admins are rate-limited too | Can add `isAdmin` check |

---

## Future Enhancements

- [ ] Admin/moderator whitelist
- [ ] Per-user rate limit overrides
- [ ] Dynamic rate limits (decrease during off-hours)
- [ ] Rate limit analytics (chart of rate limit events)
- [ ] Exponential backoff (increase limit after N violations)
- [ ] Webhook notifications for abuse
- [ ] Rate limit bypass tokens for special users

---

## Debugging

**Enable Logs**:
```typescript
// In browser console
localStorage.setItem('DEBUG_RATE_LIMIT', '1');
```

**Check RTDB State**:
```bash
firebase database:get /rateLimits/room123/uid456
```

**Clear Local State**:
```typescript
// In browser console
const { clearState } = window.__rateLimiter;
clearState("uid456", "room123");
```

---

## References

- [Firebase RTDB Security Rules](https://firebase.google.com/docs/database/security)
- [Cloud Functions Rate Limiting](https://firebase.google.com/docs/functions/rate-limiting)
- [Real-time vs Eventual Consistency](https://en.wikipedia.org/wiki/Eventual_consistency)
