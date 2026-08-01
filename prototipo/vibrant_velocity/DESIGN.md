---
name: Vibrant Velocity
colors:
  surface: '#f9f9fe'
  surface-dim: '#d9dade'
  surface-bright: '#f9f9fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f8'
  surface-container: '#ededf2'
  surface-container-high: '#e8e8ed'
  surface-container-highest: '#e2e2e7'
  on-surface: '#1a1c1f'
  on-surface-variant: '#5c3f46'
  inverse-surface: '#2e3034'
  inverse-on-surface: '#f0f0f5'
  outline: '#906e76'
  outline-variant: '#e5bcc5'
  surface-tint: '#ba005b'
  primary: '#b60059'
  on-primary: '#ffffff'
  primary-container: '#e30071'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb1c4'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfde'
  on-secondary-container: '#636262'
  tertiary: '#006672'
  on-tertiary: '#ffffff'
  tertiary-container: '#008190'
  on-tertiary-container: '#f7feff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e1'
  primary-fixed-dim: '#ffb1c4'
  on-primary-fixed: '#3f001a'
  on-primary-fixed-variant: '#8f0044'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#9cf0ff'
  tertiary-fixed-dim: '#00daf3'
  on-tertiary-fixed: '#001f24'
  on-tertiary-fixed-variant: '#004f58'
  background: '#f9f9fe'
  on-background: '#1a1c1f'
  surface-variant: '#e2e2e7'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  title-md:
    fontFamily: Montserrat
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Montserrat
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Montserrat
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Montserrat
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  stats-number:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  edge-margin: 20px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  touch-target: 48px
---

## Brand & Style

The design system is engineered for a high-energy, high-efficiency motorcycle ride-sharing environment. It targets motorcycle taxi drivers who require immediate legibility and professional reliability while navigating urban landscapes. 

The visual style is **Corporate / Modern** with a lean toward **High-Contrast / Bold** aesthetics to ensure visibility in outdoor settings. The narrative centers on speed, precision, and confidence. By combining a high-energy pink with a structured, systematic layout, the interface evokes an emotional response of "ready-to-act" professionalism. Every element is designed to feel "active"—nothing is static or dull, mirroring the fast-paced nature of the two-wheeled transport industry.

## Colors

The palette is dominated by **Electric Pink (#FF007F)**, used strategically for primary actions and brand presence to maintain high visibility against asphalt and city backgrounds. 

- **Primary:** Electric Pink (#FF007F) for buttons, status indicators, and active states.
- **Secondary:** Deep Onyx (#1A1A1A) for high-contrast text and critical iconography to ensure readability under direct sunlight.
- **Neutral/Surface:** Pure White (#FFFFFF) for primary card surfaces and Soft Grey (#F4F4F9) for background containment to reduce glare.
- **Accent:** A tactical Cyan (#00E5FF) is used sparingly for secondary success states or navigation paths to provide a "tech-forward" contrast to the pink.

## Typography

This design system utilizes **Montserrat** across all levels to project a modern, geometric, and bold personality. 

- **Display & Headlines:** Use Heavy (800) and Bold (700) weights to establish a clear hierarchy. For driver-facing apps, information like "Price" or "Distance" should use the `stats-number` style for instant recognition.
- **Body:** Medium weights are preferred over regular for better legibility on vibrating mobile mounts. 
- **Labels:** Uppercase tracking is applied to small labels to maintain a professional, systematic feel.
- **Mobile Optimization:** Headlines scale down on mobile to prevent awkward line breaks in narrow data fields.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for one-handed operation and quick glances. 

- **Vertical Rhythm:** Based on a 4px baseline grid. 
- **Margins:** A generous 20px edge margin ensures content isn't obscured by phone mounts or rugged cases.
- **Touch Targets:** All interactive elements must adhere to a minimum 48px height to accommodate gloved hands or rapid tapping.
- **Mobile-First:** Information is stacked vertically in cards. On larger devices (tablets), the layout adopts a 12-column grid with a maximum content width of 1024px to maintain focus.

## Elevation & Depth

Depth is conveyed through **Tonal Layers** and **Ambient Shadows** to create a clear distinction between the map (base layer) and the interface (action layer).

- **Surface 0 (Base):** Soft Grey background or Map View.
- **Surface 1 (Cards):** Pure White with a subtle, diffused shadow (10% opacity Deep Onyx, 12px blur, 4px Y-offset). This lifts the data off the map.
- **Surface 2 (Action):** High-contrast Pink elements. These use a slightly "glowing" shadow (Pink tint, 15% opacity) to signify their primary importance.
- **Outlines:** Use 1px "Soft Grey" borders for secondary containers instead of shadows to keep the UI clean and avoid visual clutter.

## Shapes

The shape language is **Rounded**, striking a balance between friendly approachability and modern precision.

- **Standard Components:** Buttons and input fields use a 0.5rem (8px) radius.
- **Cards:** Use `rounded-lg` (1rem / 16px) to create a distinct container feel that looks premium and deliberate.
- **Avatars/Icons:** Status icons and profile pictures use full circles (pill-shaped) to differentiate them from functional UI blocks.

## Components

- **Buttons:** Primary buttons are Solid Pink with White Bold text. Secondary buttons use a Thick Onyx border (2px) with Onyx text. For the "Go Online" toggle, use a high-contrast transition from Grey to Pink.
- **Action Chips:** Small, rounded-pill containers with 14px Semi-bold Montserrat text. Use Pink backgrounds for active filters and White with Grey borders for inactive ones.
- **Cards:** Driver task cards feature a White background, 16px padding, and a 2px left-accent border in Pink to indicate "Active" status.
- **Input Fields:** Large, 56px height fields with 16px internal padding. Labels are always visible above the field (not floating) to ensure the driver never loses context.
- **Lists:** High-density lists with 16px vertical spacing. Each list item should have a chevron or a Pink action icon to indicate interactivity.
- **Status Indicators:** Use the "Pulsing Pink" animation for active GPS tracking or searching for rides to maintain the "Energetic" brand pillar.