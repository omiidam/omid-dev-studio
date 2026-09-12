# Phase 10 — Analytics, Conversion Tracking & RTL Number Placement Fix + Release Update

## Current State
- **Current version**: 1.0.3
- **New version**: 1.0.4
- **Analytics**: None exists — by design (CSP blocks all external origins)
- **RTL Issue**: In `src/components/sections/Philosophy.tsx`, the `flex items-baseline justify-between` layout pushes numbers to the opposite side of their labels, making them appear detached
- **Update Box**: Exists in `src/components/pwa/ServiceWorkerRegistration.tsx`, reads from `src/config/release.ts`

---

## Implementation Steps

### Step 1: Create Analytics Module
**New file**: `src/lib/analytics.ts`
- Lightweight, privacy-conscious, client-only analytics abstraction
- Event types: `page_view`, `cta_click`, `service_view`, `service_cta_click`, `portfolio_view`, `portfolio_item_click`, `form_start`, `form_submit`, `form_error`, `contact_link_click`, `mobile_nav_toggle`
- Deduplication via `Map<string, number>` with configurable TTL (5s default)
- Queue-based sending with `navigator.sendBeacon` → `fetch` fallback
- Flush on `visibilitychange:hidden` for reliable delivery
- `analyticsInit()` for page view tracking on route changes (called once)

### Step 2: Create Analytics API Route
**New file**: `src/app/api/analytics/route.ts`
- POST endpoint that validates incoming analytics payloads
- Server-side rate limiting (reuse existing `rate-limit.ts`)
- Logs events server-side with structured format `[analytics] eventName: payload`
- Never logs PII — only event name, path, and metadata
- Returns 202 Accepted (fire-and-forget from client)
- Respects existing CSP (all same-origin)

### Step 3: Add Conversion Tracking
**Modify**: `src/components/sections/Hero.tsx`
- Track CTA clicks ("شروع پروژه" → `cta_click` with CTA: "hero_primary")
- Track portfolio CTA click ("مشاهده پروژه‌ها" → `cta_click` with CTA: "hero_secondary")

**Modify**: `src/components/sections/Services.tsx`
- Track service section view (once via IntersectionObserver)
- Track service CTA click ("بگویید چه می‌سازید" → `service_cta_click`)

**Modify**: `src/components/sections/SelectedWork.tsx`
- Track portfolio section view (once)
- Track "همه‌ی پروژه‌ها" button click

**Modify**: `src/components/contact/ContactForm.tsx`
- Track form start (on first input interaction, once)
- Track successful submission (`form_submit`)
- Track failed submission (`form_error`)

**Modify**: `src/components/sections/Contact.tsx`
- Track email link click (`contact_link_click` with type: "email")
- Track social link clicks (`contact_link_click` with type: "social")

**Modify**: `src/components/layout/Navigation.tsx`
- Track mobile nav toggle (`mobile_nav_toggle` with state: "open"/"close")
- Track nav link clicks (`cta_click` with CTA: "nav_desktop"/"nav_mobile")

**Modify**: `src/app/layout.tsx`
- Initialize analytics on route changes (page_view tracking)

### Step 4: Fix RTL Number Placement
**Modify**: `src/components/sections/Philosophy.tsx`

**Root cause**: The `flex items-baseline justify-between` on the number/label container pushes the number (`span`) to the end and the label (`h3`) to the start. In RTL, this puts them on opposite visual edges of the card, making the number appear detached from its corresponding label.

**Fix**: Replace the flex container structure:
```tsx
// Before (problematic):
<div className="flex items-baseline justify-between">
  <h3>{belief.label}</h3>
  <span>{belief.index}</span>
</div>

// After (fixed):
<div className="flex items-baseline gap-3">
  <span>{belief.index}</span>
  <h3>{belief.label}</h3>
</div>
```

This places the number immediately before its label (right side in RTL), with a consistent gap. Both elements are aligned on their baselines.

### Step 5: Version Bump
**Modify**: `src/config/version.ts` — `APP_VERSION = "1.0.4"`
**Modify**: `package.json` — `"version": "1.0.4"`
**Modify**: `public/sw.js` — `APP_VERSION = "1.0.4"` (auto-synced by build script, but update directly for this release)

### Step 6: Update Release Metadata
**Modify**: `src/config/release.ts`
- `previousVersion: "1.0.3"`
- `version: APP_VERSION` (1.0.4)
- Changes (from actual implementation):
  - `new`: "سامانه‌ی تحلیل سبک و خصوصی‌پسند برای درک رفتار کاربران"
  - `new`: "پیگیری تبدیل مسیر کسب پروژه از فرود تا ثبت درخواست"
  - `improvement`: "جلوگیری از رویدادهای تکراری در تحلیل"
  - `improvement`: "بهبود مدیریت خطا در سمت سرور"
  - `fix`: "اصلاح موقعیت شماره‌ها در بخش «طراحی-مهندسی-کسب‌وکار»"

### Step 7: Verify & Build
- Run `npm run lint`
- Run `npm run build`
- Verify production build succeeds
