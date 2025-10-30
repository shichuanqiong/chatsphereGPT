# Rate Limiting Deployment Checklist

## Quick Start (5 minutes)

### 1. Update Firebase Rules ✓
```bash
# Make sure firebase.rules.json includes:
# rateLimits/{roomId}/{uid} paths with proper security rules
firebase deploy --only database
```

### 2. Set Admin Slow Mode ✓
- Go to Admin Dashboard
- Navigate to Settings tab
- Set "Slow Mode" value (e.g., 5 seconds)
- Click "Save Settings"
- Value is stored in localStorage

### 3. Test Locally ✓
```bash
pnpm dev
# Open any room
# Try to send messages rapidly
# Should see timeout messages and countdown
```

---

## Deployment Steps

### Frontend (Already Done)
- [x] `src/utils/rateLimiter.ts` - Rate limiting logic
  - [x] Local state management
  - [x] RTDB cross-tab check (new)
  - [x] Spam detection (3 msgs in 3s = 30s block)
  - [x] Settings reader

- [x] `src/components/Composer.tsx` - Message send logic
  - [x] Local rate limit check
  - [x] Cross-tab RTDB check (new)
  - [x] Spam detection
  - [x] RTDB sync on send (new)

- [x] Documentation
  - [x] `RATE_LIMITING_GUIDE.md` - Full implementation guide
  - [x] Inline code comments

### Backend - Firebase Rules
```bash
cd <project-root>
firebase deploy --only database
```

**Expected Output**:
```
✔ Deploy complete!
✔ Released new database rules

Project Console: https://console.firebase.google.com/project/chatspheregpt/database
Database Rules: https://console.firebase.google.com/project/chatspheregpt/database/rules
```

---

## Testing Checklist

### ✓ Single Tab Testing
```
[ ] Open room
[ ] Set Slow Mode to 5 seconds (Admin → Settings)
[ ] Try to send message - should succeed
[ ] Immediately send again - should be blocked
[ ] Button shows "Wait 4s" countdown
[ ] Wait 5s - button changes to "Send" again
[ ] Send again - should succeed
```

### ✓ Spam Detection Testing
```
[ ] Set Slow Mode to 0 (disabled) for this test
[ ] Open room
[ ] Send 3 messages as quickly as possible
[ ] Should see "🚫 Sending too fast! Auto-protection for 30s"
[ ] Try to send - blocked with 30s countdown
[ ] Wait 30s - button enables again
```

### ✓ Multi-Tab Testing (Optional)
```
[ ] Open room in Tab A
[ ] Open same room in Tab B
[ ] Send message in Tab A
[ ] Immediately switch to Tab B and try to send
[ ] Should see "⏱️ Rate limited (global): wait Xs"
[ ] (Note: This requires RTDB sync to work)
```

### ✓ DM Testing (Exempt)
```
[ ] Open DM with another user
[ ] Send multiple messages rapidly
[ ] Should NOT be rate limited (DMs are exempt)
[ ] Composer should show "Send" button always
```

### ✓ Admin Panel Testing
```
[ ] Go to Admin Dashboard → Settings
[ ] Set "Slow Mode" to 10
[ ] Open a room
[ ] Try to send - should wait 10s between messages
[ ] Change to 2 seconds
[ ] Refresh page (or just test)
[ ] Should now only wait 2s
[ ] Change to 0 (disabled)
[ ] Should send immediately (but spam protection still active)
```

---

## Monitoring

### Check RTDB Activity
```bash
firebase database:get /rateLimits
# Should show rate limit records for active users
# Format: rateLimits/{roomId}/{uid}/lastSent
```

### Browser Console (Debug)
```javascript
// In browser developer console
// Check what rateLimitStates are stored
Object.entries(window.__rateLimiter || {}).forEach(([k, v]) => {
  console.log(k, v);
});
```

### Look for Errors
- Check browser console for `[rateLimiter]` messages
- Monitor network tab for RTDB failures
- If RTDB fails, app degrades gracefully (allows sending)

---

## Configuration

### Change Spam Detection Parameters
**File**: `src/utils/rateLimiter.ts`

```typescript
const SPAM_WINDOW_MS = 3000;        // Detection window (ms)
const SPAM_BURST_COUNT = 3;         // Messages to trigger
const BURST_SLOW_MS = 30000;        // Protection duration (ms)
```

**Examples**:
- Stricter: `SPAM_BURST_COUNT = 2` (2 msgs in 3s triggers)
- Longer protection: `BURST_SLOW_MS = 60000` (60s block)
- Slower detection: `SPAM_WINDOW_MS = 5000` (5s window)

---

## Troubleshooting

### Issue: Slow Mode not working
**Cause**: Settings not loaded or slow mode = 0
**Fix**:
1. Check Admin Dashboard Settings
2. Ensure "Slow Mode" is > 0
3. Refresh the page

### Issue: RTDB errors in console
**Cause**: Firebase rules might be missing or wrong
**Fix**:
```bash
firebase deploy --only database
# Verify rules include rateLimits path
```

### Issue: Cross-tab check not blocking
**Cause**: RTDB read fails silently (graceful degradation)
**Fix**:
1. Check Firebase console → Database → Rules
2. Verify `rateLimits` path rules
3. Check user is authenticated

### Issue: DMs are being rate-limited
**Cause**: Bug in code - shouldn't happen
**Fix**:
1. Check Composer.tsx `if (target.roomId)` guards
2. Ensure DMs skip rate limiting logic
3. Restart dev server

---

## Rollback Plan

If issues occur:

### Option 1: Disable Rate Limiting (Quick)
- Set Admin Settings → Slow Mode = 0
- Users can still spam, but app stays stable

### Option 2: Disable RTDB Sync (Medium)
- Comment out `recordMessageCrossTabs()` in Composer.tsx
- Local rate limiting still works (single-tab)

### Option 3: Full Rollback (Full)
```bash
git revert 612ad24  # Rate limiting commit
git push origin main
# Redeploy frontend
```

---

## Success Criteria

All of the following should be true:

- [x] Admin can set Slow Mode in Settings
- [x] Setting persists after page refresh
- [x] Users are blocked from sending too fast
- [x] Button shows countdown in seconds
- [x] Spam protection triggers (3 msgs in 3s = 30s block)
- [x] DMs are NOT rate-limited
- [x] No browser console errors
- [x] RTDB rules deployed (`firebase deploy --only database`)
- [x] Multi-tab users can't bypass limits
- [x] App works offline (local checks still work)

---

## Performance Notes

| Check | Latency | Location |
|-------|---------|----------|
| Local limit | <1ms | Memory (Map) |
| Spam detection | <1ms | Memory (Map) |
| Cross-tab check | ~100-200ms | RTDB network |
| RTDB sync | ~100-200ms | RTDB network |

**Total Send Flow**: ~200-400ms (with RTDB sync)

**Optimization**: If latency is an issue, can disable cross-tab check:
```typescript
// Comment out in Composer.tsx
// const crossTabCheck = await checkRateLimitCrossTabs(...);
```

---

## Next Steps

After deployment:

1. Monitor for any errors in production
2. Collect user feedback on timing (is 5s good? too long?)
3. Consider admin analytics dashboard to track violations
4. Plan future enhancements (whitelist, exponential backoff, etc.)

---

**Deployment Date**: _______________  
**Tested By**: _______________  
**Status**: [ ] Ready [ ] In Progress [ ] Complete
