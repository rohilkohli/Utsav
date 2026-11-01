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
    if (!token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    apiGetSharedPlan(token)
      .then((plan) => {
        setSavedPlan(plan);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Plan expired or not found');
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
        <p style={{ fontSize: '1.25rem', color: 'var(--primary-saffron)', fontWeight: 600 }}>
          🎉 Loading shared celebration blueprint...
        </p>
      </div>
    );
  }

  if (error || !savedPlan) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Plan Link Expired or Not Found
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          This celebration snapshot may have expired or was removed.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--primary-saffron)',
            color: '#ffffff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Plan Your Own Celebration on Utsav →
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          background: 'rgba(0, 105, 92, 0.1)',
          borderBottom: '1px solid var(--primary-emerald)',
          padding: '0.6rem 1rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--primary-emerald)',
          fontWeight: 600,
        }}
      >
        👁️ You are viewing a read-only shared celebration plan.
      </div>

      <DashboardShell
        input={savedPlan.input}
        plan={savedPlan.plan}
        onUpdatePlan={() => {}}
        onNewPlan={() => navigate('/')}
      />
    </div>
  );
};
