import './SharedPlanView.css';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { SavedPlan } from '@shared/schemas';
import { apiGetSharedPlan } from '../../lib/api';
import { DashboardShell } from '../dashboard/DashboardShell';

export const SharedPlanView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [savedPlan, setSavedPlan] = useState<SavedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSavedPlan(null);
    if (!token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    apiGetSharedPlan(token)
      .then((plan) => {
        if (!active) return;
        setSavedPlan(plan);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Plan expired or not found');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <main id="main" className={['shared-plan-view-div-1'].join(' ')}>
        <p className={['shared-plan-view-p-2'].join(' ')}>
          🎉 Loading shared celebration blueprint...
        </p>
      </main>
    );
  }

  if (error || !savedPlan) {
    return (
      <main id="main" className={['shared-plan-view-div-3'].join(' ')}>
        <h2 className={['shared-plan-view-h2-4'].join(' ')}>Plan Link Expired or Not Found</h2>
        <p className={['shared-plan-view-p-5'].join(' ')}>
          This celebration snapshot may have expired or was removed.
        </p>
        <button
          type="button"
          onClick={() => {
            void navigate('/');
          }}
          className={['shared-plan-view-button-6'].join(' ')}
        >
          Plan Your Own Celebration on Utsav →
        </button>
      </main>
    );
  }

  return (
    <div>
      <div className={['shared-plan-view-div-7'].join(' ')}>
        👁️ You are viewing a read-only shared celebration plan.
      </div>

      <DashboardShell
        readOnly
        input={savedPlan.input}
        plan={savedPlan.plan}
        onUpdatePlan={() => {
          return;
        }}
        onNewPlan={() => {
          void navigate('/');
        }}
      />
    </div>
  );
};
