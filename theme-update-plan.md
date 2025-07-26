# Prometheus Theme Update Plan

## Overview
This document outlines the changes needed to update the application's light and dark mode settings based on the Prometheus branding guide.

## Current Theme Structure
The current theme is defined in `src/renderer/src/assets/styles/color.scss` with separate sections for:
1. Default dark theme (root)
2. Light theme overrides ([theme-mode='light'])
3. Navbar position overrides

## Prometheus Brand Colors (from branding guide)
| Color Name | Hex Value | Usage |
|------------|-----------|-------|
| Navy | #0A192D | Primary brand color |
| Yellow | #FFDD00 | Secondary color |
| Orange | #FF5500 | Accent, used in gradient |
| Red | #FF4D4D | Error states, used in gradient |
| Turquoise | #00A3A3 | Tertiary accent color |
| Light Blue | #4D9FFF | Primary color in dark mode |
| Ultra Light Gray | #F8F8F8 | Background in light mode |
| Light Gray | #F5F5F5 | Card background in light mode |
| Medium Gray | #CCCCCC | Borders, inputs in light mode |
| Dark Gray | #333333 | Text color, borders in dark mode |
| Light Navy | #0F2440 | Navy variant in dark mode |

## Proposed Changes

### 1. Update Root (Dark Theme) Variables
Replace existing color variables with Prometheus colors while maintaining the same variable names for compatibility:

```scss
:root {
  --color-white: #ffffff;
  --color-white-soft: rgba(255, 255, 255, 0.8);
  --color-white-mute: rgba(255, 255, 255, 0.94);

  --color-black: #0A192D; /* Prometheus Navy */
  --color-black-soft: #0F2440; /* Prometheus Light Navy */
  --color-black-mute: #333333; /* Prometheus Dark Gray */

  --color-gray-1: #4D9FFF; /* Prometheus Light Blue */
  --color-gray-2: #00A3A3; /* Prometheus Turquoise */
  --color-gray-3: #CCCCCC; /* Prometheus Medium Gray */

  --color-text-1: rgba(255, 255, 245, 0.9);
  --color-text-2: rgba(235, 235, 245, 0.6);
  --color-text-3: rgba(235, 235, 245, 0.38);

  --color-background: var(--color-black);
  --color-background-soft: var(--color-black-soft);
  --color-background-mute: var(--color-black-mute);
  --color-background-opacity: rgba(10, 25, 45, 0.7); /* Navy with opacity */
  --inner-glow-opacity: 0.3;

  --color-primary: #FFDD00; /* Prometheus Yellow */
  --color-primary-soft: #FFDD0099; /* Yellow with opacity */
  --color-primary-mute: #FFDD0033; /* Yellow with more opacity */

  --color-text: var(--color-text-1);
  --color-text-secondary: rgba(235, 235, 245, 0.7);
  --color-icon: #ffffff99;
  --color-icon-white: #ffffff;
  --color-border: #ffffff19;
  --color-border-soft: #ffffff10;
  --color-border-mute: #ffffff05;
  --color-error: #FF4D4D; /* Prometheus Red */
  --color-link: #4D9FFF; /* Prometheus Light Blue */
  --color-code-background: #0F2440; /* Prometheus Light Navy */
  --color-hover: rgba(15, 36, 64, 1); /* Light Navy */
  --color-active: rgba(10, 25, 45, 1); /* Navy */
  --color-frame-border: #333333; /* Prometheus Dark Gray */
  --color-group-background: var(--color-background-soft);

  --color-reference: #0F2440; /* Prometheus Light Navy */
  --color-reference-text: #ffffff;
  --color-reference-background: #0A192D; /* Prometheus Navy */

  --color-list-item: rgba(255, 255, 255, 0.1);
  --color-list-item-hover: rgba(255, 255, 255, 0.05);

  --modal-background: #0A192D; /* Prometheus Navy */

  --color-highlight: rgba(0, 0, 0, 1);
  --color-background-highlight: rgba(255, 221, 0, 0.9); /* Yellow */
  --color-background-highlight-accent: rgba(255, 85, 0, 0.9); /* Orange */

  --navbar-background-mac: rgba(10, 25, 45, 0.55); /* Navy with opacity */
  --navbar-background: #0A192D; /* Prometheus Navy */

  --navbar-height: 44px;
  --sidebar-width: 50px;
  --status-bar-height: 40px;
  --input-bar-height: 100px;

  --assistants-width: 275px;
  --topic-list-width: 275px;
  --settings-width: 250px;
  --scrollbar-width: 5px;

  --chat-background: transparent;
  --chat-background-user: rgba(255, 255, 255, 0.08);
  --chat-background-assistant: transparent;
  --chat-text-user: var(--color-black);

  --list-item-border-radius: 10px;

  --color-status-success: #00A3A3; /* Prometheus Turquoise */
  --color-status-error: #FF4D4D; /* Prometheus Red */
  --color-status-warning: #FF5500; /* Prometheus Orange */
}
```

