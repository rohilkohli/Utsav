import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import type { PlanOutput, WizardInput } from '@shared/schemas';
import { apiGeneratePlan } from './lib/api';
import { AuthProvider } from './components/auth/AuthContext';
import { Header } from './components/shared/Header';
import { WizardShell } from './components/wizard/WizardShell';
import { DashboardShell } from './components/dashboard/DashboardShell';
import { SharedPlanView } from './components/shared/SharedPlanView';

const MainPlanner: React.FC = () => {
  const [currentInput, setCurrentInput] = useState<WizardInput | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanOutput | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGeneratePlan = async (input: WizardInput) => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const res = await apiGeneratePlan(input);
      setCurrentInput(input);
      setCurrentPlan(res.plan);
      setIsFallback(!!res.isFallback);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate plan');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdatePlan = (updated: PlanOutput, newBudget?: number) => {
    setCurrentPlan(updated);
    if (newBudget !== undefined && currentInput) {
      setCurrentInput({ ...currentInput, totalBudget: newBudget });
    }
  };

  const handleNewPlan = () => {
    setCurrentPlan(null);
    setCurrentInput(null);
    setIsFallback(false);
    setErrorMessage(null);
  };

  return (
    <>
      <Header
        onNewPlan={handleNewPlan}
        showNewPlanButton={!!currentPlan}
      />

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
            <h1
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                marginBottom: '0.5rem',
                background: 'linear-gradient(90deg, var(--primary-saffron) 0%, var(--primary-magenta) 100%)',
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
                margin: '0 auto',
                lineHeight: 1.5,
              }}
            >
              Smart multi-ceremony wedding budgets, festival permission checklists, and culturally personalized ideas — all powered by Gemini with deterministic rupee math.
            </p>
          </div>

          <WizardShell
            onGeneratePlan={handleGeneratePlan}
            isGenerating={isGenerating}
          />
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
          <Route path="/share/:token" element={<SharedPlanView />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
