# TalkiSphere v1.20 - Room-Level Block Restoration

**Release Date:** November 3, 2025  
**Git Tag:** `v1.20-block-restored`  
**Commit:** 415d6d2

## Overview

Successfully restored the **room-level block functionality** in the message bubble interface. Users can now hover over messages in chat rooms and block/unblock other users within that specific room.

## What Was Fixed

### 1. Firebase Rules - Missing `userBlocks` Path

**Problem:** The Firebase Realtime Database rules did not include definitions for the `userBlocks` path, causing all write attempts to be rejected with `PERMISSION_DENIED` errors.

**Root Cause:** The rules file had a global `.write: false` default, and since `userBlocks` path was not explicitly defined, it inherited this restrictive default.

**Solution:** Added comprehensive Firebase rules for the `userBlocks` path with support for:
- Global blocking: `userBlocks/{uid}/global/{peerUid}`
- Room-level blocking: `userBlocks/{uid}/rooms/{roomId}/{peerUid}`

### 2. Firebase Rules Changes

```json
"userBlocks": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid",
    "global": {
      ".read": "auth != null && auth.uid === $uid",
      ".write": "auth != null && auth.uid === $uid",
      "$peerUid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "rooms": {
      "$roomId": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        "$peerUid": {
          ".read": "auth != null && auth.uid === $uid",
          ".write": "auth != null && auth.uid === $uid"
        }
      }
    }
  }
}
```

## Features Restored

✅ **Room-Level Block Button**
- Hover over message bubbles in chat rooms to reveal Block/Unblock button
- Click to block/unblock users within that specific room
- Button shows current block status (Block / Unblock)
- Blocked users' messages are hidden in that room only
- Other rooms unaffected by room-level blocks

✅ **Data Storage**
- Block status stored in `userBlocks/{myUid}/rooms/{roomId}/{peerUid}`
- Separate from global blocks
- Scoped to individual rooms

✅ **User Experience**
- Smooth hover effect with button visibility
- Clear feedback with toast notifications
- Block status persists across sessions

## Technical Details

### Code Components

**Frontend Implementation:**
- `src/pages/Home.tsx` - Message bubble rendering with Block button (lines 1420-1432)
- `src/hooks/useRoomBlocks.ts` - Hook for managing room-level block state
- Button appears on hover for non-own messages

**Backend:**
- Firebase Realtime Database path: `userBlocks/{uid}/rooms/{roomId}/{peerUid}`
- Rules enforce that users can only manage their own blocks
- Server-side validation via Firebase security rules

## Testing Status

✅ **Tested Features:**
- Block button visibility on message hover
- Block/Unblock toggle functionality
- Toast notifications on action
- Blocked users' messages filtered correctly
- Room isolation (blocks don't affect other rooms)
- Firebase permission rules working correctly

## Breaking Changes

None. This is purely a restoration of existing functionality.

## Files Modified

1. `firebase.rules.json` - Added `userBlocks` path definitions
2. Git commits:
   - `158a352`: Initial nested paths fix for blocks/mutes/friends
   - `415d6d2`: Add userBlocks path rules for room-level block functionality

## Deployment Info

- **Firebase Rules Status:** ✅ Deployed successfully
- **Database:** `chatspheregpt-default-rtdb` (Firebase Realtime Database)
- **Project:** `chatspheregpt`
- **Deployment Date:** November 3, 2025 19:21 UTC

## Previous Related Work

This release builds on previous v1.19 work where core moderation features (DM, invites, kick, ban) were restored and tested.

## Next Steps

The application is now fully functional with all core features operational:
- ✅ Online user list (mobile & desktop)
- ✅ Direct messaging with inbox notifications
- ✅ Room management (invites, kicks, bans)
- ✅ Room-level user blocking
- ✅ Global user blocking (infrastructure ready)
- ✅ Message statistics (admin dashboard)

All major features are production-ready.
