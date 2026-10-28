# StreakFire

A daily planner and habit tracker for routines, one-off tasks, todos, notes and focus sessions.
Streaks keep you consistent, and it works on phone, tablet and desktop.
Built with **React 19 + TypeScript**, backed by **Firebase** (free plan), and installable as an app.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite 8** (Rolldown) | Instant dev server, fast production builds |
| UI | **React 19** + **TypeScript 7** | Typed components, strict compiler settings |
| Styling | **Tailwind CSS v4** + design tokens | CSS-first config; light and dark themes from one token set |
| State | **Zustand 5** | Tiny global stores: app data, UI, focus timer, theme |
| Routing | **React Router 8** (hash routing) | Works on any static host |
| Animation | **Motion** (`motion/react`) | Page transitions, list reordering, progress animations |
| Dialogs | **Radix UI Dialog** | Accessible: focus trap, Escape to close, screen-reader labels |
| Command palette | **cmdk** | `Ctrl/⌘ K` search and commands |
| Toasts | **Sonner** | Notifications with an Undo action |
| Charts | **Recharts 3** | Insights charts, loaded only on that page |
| Icons | **lucide-react** | |
| Dates | Small typed helpers (`src/lib/dates.ts`), **date-fns** available | |
| Backend | **Firebase 13** modular SDK: Auth (Google + email), Cloud Firestore (offline cache) | Free Spark plan; loaded only when configured. Hosted on Vercel |
| PWA | **vite-plugin-pwa** (Workbox) | Install to home screen, works offline |
| Tests | **Vitest** | Streak rules, routine scheduling and the quick-add parser |
| Lint | **oxlint** | |

## Features
- **5 colour themes** (Indigo, Emerald, Ocean, Sunset, Rose), each with System, Light or Dark mode. Pick one in Settings or with `Ctrl/⌘ K`.
- **Today:** a progress ring, a week strip, a timeline with a live "Now" line, an "Up next" card, due and overdue todos, focus shortcuts.
- **Quick add in plain English:** `Standup 10am weekdays`, `Client call 3pm tomorrow !high`, `Gym 7am every mon wed fri`.
- **Repeating tasks:** every day, weekdays, or custom days. Edit a routine any time. Stopping a routine keeps its history.
- **Task editor:** one-time or repeating, time, priority, a checklist of steps, notes. Ticking every step completes the task.
- **Plan:** a month calendar and a week planner.
- **Rest days:** mark a day off and it never breaks your streak.
- **Streak rule:** a day counts at 100%, 80% or 60% done. Days with no tasks are skipped.
- **Carry-over and wrap-up:** move yesterday's unfinished tasks to today. At the end of the day, review it, move what's left to tomorrow, and save a note.
- **Focus timer:** 15–60 minute sessions linked to a task. It survives a reload and shows the time in the browser tab.
- **Todos:** grouped by overdue, today, upcoming and someday.
- **Notes:** categories, colours, pinning, search.
- **Insights:** a 6-month heatmap, charts, best weekday, levels, XP and 12 badges.
- **Reminders:** browser notifications at each task's time.
- **Other:** undo on every delete, backup and restore, keyboard shortcuts.

**Shortcuts:**
- `Ctrl/⌘ K` search
- `N` task
- `T` todo
- `J` note
- `F` focus
- `W` wrap up
- `1–5` pages
- `?` help

## Project structure
```
src/
  main.tsx               app entry; starts Firebase sync only if configured
  App.tsx                routes, global dialogs, palette, focus widget, toasts
  index.css              Tailwind v4 + design tokens + component classes
  pages/                 Today, Plan, Todos, Notes, Insights
  components/            Layout (sidebar/top bar/tab bar), TaskRow, Composer, Sheet (Radix dialog),
                         CommandPalette (cmdk), FocusWidget, Gate (sign-in), ui primitives
  components/dialogs/    TaskEditor, Day, Todo, Note, Settings, Wrap-up, Quick add, Shortcuts
  store/                 Zustand stores: app data, UI, focus timer, theme
  hooks/useGlobal.ts     keyboard shortcuts, reminders
  lib/                   types, dates, domain rules (streaks, XP, badges), quick-add parser,
                         seed data, Firebase sync (cloud.ts), notifications, confetti
  lib/logic.test.ts      unit tests
firestore.rules          each signed-in user can read/write only their own data
vercel.json              Vercel build + cache headers
firebase.json            hosting (dist/) + rules
```

## Run it
```bash
npm install
npm run dev        # http://localhost:5173  (local mode, example data)
npm test           # unit tests
npm run build      # production build in dist/
```
Requires Node 20.19+ or 22.12+.

## Accounts and saving (Firebase, free)
Without Firebase keys the app runs in **local mode**: data stays in that one browser only.
With keys, everyone gets their own account (**Google** or **email + password**) and their data is saved in Firestore, so it follows them to every device.
Each user can only read and write their own data (`users/{uid}`, see `firestore.rules`).

### 1. Set up Firebase (one time)
1. **Create a project** at https://console.firebase.google.com (Analytics not needed).
2. **Turn on sign-in:** **Build > Authentication > Get started > Sign-in method**, enable **Google** and **Email/Password**.
3. **Create the database:** **Build > Firestore Database > Create database**, production mode, location `asia-south1` (Mumbai).
4. **Publish the rules:** in **Firestore Database > Rules**, paste the contents of `firestore.rules` and click **Publish**.
5. **Get your keys:** **Project settings (gear) > Your apps > Web `</>`**, register an app, and copy the `firebaseConfig` values.

### 2. Run locally with accounts
Copy `.env.example` to `.env.local`, paste in the six values, then `npm run dev`.

### 3. Deploy to Vercel
1. Push this folder to a GitHub repo, then on https://vercel.com click **Add New > Project** and import it.
   If the repo holds other apps too, set **Root Directory** to `streakfire-react`.
   Framework, build command and output folder come from `vercel.json`.
2. Under **Environment Variables**, add the six keys from `.env.example` with your values:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
3. Click **Deploy**. (If you add or change variables later, redeploy: they are baked in at build time.)
4. **Allow your Vercel domain to sign in:** in Firebase, **Authentication > Settings > Authorized domains > Add domain**, add `your-app.vercel.app` (and any custom domain).
   Without this, Google sign-in fails with `auth/unauthorized-domain`.
5. Open the site, create an account, and you're set. On a phone use **Add to Home Screen**.

Or from the terminal: `npm i -g vercel`, then `vercel` in this folder (add the env vars when prompted or in the dashboard), then `vercel --prod`.

**Hosting on Firebase instead** still works: put your project ID in `.firebaserc`, then `npm run deploy`.

**Moving from earlier versions.** If you used the app in local mode, the first time you sign in on that browser your local data is copied into your new account.

### Test against the Firebase emulators (optional)
```bash
firebase emulators:start --only auth,firestore --project demo-streakfire
VITE_FIREBASE_API_KEY=demo VITE_FIREBASE_PROJECT_ID=demo-streakfire VITE_USE_EMULATOR=1 npm run dev
```

## Free plan limits (Spark, no credit card)
- **Firestore:** 1 GiB stored, 50,000 reads and 20,000 writes per day.
- **Auth:** free for email and Google sign-in.
- **Vercel Hobby:** free for personal projects.

## Known limits
- **Reminders need the app running.** They fire while the app is open or installed and running. Push notifications when it's fully closed need Cloud Functions, which is on the pay-as-you-go Blaze plan.
- **All data is one Firestore document.** If two devices edit while both are offline, the last one to sync wins.
