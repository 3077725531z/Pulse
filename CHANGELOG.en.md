# Pulse Changelog

> [简体中文](./CHANGELOG.md) | **English**

## [0.3.0-beta.4] - 2026-09-08

**Changelog Database Storage + Deployment Docs + Stability Improvements**

### ✨ New Features

#### Changelog Database Storage
- Changelog data moved from hardcoded constants to SQLite `changelogs` table
- Added "Changelog" tab in admin panel with full CRUD support
  - Version, date, title, tags (comma-separated)
  - Multi-section editor: type (Feature/Fix/Style/Perf) + title + items (one per line)
  - Dynamic add/remove sections
- User-side "About → Changelog" now fetches dynamically from `/api/changelogs`
- Added `seed-changelogs.mjs` seed script — `npm run seed:changelogs` writes default version logs

#### Deployment Documentation
- Added detailed deployment guide at the bottom of admin "Deploy" tab
  - Method 1: Build locally then upload backend (recommended)
  - Method 2: Upload frontend source and build on server
  - 5 important notes + 3 common Q&As

### 🐛 Bug Fixes

#### Backend Startup Crash (Root cause of 502)
- Removed static `@ffmpeg-installer/ffmpeg` import in `admin.js` (it throws on module load if binary is missing)
- Wrapped top-level `fs.mkdirSync` in try-catch in `chat.js` / `admin.js` to prevent crashes from directory permission issues

#### Avatar Path
- Changed avatar URL from hardcoded `localhost` to relative path

### 📝 Version Unification
- Added `define: { __APP_VERSION__: pkg.version }` in `vite.config.js`
- Login page, About page, and admin panel now read version from `package.json`
- Future version updates only need to change `package.json`

---

## [0.3.0-beta.3] - 2026-09-08

**Admin Online Deployment + App Download Page + Stability Fixes**

### ✨ New Features

#### Admin "Deploy" Tab
- **Code Package Upload**: Upload `.zip` packages and auto-extract to target directory
  - Target: `backend` / `frontend` / `root`
  - Smart detection of top-level folder inside zip (e.g. `Pulse-main/`)
  - `safeJoinPath` security check prevents path traversal attacks
  - Preserves `.git` / `node_modules` / `uploads` / `.env`
  - Cross-device fallback: `cpSync` when `fs.renameSync` fails
- **App Package Management**: Upload `.apk` / `.ipa` / `.zip` installers
  - Auto-detect platform (Android / iOS / Archive)
  - List, download, delete
  - 1GB size limit
- **Frontend Build**: One-click `npm run build` from admin panel
  - Real-time build logs via SSE (Server-Sent Events)
  - Progress bar reflects Vite build phases (5% → 100%)
  - Cancel support (AbortController + backend kills child process)
- **System Restart**: Safely restart backend service
  - `detached` child process runs `restart.js`
  - Relies on PM2 / BT Panel Node process manager for recovery
- **Automation Options**:
  - Auto-build after frontend upload (enabled by default)
  - Auto-restart after build/upload (optional)
- **Deployment Status**: Shows app version, frontend build time, app count

#### App Download Page
- Public page, no login required
- "App Download" entry added to login page top-right + home title area
- Fetches uploaded package list via public `/api/apps` endpoint
- Grouped by Android / iOS / Other
- Each file card shows platform icon, filename, size, upload date
- Empty state hint + installation guide (Android unknown sources, iOS sideloading, PWA recommendation)

#### In-App Changelog
- Click "Changelog" in About page to view full version history
- Covers 4 versions (0.1.0 ~ 0.3.0) with features, fixes, and style changes
- Category tags (Feature/Fix/Style/Perf) + version badge + date

### 🐛 Bug Fixes

#### Service Startup Crash Causing 502 (Core Fix)
- **Problem**: All requests returned 502 Bad Gateway after server deployment
- **Root cause**: `import ffmpegPath from '@ffmpeg-installer/ffmpeg'` at top of `admin.js` throws during module load
  - The package looks for bundled ffmpeg binary on import and throws `Could not find ffmpeg executable` if missing
  - Import-time exceptions cannot be caught by try-catch, causing the entire backend to fail to start
