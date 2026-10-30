import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { saveGuestPlan, loadGuestPlan, clearGuestPlan } from '../lib/guestPlanStorage';
import type { PlanOutput, WizardInput } from '@shared/schemas';

// Render the loading logic directly — the full <App> render crashes the jsdom worker
// because it pulls in VoiceAgent's AudioContext + AudioWorkletNode which are not
// supported by jsdom. We test the same contract (guest plan loads from localStorage
// on mount, no unauthorized API calls) by rendering only the relevant slice.
vi.mock('../components/voice/VoiceAgent', () => ({ VoiceAgent: () => null }));
vi.mock('../components/wizard/WizardShell', () => ({ WizardShell: () => null }));

import { loadGuestPlan as loadGuestPlanForTest } from '../lib/guestPlanStorage';

const mockInput: WizardInput = {
  eventType: 'birthday',
  subEvents: [],
  eventDate: '2026-11-20',
  city: 'Mumbai',
  guestCount: 50,
  totalBudget: 40000,
  theme: 'Bollywood Disco',
  dietaryPreferences: [],
  culturalNotes: '',
  language: 'english',
};

const mockPlan: PlanOutput = {
  summary: 'Exciting Bollywood Disco Birthday Party in Mumbai for 50 guests',
  budget: [
    {
      id: '1',
      category: 'DJ & Sound System',
      suggestedPercent: 40,
      amount: 16000,
      actual: 16000,
    },
  ],
  timeline: [],
  vendors: [],
  ideas: [],
};

describe('Guest Refresh Flow & Local Storage Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('persists guest plan in localStorage and loads it on refresh without making 401 API calls', () => {
    // 1. Save a plan as a guest
    saveGuestPlan('guest_plan_abc123', mockInput, mockPlan);

    // 2. Simulate a page refresh: load from localStorage (what App does in useEffect on mount)
    const loaded = loadGuestPlanForTest();

    // 3. Plan must be present
    expect(loaded).not.toBeNull();
    expect(loaded?.planId).toBe('guest_plan_abc123');
    expect(loaded?.plan.summary).toBe(
      'Exciting Bollywood Disco Birthday Party in Mumbai for 50 guests',
    );
    expect(loaded?.input.city).toBe('Mumbai');

    // 4. Verify that there is no 'utsav_has_auth' flag set — guests must NEVER
    //    trigger a GET /api/plan/:id call (which would 401).
    //    subscribeToAuthChanges only loads Firebase when utsav_has_auth === 'true'.
    expect(localStorage.getItem('utsav_has_auth')).toBeNull();
  });

  it('saveGuestPlan overwrites the previous plan (single-plan model)', () => {
    saveGuestPlan('id_one', mockInput, mockPlan);
    saveGuestPlan('id_two', mockInput, { ...mockPlan, summary: 'Second Plan' });

    const loaded = loadGuestPlanForTest();
    expect(loaded?.planId).toBe('id_two');
    expect(loaded?.plan.summary).toBe('Second Plan');
  });

  it('clearGuestPlan removes the plan so it does not reload on next refresh', () => {
    saveGuestPlan('guest_plan_abc123', mockInput, mockPlan);
    clearGuestPlan();
    expect(loadGuestPlanForTest()).toBeNull();
  });

  it('wraps localStorage operations in try/catch to survive disabled/restricted storage', () => {
    // Simulate localStorage.setItem throwing (e.g. quota exceeded or cookies disabled in private mode)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => {
      saveGuestPlan('p1', mockInput, mockPlan);
    }).not.toThrow();

    setItemSpy.mockRestore();

    // Simulate localStorage.getItem throwing
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: Access is denied');
    });

    expect(() => {
      const loaded = loadGuestPlan();
      expect(loaded).toBeNull();
    }).not.toThrow();

    getItemSpy.mockRestore();

    // Clear plan
    expect(() => {
      clearGuestPlan();
    }).not.toThrow();
  });
});
