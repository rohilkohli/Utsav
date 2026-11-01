import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/auth/AuthContext';
import { Header } from './components/shared/Header';
import { LandingHero } from './components/shared/LandingHero';
import { WizardShell } from './components/wizard/WizardShell';
import { DashboardShell } from './components/dashboard/DashboardShell';
import { SharedPlanView } from './components/shared/SharedPlanView';
import { ThinkingTrace } from './components/shared/ThinkingTrace';
import { usePlanState } from './hooks/usePlanState';
import './components/dashboard/dashboard.css';
const VoiceAgent = lazy(() =>
  import('./components/voice/VoiceAgent').then((module) => ({ default: module.VoiceAgent })),
);
function MainPlanner() {
  const state = usePlanState();
  return (
    <>
      <Header onNewPlan={state.reset} showNewPlanButton={!!state.active} />
      {(state.error || state.generation.error) && (
        <div className="container app-message">
          <p role="alert" className="dashboard-card dashboard-warning">
            {state.error || state.generation.error}
          </p>
        </div>
      )}
      {state.notice && (
        <p className="container app-message" role="status">
          {state.notice}
        </p>
      )}
      <Suspense fallback={null}>
        <VoiceAgent
          plan={state.active?.plan ?? null}
          input={state.active?.input ?? null}
          onNavigateTab={state.setActiveTab}
        />
      </Suspense>
      {state.active ? (
        <DashboardShell
          input={state.active.input}
          plan={state.active.plan}
          isFallback={state.isFallback}
          activeTab={state.activeTab}
          onTabChange={state.setActiveTab}
          onUpdatePlan={state.update}
          onNewPlan={state.reset}
        />
      ) : (
        <main id="main">
          <LandingHero />
          <div className="container">
            <ThinkingTrace {...state.generation} />
          </div>
          <WizardShell
            onGeneratePlan={state.generate}
            onInstantCreate={state.instant}
            isGenerating={state.generation.running}
          />
        </main>
      )}
      <footer className="app-footer" aria-label="Site footer">
        <div className="container">
          <p>
            <strong>Utsav (उत्सव)</strong> — India-first AI Celebration &amp; Event Planner ·
            Powered by{' '}
            <a
              href="https://ai.google.dev"
              rel="noopener noreferrer"
              target="_blank"
              aria-label="Powered by Gemini AI (opens in new tab)"
            >
              Gemini AI
            </a>{' '}
            · Hack2Skill × VirtualPromptWars Challenge 5
          </p>
        </div>
      </footer>
    </>
  );
}
export function App() {
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
}
export default App;