- **Fix**:
  - Removed static `@ffmpeg-installer/ffmpeg` import
  - Use `which ffmpeg` to find system ffmpeg first (server has `/usr/local/bin/ffmpeg`)
  - Fall back to dynamic `await import('@ffmpeg-installer/ffmpeg')` (failure won't block startup)
  - Wrap `ffmpeg.setFfmpegPath()` in try-catch — missing ffmpeg only disables recording

#### Directory Permission Causing Crash
- **Problem**: PM2 process user has no write permission to project directory on server
- **Root cause**: Top-level `fs.mkdirSync()` in `chat.js` / `admin.js` had no error handling, threw `EACCES` and crashed
- **Fix**: All top-level `fs.mkdirSync` wrapped in try-catch, only logs warning on failure

#### Avatar Hardcoded to localhost
- **Problem**: Avatar URL hardcoded `http://localhost:3000`, failed to load after deployment
- **Fix**: Changed 4 instances to relative path `${avatar}` (AdminPage.jsx, useSocket.js, SettingsSubPages.jsx)

#### Scattered Version Numbers
- **Problem**: Login page showed `0.3.0-beta.3`, About page showed `1.0.0`, package.json was `0.3.0-beta.3`
- **Fix**: Added `define: { __APP_VERSION__: pkg.version }` in `vite.config.js`
  - Login and About pages now use `__APP_VERSION__`
  - Only need to update `package.json` version field going forward

### 📦 Dependencies

#### Added
- `adm-zip` — ZIP extraction for code package deployment

### 🚀 Deployment Optimization

#### Nginx Config
- Reverse proxy `proxy_pass http://127.0.0.1:3000` + WebSocket upgrade headers
- SSE endpoint `/api/admin/deploy/build` disables buffering (`proxy_buffering off`)
- `client_max_body_size 1G` for large file uploads

---

## [0.3.0-beta.2] - 2026-09-07

**Real-time Notifications + Group Chat Enhancements + QR Code Compatibility**

### ✨ New Features

#### Real-time Friend Request Notifications
- Socket.IO targeted push to recipient when friend request is sent
- Real-time notification to requester when request is accepted
- Backend added `notifyUser(userId, event, data)` for targeted notifications
- Contact button in chat nav shows unread request count badge
- Auto-refresh request list + play notification sound on receive
- Added history loading to friend request list

#### Group Chat Enhancements
- Real-time notification to invited members when group is created, joins new Socket.IO room
  - Fixes issue where invited members couldn't receive first group message
  - Frontend `onGroupJoined` action auto-rejoins and refreshes conversation list
- Added `GET /chat/group/:conversationId/members` group member list endpoint
- Conversation list SQL query added `member_count` and `last_sender_name` fields
- Group list items correctly show last sender nickname ("Alice: Hello" format)
- Default group name shows "Group Chat" when empty

### 🐛 Bug Fixes

#### Duplicate Call End Messages
- **Problem**: Call hangup sent 3 call-end messages
- **Cause**: `handleEnd` triggered by 3 sources simultaneously
  1. User A clicks end button
  2. User B receives socket `call:end` event and calls `handleRemoteEnd`
  3. User B WebRTC connection state becomes `disconnected`, triggering `pc.onconnectionstatechange`
- **Fix**: Added `hasEndedRef` guard at start of `handleEnd` to ensure single execution

#### "Send Message" Button Not Working on Contacts Page
- **Problem**: Clicking "Send Message" on contact card had no response
- **Cause**: `App.jsx` rendered `<ContactsPage />` without passing `onSelectUser` callback
  `onSelectUser?.()` optional chain returned undefined, doing nothing
- **Fix**: Correctly pass `onSelectUser` callback in `App.jsx`, find conversation by convId and open chat detail

#### "Send Message" Button Not Working on User Profile Page
- **Problem**: "Send Message" button on user profile page had no response
- **Cause**: `ContactsPage.jsx` rendered `<UserProfilePage>` with only `onBack`,
  but component expects `onClose` and `onStartChat`
- **Fix**: Correctly pass `onClose` and `onStartChat` callbacks

#### QR Code Scanning Not Working in Safari/Firefox
- **Problem**: QR scanning completely non-functional in Safari and Firefox
- **Cause**: Scanning logic only relied on browser native `BarcodeDetector` API
  Only supported in Chrome 83+ and Edge
- **Fix**: Integrated `jsQR` library as `BarcodeDetector` fallback
  - Prefer native `BarcodeDetector` (better performance in Chrome/Edge)
  - Use `jsQR` to parse canvas image when native API unsupported or fails
  - Supports all modern browsers (Chrome, Edge, Safari, Firefox)

#### Reject Friend Request Route State Error
- **Problem**: SQL used `'accepted'` state when rejecting friend request
- **Fix**: Changed `'accepted'` to `'rejected'` in update statement

#### Dark Theme Default After Logout
- **Problem**: Default theme was dark after logout and re-initialization
- **Cause**: `initTheme` function in `authStore.js` defaulted to `'dark'`
- **Fix**: Changed default to `'light'`, ensuring light theme everywhere

### 📦 Dependencies

#### Added
- `jsqr` — Pure JavaScript QR code parser as `BarcodeDetector` fallback
  Supports QR scanning in all modern browsers

---

## [0.2.0-beta.2] - 2026-09-07

**Pulse Beta 2 — Full Site Clean UI Redesign**

### 🎨 UI Style Redesign

#### Global Theme Switch
- Default theme changed from dark to clean light style
- Primary color unified to soft blue `#6c9ce9`
- Background gradient `#f0f4f8` → `#e8ecf4` (consistent with login page)
- Text color `#2d3748` / `#8896ab` / `#b0bac9` three-level hierarchy
- Cards use frosted glass white `rgba(255,255,255,0.85)`
- Input background `#f2f5f9`
- Removed dark mode toggle entry, fixed light theme

#### Page Style Alignment
- **ChatList**: Button text changed to white
- **ChatDetail**: Send button text changed to white
- **ContactsPage**: All buttons (add friend, accept/reject, tab switch) text changed to white
- **SettingsPage**: PulseID edit button text changed to white
- **SettingsSubPages**: Announcement publish, feedback submit buttons text changed to white
- **AdminPage**: Package download, publish announcement, reply feedback buttons text changed to white
- **UserProfilePage**: Send message, add friend buttons text changed to white
- **EditProfilePage**: Save, avatar change buttons text changed to white
- **CallModal**: SVG icon colors changed to white
- **App.jsx**: Bottom nav bar changed to white frosted glass background, error page to light color scheme

#### CAPTCHA Optimization
- Changed from slider puzzle to numeric calculation (random addition/subtraction/multiplication)
- Centered modal popup when clicking "Get Code"
- Auto-send email verification code after passing
- Supports Enter submit, new question, error shake feedback

### 🔧 Technical Optimization
- Rewrote light theme variables in `global.css`, dark theme retained but no longer default
- `authStore.js` default theme changed to `light`
- `index.html` default `data-theme="light"`
- Removed hardcoded `#080808` dark text from all pages, unified to `#fff` white

---

## [0.1.0-beta.1] - 2026-09-06

**Pulse Beta 1**

> Graduation Project — Chat Video Voice Text App

### ✨ New Features

#### User System
- User registration (username, nickname, QQ email, password)
- User login / logout
- Profile editing (avatar, nickname, bio, theme)
- Real-time username availability check
- QQ email verification code for registration
- Real-time password strength detection (weak/medium/strong)

#### Security Verification
- Numeric calculation CAPTCHA (addition/subtraction/multiplication, popup on click)
- Auto-send email verification code after passing
- 60-second send rate limit

#### Instant Messaging
- Private text messaging
- Message read status
- Online status display
- Friend add & management
- User profile view

#### Audio/Video Calls
- Voice calls
- Video calls
- Call modal UI

#### Admin Panel
- Admin overview page
- Database dynamic password (30s refresh + copy)

#### Database Visualization Tool
- Standalone HTML page access
- Password auth login
- Table CRUD
- SQL command line (full statement support)
- Table description management (stored in `_table_meta` table)

### 🏗️ Tech Stack

| Module | Technology |
|--------|------------|
| Frontend | React 18 + Vite + Tailwind CSS + Zustand |
| Backend | Node.js + Express + Socket.IO |
| Database | sql.js (SQLite) |
| Auth | JWT |
| Email | nodemailer (QQ Mail SMTP) |
| Real-time | Socket.IO |

### 🎨 UI Design
- Clean color scheme, primary color soft blue `#6c9ce9`
- Page loading animation (Logo rotation + progress ring)
- Glowing floating background decorations
- Responsive layout, mobile-friendly
