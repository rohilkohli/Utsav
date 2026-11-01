import React from 'react';
import { useAuth } from '../../hooks/useAuth.js';

interface HeaderProps {
  onNewPlan?: () => void;
  showNewPlanButton?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onNewPlan, showNewPlanButton }) => {
  const { user, login, logout, isGuest } = useAuth();

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header
        role="banner"
        style={{
          borderBottom: '1px solid var(--surface-border)',
          background: 'var(--surface-card)',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }} role="img" aria-label="Celebration popper">
            🎉
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <h1
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  background:
                    'linear-gradient(90deg, var(--primary-saffron) 0%, var(--primary-magenta) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Utsav
              </h1>
              <span
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: 'var(--primary-gold)',
                }}
              >
                (उत्सव)
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0 }}>
              India-first AI Celebration & Event Planner
            </p>
          </div>
        </div>

        <nav aria-label="Main navigation" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {showNewPlanButton && onNewPlan && (
            <button
              onClick={onNewPlan}
              type="button"
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--primary-saffron)',
                background: 'transparent',
                border: '1px solid var(--primary-saffron)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              + Plan New Event
            </button>
          )}

          {isGuest ? (
            <button
              onClick={login}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: 'var(--primary-emerald)' }}>●</span> Guest Mode
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(Sign In)</span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User profile'}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid var(--surface-border)',
                  }}
                />
              )}
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                {user?.displayName || user?.email || 'User'}
              </span>
              <button
                onClick={logout}
                type="button"
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  background: 'transparent',
                  border: '1px solid var(--surface-border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
    </>
  );
};