### 2. Update Light Theme Variables
```scss
[theme-mode='light'] {
  --color-white: #F8F8F8; /* Prometheus Ultra Light Gray */
  --color-white-soft: rgba(0, 0, 0, 0.04);
  --color-white-mute: #F5F5F5; /* Prometheus Light Gray */

  --color-black: #0A192D; /* Prometheus Navy */
  --color-black-soft: #0F2440; /* Prometheus Light Navy */
  --color-black-mute: #333333; /* Prometheus Dark Gray */

  --color-gray-1: #4D9FFF; /* Prometheus Light Blue */
  --color-gray-2: #00A3A3; /* Prometheus Turquoise */
  --color-gray-3: #CCCCCC; /* Prometheus Medium Gray */

  --color-text-1: rgba(0, 0, 0, 1);
  --color-text-2: rgba(0, 0, 0, 0.6);
  --color-text-3: rgba(0, 0, 0, 0.38);

  --color-background: var(--color-white);
  --color-background-soft: var(--color-white-soft);
  --color-background-mute: var(--color-white-mute);
  --color-background-opacity: rgba(248, 248, 248, 1); /* Ultra Light Gray */
  --inner-glow-opacity: 0.1;

  --color-primary: #FFDD00; /* Prometheus Yellow */
  --color-primary-soft: #FFDD0099; /* Yellow with opacity */
  --color-primary-mute: #FFDD0033; /* Yellow with more opacity */

  --color-text: var(--color-text-1);
  --color-text-secondary: rgba(0, 0, 0, 0.75);
  --color-icon: #00000099;
  --color-icon-white: #000000;
  --color-border: #00000019;
  --color-border-soft: #00000010;
  --color-border-mute: #00000005;
  --color-error: #FF4D4D; /* Prometheus Red */
  --color-link: #4D9FFF; /* Prometheus Light Blue */
  --color-code-background: #F5F5F5; /* Prometheus Light Gray */
  --color-hover: var(--color-white-mute);
  --color-active: var(--color-white-soft);
  --color-frame-border: #CCCCCC; /* Prometheus Medium Gray */
  --color-group-background: var(--color-white);

  --color-reference: #cfe1ff;
  --color-reference-text: #000000;
  --color-reference-background: #f1f7ff;

  --color-list-item: #fff;
  --color-list-item-hover: #fafafa;

  --modal-background: var(--color-white);

  --color-highlight: initial;
  --color-background-highlight: rgba(255, 221, 0, 0.5); /* Yellow */
  --color-background-highlight-accent: rgba(255, 85, 0, 0.5); /* Orange */

  --navbar-background-mac: rgba(248, 248, 248, 0.55); /* Ultra Light Gray with opacity */
  --navbar-background: rgba(245, 245, 245); /* Light Gray */
}
```

### 3. Update User Theme Settings
In `src/renderer/src/store/settings.ts`, update the default primary color:
```typescript
userTheme: {
  colorPrimary: '#FFDD00' // Prometheus Yellow
}
```

### 4. Update Theme Provider
The ThemeProvider in `src/renderer/src/context/ThemeProvider.tsx` should continue to work as is since it uses the CSS variables.

## Implementation Steps
1. Update color.scss with the new color palette
2. Update the default user theme in settings.ts
3. Test the theme changes across the application
4. Verify that all components properly adapt to the new color scheme
