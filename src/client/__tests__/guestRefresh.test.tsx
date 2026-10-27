import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';
import { saveGuestPlan, loadGuestPlan, clearGuestPlan } from '../lib/guestPlanStorage';
import type { PlanOutput, WizardInput } from '@shared/schemas';

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

  it('persists guest plan in localStorage and loads it on refresh without making 401 API calls', async () => {
    // 1. Simulate existing guest plan persisted before refresh
    saveGuestPlan('guest_plan_abc123', mockInput, mockPlan);

    // Spy on fetch to ensure no GET /api/plan/:id call is triggered
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // 2. Render App (simulating page reload/refresh)
    render(<App />);

    // 3. The dashboard must load the plan summary from localStorage
    expect(
      await screen.findByText(/Exciting Bollywood Disco Birthday Party in Mumbai for 50 guests/i),
    ).toBeInTheDocument();

    // 4. Must display the "Sign in to save across devices" prompt for guests
    const signInPrompt = screen.getAllByText(/Sign in to save across devices/i);
    expect(signInPrompt.length).toBeGreaterThan(0);

    // 5. Verify NO unauthorized GET /api/plan/:id network calls were made
    const getPlanCalls = fetchSpy.mock.calls.filter((call) => {
      const url = typeof call[0] === 'string' ? call[0] : '';
      return url.includes('/api/plan/');
    });
    expect(getPlanCalls.length).toBe(0);
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
