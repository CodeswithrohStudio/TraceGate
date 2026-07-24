# Style lock - TraceGate

Established: 2026-07-24. Source: starter scaffolding from the Tastemaker technical/builder-facing mood.

## Palette
- Background: #0b1014 (role: app canvas and landing page base)
- Surface: #161b20 (role: panels, sidebar, dense product surfaces)
- Primary: #2676c6 (role: primary actions, active navigation, selected traces)
- Accent: #e97486 (role: incident emphasis, failed-gate highlights, sparse callouts)
- Secondary: #1a2f47 (role: selected rows, quiet status fills, secondary panels)
- Border: #22272c (role: decorative hairlines only unless paired with a legal contrast color)
- Text primary: #e9f3fe - contrast vs background: 17.04 (WCAG AA pass)
- Text muted: #9fb0bf
- Button label color: white - contrast vs Primary: 4.68 (WCAG AA pass)
- Dark mode: single locked dark mode - technical mood is dark-mode-native for this project. No runtime theme toggle in the MVP.

## Color contract

Generated with:

```sh
python3 /Users/rohitpurkait/.codex/skills/tastemaker/scripts/generate_palette.py --mood technical --mode dark
```

Legal pairings from the generated contrast matrix:

- Text-safe (>=4.5): bg/on-primary, surface/on-primary, text/bg, text/surface, border/on-primary, text/border, bg/accent, surface/accent, accent/border, primary/on-primary
- UI-safe (>=3.0 and <4.5): text/primary, bg/primary, surface/primary, primary/border
- Decorative (<3.0): accent/on-primary, text/accent, primary/accent, bg/border, surface/border, text/on-primary, bg/surface

Rules:

- Text on Primary must use white.
- Accent can be used as text on Background or Surface, but not as a solid fill with white text.
- Border is decorative on Background and Surface. State-carrying borders must use Primary or Accent with a verified pairing.
- Re-run the matrix when adding success, warning, or destructive semantic colors.

## Typography
- Display/heading font: Archivo - compact, assertive, builder-facing without becoming terminal cosplay.
- Body font: IBM Plex Sans.
- Data/code font: IBM Plex Mono reserved for traces, YAML, IDs, timestamps, metrics, and CLI snippets.
- Scale: base 16px, dense app body at 13-14px, landing display tier capped by headline word count.
- Letter spacing: 0.

## Shape language
- Corner radius: 4px for dense controls and table rows, 8px for panels, 12px only for the hero proof visual.
- Shadow depth: flat. Use borders, tint shifts, and elevation by contrast rather than soft shadows.
- Border usage: 1px hairlines for app structure, table separation, and proof visual framing.

## Density & spacing
- Base unit: 4px.
- Section padding: space-16 (64px) for landing sections, space-12 (48px) for tighter proof bands.
- Content card internal padding: space-6 (24px).
- Compact/dense card internal padding: space-3 (12px) to space-4 (16px).
- Showcase/hero card internal padding: space-8 (32px).
- Overall density: dense, information-heavy inside the app; calmer and more cinematic on the landing page.
- Section separation: alternating Background and Surface tint with hairline dividers only where they clarify data boundaries.

## Structure
- Macrostructure(s) used: landing - Product Demo / Workbench.
- Shared chrome: landing uses N6 Command bar / shortcut-oriented product nav; app uses persistent sidebar plus contextual topbar.
- Per-page body archetypes: landing uses H2 Split demo, F3 Sticky scroll stack, F5 Annotated capture, F6 Spec sheet, P4 Stat strip with only verified local/demo facts, C2 Statement + action, Ft2 Inline single line.
- Build stamp / log: UI build must add the Tastemaker CSS stamp and `.tastemaker/log.json` entry.

## Navigation chrome
- Sidebar background: Surface. Content area background: Background.
- Topbar: Background with a bottom hairline and compact contextual actions.
- Active nav item treatment: transparent row with 3px Primary left border plus Secondary fill.
- Inactive hover treatment: subtle Secondary fill, never Primary.
- Breadcrumb treatment: muted parent labels, Text primary for current segment.
- Shell density: 36px nav row height, 13px data/table body, 44px minimum touch targets on mobile.

## Mood descriptors
quiet, forensic, technical, decisive

## Assets
- Anchor asset: to be created during UI implementation as a real TraceGate product mockup, not decorative abstraction.
- Asset style: lucide icons, 1.5px stroke, square technical geometry.
- Illustration vs. photography split: code-native product mockups, charts, trace timelines, and real SigNoz-style evidence panels. No stock photography in the MVP.
- Logo: to be created during UI implementation as a geometric gate/trace mark plus Archivo wordmark.

## Motion
- Feel: quick and restrained.
- Entrance duration/distance: 180-240ms, 8-12px rise.
- Easing: cubic-bezier(0.16, 1, 0.3, 1).
- App shell: tab/panel transitions and skeleton loading only. No scroll storytelling inside the app.

## Do not
- Do not use purple/blue gradients, gradient text, rounded-full buttons, fake browser chrome, emoji icons, invented metrics, or generic 3-card feature grids.
- Do not set paragraphs in mono.
- Do not make the main app feel like a landing page; it is a dense release workbench.
