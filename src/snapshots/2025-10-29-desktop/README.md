Desktop layout snapshot (2025-10-29)

Files in this folder are exact copies of the current stable desktop UI.

Included files:
- Home.tsx
- components/Header.tsx
- components/Composer.tsx
- components/MessageList.tsx

How to restore
1) Overwrite the live files with these snapshots:
   - Copy `src/snapshots/2025-10-29-desktop/Home.tsx`            -> `src/pages/Home.tsx`
   - Copy `src/snapshots/2025-10-29-desktop/components/Header.tsx`   -> `src/components/Header.tsx`
   - Copy `src/snapshots/2025-10-29-desktop/components/Composer.tsx` -> `src/components/Composer.tsx`
   - Copy `src/snapshots/2025-10-29-desktop/components/MessageList.tsx` -> `src/components/MessageList.tsx`

You can keep multiple dated snapshots under `src/snapshots/` while iterating on mobile.


