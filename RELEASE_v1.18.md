# TalkiSphere v1.18 - Online Users Fix & Security Hardening

**Release Date:** November 4, 2025  
**Commit:** `73012be` ([GitHub](https://github.com/shichuanqiong/talkisphere/tree/v1.18-online-fix))  
**Git Tag:** `v1.18-online-fix`

---

## ✨ Major Features

### 1. **Fixed Mobile Online Users Showing 0** 🎉
- **Problem:** Desktop showed 2 online users, but mobile (iOS/Android) showed 0
- **Root Cause:** Device time desynchronization caused 5-minute `lastSeen` filter to behave differently on each device
- **Solution:** Implemented Firebase server time synchronization using `.info/serverTimeOffset`
  - New Hook: `useServerTime()` - reads Firebase server time offset and syncs every 10 seconds
  - Updated `useOnlineUsers()` to use Firebase server time instead of local `Date.now()`
  - Unified filtering logic for Desktop and Mobile

**Result:** ✅ All three devices (2x Desktop, 1x iPhone) now show exactly 2 online users

### 2. **Firebase Security Rules Hardening** 🔒
Fixed multiple security vulnerabilities in `firebase.rules.json`:

#### **New/Fixed Rules:**
| Path | Before | After | Risk |
|------|--------|-------|------|
| **Global `.write`** | `auth != null` | `false` | Prevented arbitrary writes |
| **`roles/*`** | ❌ Undefined | ✅ Read-only to self | Users couldn't read other roles |
| **`roomsMeta/*`** | ❌ Undefined | ✅ Private per user | Room metadata exposed |
| **`ads/*`** | ❌ Undefined | ✅ Admin-only write | Spam prevention |
| **`posts/*`** | ❌ Undefined | ✅ User-write, all-read | Content moderation |
| **`directMessages/*`** | Thread-level only | ✅ Message-level validation | Granular access control |
| **`messages/*`** | Room-level only | ✅ Message-level validation | Added `.validate` check |
| **`profiles/*`** | ❌ No UID validation | ✅ Validates `uid === $uid` | Prevent UID manipulation |

#### **Vulnerabilities Fixed:**
1. ✅ Anyone could write to any path (now `.write: false` by default)
2. ✅ `roles` data exposed to all authenticated users (now private per user)
3. ✅ `roomsMeta` unprotected (now user-scoped)
4. ✅ `ads` and `posts` writable by anyone (now admin/author-only)
5. ✅ Message read/write validation improved (now message-level granularity)
6. ✅ DM thread validation improved (requires `participants` field)

---

## 🚀 Technical Details

### New Files
- **`src/hooks/useServerTime.ts`** - Firebase server time synchronization hook

### Modified Files
- **`src/hooks/useOnlineUsers.ts`** - Integrated `useServerTime()` for accurate 5-min filtering
- **`firebase.rules.json`** - Comprehensive security rule updates

### Commits
```
73012be security: fix Firebase rules vulnerabilities - add missing paths and restrict write access
8ccf8b2 fix: Use Firebase server time for 5-min online filter (fixes mobile = 0 issue)
ba9358a debug: add detailed useFilteredOnlineUsers logging
f7ba14f fix: restore lastSeen timeout filter for active users
```

---

## 📊 Testing Results

| Device | Before | After | Status |
|--------|--------|-------|--------|
| Desktop A | ✅ 2 users | ✅ 2 users | ✅ PASS |
| Desktop B | ✅ 2 users | ✅ 2 users | ✅ PASS |
| iPhone Safari | ❌ 0 users | ✅ 2 users | ✅ FIXED |

**Test Scenario:**  
- Desktop A & B logged in  
- iPhone loaded and opened "Online Users" section  
- All three devices display consistent count

---

## 🔐 Firebase Rule Validation

All rules deployed to `chatspheregpt-default-rtdb`:
```
✓ Syntax validation: PASS
✓ Rule deployment: SUCCESS  
✓ No permission errors on client
```

---

## 📝 Breaking Changes

**None** - All changes are backward compatible. Existing data remains accessible.

---

## 🔄 Migration Notes

No migration required. Simply deploy and restart browsers.

---

## ✅ Deployment Checklist

- [x] Code committed to `main` branch
- [x] Git tag created: `v1.18-online-fix`
- [x] Firebase rules deployed
- [x] Local backup created: `chatsphereGPT-v1.18-backup-20251103-175108`
- [x] GitHub Pages hosting updated
- [x] All tests passing

---

## 🚢 How to Deploy

```bash
# Deploy to GitHub Pages
firebase deploy --only hosting

# Deploy rules only
firebase deploy --only database
```

---

## 📌 Known Limitations

None at this time.

---

## 🎯 Next Steps (v1.19)

- [ ] Add `.indexOn` for message queries
- [ ] Implement message delivery receipts
- [ ] Add typing indicators
- [ ] Enhance DM thread management
- [ ] Performance optimization for large chat rooms

---

**Stable Build Status:** ✅ **PRODUCTION READY**
