import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import type { PlanOutput, WizardInput } from '@shared/schemas';
import { apiGeneratePlan, apiGetPlan } from './lib/api';
import { AuthProvider } from './components/auth/AuthContext';
import { Header } from './components/shared/Header';
import { WizardShell } from './components/wizard/WizardShell';
import { DashboardShell } from './components/dashboard/DashboardShell';
import { SharedPlanView } from './components/shared/SharedPlanView';
import { loadGuestPlan, saveGuestPlan, clearGuestPlan } from './lib/guestPlanStorage';
import { useAuth } from './hooks/useAuth';

const MainPlanner: React.FC = () => {
  const { id: routePlanId } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [currentInput, setCurrentInput] = useState<WizardInput | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanOutput | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load plan on mount or refresh:
  // For guests, loads safely from localStorage (never calls GET /api/plan/:id which would 401).
  // For authenticated users, loads via authenticated API if a route plan ID is present.
  useEffect(() => {
    // If not signed in (guest), always prefer local storage plan
    if (!user) {
      const stored = loadGuestPlan();
      if (stored) {
        if (!routePlanId || stored.planId === routePlanId) {
          setCurrentPlanId(stored.planId);
          setCurrentInput(stored.input);
          setCurrentPlan(stored.plan);
          return;
        }
      }
    } else if (routePlanId && !currentPlan) {
      // Authenticated user with plan ID in route
      user.getIdToken().then((token) => {
        apiGetPlan(routePlanId, token)
          .then((saved) => {
            setCurrentPlanId(saved.id);
            setCurrentInput(saved.input);
            setCurrentPlan(saved.plan);
          })
          .catch((err) => {
            setErrorMessage(err instanceof Error ? err.message : 'Failed to load plan');
          });
      });
    }
  }, [user, routePlanId]);

  const handleGeneratePlan = async (input: WizardInput) => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const token = user ? await user.getIdToken() : undefined;
      const res = await apiGeneratePlan(input, token);
      const planId = res.planId || 'guest_plan';
      setCurrentPlanId(planId);
      setCurrentInput(input);
      setCurrentPlan(res.plan);
      setIsFallback(res.meta?.source === 'fallback');

      // Guests persist the latest plan locally so refreshes retain state
      if (!user) {
        saveGuestPlan(planId, input, res.plan);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate plan');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdatePlan = (updated: PlanOutput, newBudget?: number) => {
    setCurrentPlan(updated);
    let updatedInput = currentInput;
    if (newBudget !== undefined && currentInput) {
      updatedInput = { ...currentInput, totalBudget: newBudget };
      setCurrentInput(updatedInput);
    }
    // Update local storage for guests
    if (!user && currentPlanId && updatedInput) {
      saveGuestPlan(currentPlanId, updatedInput, updated);
    }
  };

  const handleNewPlan = () => {
    setCurrentPlan(null);
    setCurrentInput(null);
    setCurrentPlanId(null);
    setIsFallback(false);
    setErrorMessage(null);
    clearGuestPlan();
  };

  return (
    <>
      <Header onNewPlan={handleNewPlan} showNewPlanButton={!!currentPlan} />

      {errorMessage && (
        <div className="container" style={{ marginTop: '1.5rem' }}>
          <div
            role="alert"
            style={{
              background: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              border: '1px solid var(--danger-border)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </div>
        </div>
      )}

      {currentPlan && currentInput ? (
        <DashboardShell
          input={currentInput}
          plan={currentPlan}
          isFallback={isFallback}
          onUpdatePlan={handleUpdatePlan}
          onNewPlan={handleNewPlan}
        />
      ) : (
        <main>
          <div className="container" style={{ textAlign: 'center', paddingTop: '2.5rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{
                display: 'inline-block',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, var(--primary-saffron), var(--primary-magenta))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                border: '1px solid rgba(230,81,0,0.25)',
                padding: '0.3rem 0.8rem',
                borderRadius: 'var(--radius-full)',
              }}>
                🎯 Hack2Skill × VirtualPromptWars — Challenge 5
              </span>
            </div>
            <h1
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                marginBottom: '0.75rem',
                background:
                  'linear-gradient(90deg, var(--primary-saffron) 0%, var(--primary-magenta) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Plan Your Celebration, The Indian Way 🎉
            </h1>
            <p
              style={{
                fontSize: '1.1rem',
                color: 'var(--text-muted)',
                maxWidth: '640px',
                margin: '0 auto 2rem',
                lineHeight: 1.6,
              }}
            >
              Smart multi-ceremony wedding budgets, festival permission checklists, and culturally
              personalized ideas — all powered by Gemini with deterministic rupee math.
            </p>

            {/* Feature Highlights */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              maxWidth: '900px',
              margin: '0 auto 2.5rem',
              textAlign: 'left',
            }}>
              {[
                { icon: '💰', title: 'Zero Rupee Drift', desc: 'Deterministic Largest-Remainder math — budget allocations sum exactly to the paisa, never hallucinated.' },
                { icon: '⏳', title: 'IST-Aware Timeline', desc: 'Milestones calculated in Asia/Kolkata timezone. Export RFC 5545 .ics or add directly to Google Calendar.' },
                { icon: '🤝', title: 'Vendor Questionnaire', desc: 'AI generates 2–4 sharp interview questions per vendor. Includes Police NOC & Municipal permits for community events.' },
                { icon: '✨', title: 'Gemini Refinement', desc: 'Rewrite any section — food, décor, activities — with a 300-char instruction. Strict event-planning focus, no off-topic drift.' },
              ].map((f) => (
                <div key={f.title} style={{
                  background: 'var(--surface-card)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.1rem',
                  boxShadow: 'var(--surface-shadow)',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{f.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>{f.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>{f.desc}</div>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div style={{
              maxWidth: '700px',
              margin: '0 auto 2.5rem',
              background: 'var(--surface-card)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              boxShadow: 'var(--surface-shadow)',
            }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.1rem', color: 'var(--text-main)', textAlign: 'center' }}>
                🪄 How it works — 5 steps in under 2 minutes
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                {[
                  { step: '1', label: 'Pick your event type', detail: 'Wedding, Birthday, or Community Festival — select sub-events like Haldi, Sangeet, Mehendi.' },
                  { step: '2', label: 'Add date, city & guest count', detail: 'Utsav tailors vendor deadlines and permits to your Indian city and timeline.' },
                  { step: '3', label: 'Set your budget', detail: 'Use presets (₹5L–₹60L for weddings) or type any amount. Rupee math is done in TypeScript — never by AI.' },
                  { step: '4', label: 'Describe your vibe', detail: 'Theme, dietary preferences, cultural notes, and language (English or Hindi).' },
                  { step: '5', label: 'Gemini generates your full plan', detail: 'Budget breakdown, timeline milestones, vendor checklist, and 5+ personalized ideas — all in one click.' },
                ].map((s) => (
                  <div key={s.step} style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '26px', height: '26px', minWidth: '26px',
                      borderRadius: 'var(--radius-full)',
                      background: 'linear-gradient(135deg, var(--primary-saffron), var(--primary-magenta))',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{s.step}</div>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{s.label}</span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{s.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <WizardShell onGeneratePlan={handleGeneratePlan} isGenerating={isGenerating} />
        </main>
      )}
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainPlanner />} />
          <Route path="/plan/:id" element={<MainPlanner />} />
          <Route path="/share/:token" element={<SharedPlanView />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
