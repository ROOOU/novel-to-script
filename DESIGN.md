---
version: alpha
name: NovelScript Editorial Studio
description: Design system for a short-drama adaptation workspace that moves from novel intake to script, storyboard, prompt-pack, video, and delivery.
colors:
  primary: "#02492A"
  secondary: "#5F584F"
  tertiary: "#FBBD41"
  neutral: "#FAF9F7"
  surface: "#FFFFFF"
  elevated: "#FFF4DF"
  ink: "#16130F"
  line: "#DAD4C8"
  lineSoft: "#EEE9DF"
  matcha: "#84E7A5"
  slushie: "#3BD3FD"
  ube: "#C1B0FF"
  blueberry: "#01418D"
  pomegranate: "#FC7981"
typography:
  display-xl:
    fontFamily: Fraunces
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: 0em
  heading-lg:
    fontFamily: Fraunces
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: 0em
  heading-md:
    fontFamily: Fraunces
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: 0em
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: 0em
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0em
  meta-sm:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0em
rounded:
  xs: 4px
  sm: 8px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: 12px
  nav-anchor:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: 12px
  workspace-shell:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 24px
  workspace-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 24px
  divider-strong:
    backgroundColor: "{colors.line}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.xs}"
    padding: 4px
  divider-soft:
    backgroundColor: "{colors.lineSoft}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.xs}"
    padding: 4px
  workflow-stage-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 18px
  workflow-stage-novel:
    backgroundColor: "{colors.pomegranate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 18px
  workflow-stage-script:
    backgroundColor: "{colors.slushie}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 18px
  workflow-stage-storyboard:
    backgroundColor: "{colors.matcha}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 18px
  metric-card-prompt:
    backgroundColor: "{colors.ube}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 16px
  brand-badge:
    backgroundColor: "{colors.blueberry}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: 8px
  chip-soft:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.secondary}"
    typography: "{typography.meta-sm}"
    rounded: "{rounded.pill}"
    padding: 8px
---

# NovelScript Design System

## Overview

NovelScript should feel like an editorial production studio rather than a generic dashboard. The product starts with raw prose, moves through planning and drafting, and ends in storyboard and delivery outputs. The interface should therefore balance literary calm with production clarity.

The emotional target is focused, warm, and competent. It should feel serious enough for structured review, but never cold or corporate. Panels should read as working surfaces. Metadata should feel precise. High-value actions should stand out quickly, while long-form writing and visual review remain easy to sit with for a while.

## Colors

The palette is anchored by warm neutrals, a deep forest brand color, and one amber interaction accent.

- **Primary (`#02492A`)** is the structural brand anchor. Use it for directional emphasis, trusted states, and serious navigation moments.
- **Secondary (`#5F584F`)** is the utility text color for metadata, helper copy, borders, and explanatory UI.
- **Tertiary (`#FBBD41`)** is the action color. It should be the clearest signal for primary buttons and high-priority prompts.
- **Neutral (`#FAF9F7`)** is the page foundation. It keeps the interface light without the brittleness of pure white.
- **Surface (`#FFFFFF`)** is the main panel color.
- **Elevated (`#FFF4DF`)** is a warm highlight surface for soft emphasis.

Stage accents such as matcha, slushie, ube, blueberry, and pomegranate may distinguish workflow lanes or status contexts, but they should stay subordinate to the primary/tertiary pair.

## Typography

Typography should separate storytelling from operations.

- **Fraunces** is the display and editorial heading voice. Use it for project hero titles, major workspace section titles, and other moments where the product should feel authored instead of purely utilitarian.
- **Manrope** is the primary working font. Use it for forms, panel copy, buttons, and dense workflow content.
- **Space Mono** is reserved for compact machine-like metadata, version indicators, or system annotations where a more technical tone is useful.

Heading typography should be calm and readable, not shouty. Letter spacing should stay neutral. Body text should privilege legibility during long reading and editing sessions.

## Layout

The workspace should present the production process in layers:

1. Project identity and current state.
2. Major workflow lanes.
3. The active working surface for editing or review.

This means summary and orientation come before detail. A user should understand what this project can do, which stage it is in, and what output exists before they commit attention to a form or artifact viewer.

Use 16px and 24px spacing as the main rhythm. Dense metadata can compress toward 8px or 12px, but primary panels should still breathe.

## Elevation & Depth

Depth should be soft and warm, not glossy. Use low-contrast borders plus restrained shadows to separate layers. Panels may lift slightly on hover or selection, but the interface should avoid feeling toy-like or overly inflated.

The hierarchy should come more from structure, typography, and background shifts than from aggressive motion or heavy shadow stacks.

## Shapes

The default shape language is compact and disciplined:

- **4px** for tight internal elements.
- **8px** for cards, buttons, segmented controls, and summary panels.
- **Pill** shapes only for chips, badges, and compact counters.

Avoid oversized radii on primary workflow surfaces. The system should read as composed and intentional, especially in the project workspace.

## Components

- **Primary buttons** should use the tertiary accent with dark text, because the product needs one unambiguous action signal.
- **Secondary buttons** should remain quiet and surface-based, supporting inspection and navigation without stealing attention.
- **Workspace panels** should feel like durable production boards with clear edges and stable spacing.
- **Workflow stage cards** should summarize progress, not just decorate navigation.
- **Storyboard review** should keep the storyboard itself, the shot plan, and the prompt pack visibly linked. These outputs belong to the same production moment and should not be mentally split apart.

## Do's and Don'ts

Do keep source, script, storyboard, prompt-pack, and delivery outputs visibly connected.

Do use editorial typography for major titles and utilitarian typography for workflow controls.

Do keep the interaction accent scarce and obvious.

Do keep cards and buttons compact in shape.

Don't introduce competing accent colors for primary actions.

Don't hide key downstream outputs like shot plans or prompt packs behind unrelated views.

Don't let decorative treatment overpower reading, writing, or review tasks.

Don't let the UI feel like a generic SaaS admin when the product is really a creative production studio.
