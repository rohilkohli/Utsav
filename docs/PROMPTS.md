# Utsav Prompt Log & System Instructions

This document tracks key prompts, model system instructions, and design iterations for Utsav's Gemini-powered event planner.

## Initial Challenge Brief
> Build "Utsav" — an India-first GenAI celebration & event planner for the Google PromptWars Virtual challenge "Celebration & Event Planner".
> Features: (1) budget planner, (2) timeline, (3) vendor checklist, (4) personalized ideas.

## Architectural Refinements
- Single package structure (`src/client`, `src/server`, `src/shared`).
- Zod schemas in `src/shared/schemas.ts` serve as the single source of truth for TypeScript types (`z.infer`) and Gemini's JSON schema (`zodToJsonSchema`).
- Flat schema for all events with optional `subEvent` tag (e.g., "Haldi", "Sangeet", "Visarjan").
- Pure TS deterministic math for budget allocations (largest-remainder method).
- Refine chat strictly scoped to rewrites of ideas/text, with 300-char input limit.

## Gemini Prompt Templates
1. **Plan Generation (`buildPlanPrompt`)**:
   - Instructs model as expert Indian celebration planner.
   - Outputs percentage allocations, days-before timeline milestones, vendor interview questions with booking lead-times, and 5+ creative ideas.
   - Enforces cultural nuances (sub-events, dietary constraints, community permits).
2. **Section Refinement (`buildRefinePrompt`)**:
   - Strictly rewrites ideas for a chosen section according to user modification instructions (e.g. "make it eco-friendly").
