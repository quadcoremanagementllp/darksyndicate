---
name: dark-syndicate-ui
description: Comprehensive design system, cyberpunk aesthetic guidelines, and reusable component patterns for Dark Syndicate Gaming World. Use when designing, building, or modifying UI components, pages, modals, or mobile experiences.
---

# Dark Syndicate UI & Design System Skill

This skill defines the visual identity, Tailwind CSS tokens, component architecture, and interaction guidelines for the **Dark Syndicate Gaming World** platform.

---

## 1. Visual Identity & Design Tokens

### Core Colors & Cyberpunk Palette
- **Backgrounds:**
  - `bg-ds-darker` (`#070a13` / `#0b0f19`): Deep space arena canvas.
  - `bg-ds-dark` (`#0f172a` / `#111827`): Sidebar, surface card base, header background.
  - `bg-ds-surface` (`#1e293b`): Elevated cards, input fields, interactive containers.
  - `bg-ds-surface/60` or `bg-ds-surface/40`: Translucent glass backdrop.

- **Neon Accents & Highlights:**
  - `text-ds-accent` / `bg-ds-accent` (`#06b6d4` / Cyan): Primary action highlights, active tab states, Syndicate branding.
  - `text-ds-ice` (`#38bdf8` / Electric Sky Blue): VIP tier badges, active link text, prominent accents.
  - `text-ds-primary` (`#3b82f6` / Royal Blue): Sign-in CTA buttons, primary solid actions.
  - `text-amber-400` / `border-amber-500` (Gold): Gold Syndicate Pass tier, most-popular badges, featured perks.
  - `text-emerald-400` / `border-emerald-500` (Neon Green): Live system pulses, active session status, success badges.
  - `text-rose-400` / `border-rose-500` (Neon Crimson): Access Denied banners, revocation actions, occupied stations.

- **Typography & Font Classes:**
  - `font-heading`: Tech/gamer headers (`font-black`, `uppercase`, `tracking-wider` or `tracking-tight`).
  - `font-mono`: Timers, price tags, booking references (`DS-WALK-1024`), ticket IDs.
  - `font-body`: Body copy, descriptions, helper hints.

- **Glassmorphism & Glow Utilities:**
  - `glass-strong`: `backdrop-blur-xl bg-ds-dark/90 border border-ds-border shadow-elevated`
  - `shadow-glow`: `box-shadow: 0 0 25px -5px rgba(6, 182, 212, 0.4)`
  - `shadow-glow-sm`: `box-shadow: 0 0 15px -3px rgba(6, 182, 212, 0.25)`

---

## 2. Reusable Component Standards (`src/components/ui/*`)

### Buttons (`<Button>`)
```tsx
import { Button } from '@/components/ui/Button';

// Variants: 'primary' | 'accent' | 'outline' | 'ghost' | 'danger'
// Sizes: 'sm' | 'md' | 'lg'
<Button variant="accent" size="lg" className="font-heading font-bold uppercase">
  <span>Activate Pass</span>
  <ArrowRight className="w-4 h-4 ml-1.5" />
</Button>
```

### Cards (`<Card>`)
```tsx
import { Card } from '@/components/ui/Card';

// Variants: 'default' | 'glass' | 'hover' | 'bordered'
<Card variant="glass" className="p-6 border-ds-accent/30 hover:scale-[1.01] transition-transform">
  {children}
</Card>
```

### Badges (`<Badge>`)
```tsx
import { Badge } from '@/components/ui/Badge';

// Variants: 'default' | 'accent' | 'success' | 'warning' | 'danger'
<Badge variant="accent" size="sm">20% OFF EVERY HOUR</Badge>
```

### Form Inputs (`<Input>`)
Always pair inputs with Lucide icons for high-tech aesthetics:
```tsx
import { Input } from '@/components/ui/Input';
import { Mail, Lock } from 'lucide-react';

<Input
  label="Email Address"
  type="email"
  icon={<Mail className="w-4 h-4" />}
  placeholder="gamer@example.com"
  error={errors.email?.message}
/>
```

### Modals (`<Modal>`)
```tsx
import { Modal } from '@/components/ui/Modal';

<Modal isOpen={isOpen} onClose={onClose} title="Instant Syndicate Pass Activation">
  <div className="space-y-4">{/* Form & Action */}</div>
</Modal>
```

---

## 3. Critical UI & Layout Rules

1. **Mobile Bottom Bar Occlusion Prevention:**
   - The global `MobileBottomBar` (`[SIGN IN] [ZONES] [+ BOOK NOW]`) must **ALWAYS be hidden** on all authentication screens (`/login`, `/register`, `/forgot-password`, `/reset-password`).
   - Verified via `src/components/layout/MobileBottomBar.tsx` (`if (pathname === '/login' || ...) return null;`).

2. **Dual-Tabbed Authentication Cards:**
   - Player login and registration must reside within the same cohesive card with `[Sign In]` and `[Create Account]` switcher buttons.
   - External CTAs can pre-select tabs via query parameters (`?tab=signup` or `?tab=signin`).
   - Target destination must always be preserved via `?redirect=/target` and honored post-registration.

3. **Portal Differentiation:**
   - `portal=player`: Shows tabbed sign-in & register, pass benefits banner.
   - `portal=staff`: Title *"Sign In to Staff Portal"*, hides registration tab.
   - `portal=admin`: Title *"Sign In to Admin Portal"*, hides registration tab.
   - If unauthorized role visits a portal: display dedicated error banner (`?error=access`).

4. **Pass Tier Badging Consistency:**
   - **Silver Tier:** Border slate-500, text slate-300, 10% discount badge.
   - **Gold Tier:** Border amber-500, text amber-300, 20% discount badge, *"MOST POPULAR"*.
   - **VIP Tier:** Border ds-accent / cyan, text ds-ice, 30% discount badge, *"PRO GAMER ELITE"*.
