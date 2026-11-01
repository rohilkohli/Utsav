import './Header.css';
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';

interface HeaderProps {
  onNewPlan?: () => void;
  showNewPlanButton?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onNewPlan, showNewPlanButton }) => {
  const { user, login, logout, isGuest } = useAuth();
  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === 'dark');

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem('utsav-theme', nextTheme);
    } catch {
      /* Theme still applies when storage is unavailable. */
    }
    setIsDark(!isDark);
  };

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header role="banner" className={['header-header-1'].join(' ')}>
        <div className={['container', 'header-div-2'].join(' ')}>
          <div className={['header-div-3'].join(' ')}>
            <span
              className={['header-span-4'].join(' ')}
              role="img"
              aria-label="Celebration popper"
            >
              🎉
            </span>
            <div>
              <div className={['header-div-5'].join(' ')}>
                <h1 className={['header-h1-6'].join(' ')}>Utsav</h1>
                <span className={['header-span-7'].join(' ')}>(उत्सव)</span>
              </div>
              <p className={['header-p-8'].join(' ')}>India-first AI Celebration & Event Planner</p>
            </div>
          </div>

          <nav aria-label="Main navigation" className={['header-nav-9'].join(' ')}>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="theme-toggle"
            >
              {isDark ? '☀' : '☾'}
            </button>
            {showNewPlanButton && onNewPlan && (
              <button onClick={onNewPlan} type="button" className={['header-button-10'].join(' ')}>
                + Plan New Event
              </button>
            )}

            {isGuest ? (
              <button
                onClick={() => {
                  void login();
                }}
                type="button"
                className={['header-button-11'].join(' ')}
              >
                <span className={['header-span-12'].join(' ')}>●</span> Guest Mode
                <span className={['header-span-13'].join(' ')}>(Sign In)</span>
              </button>
            ) : (
              <div className={['header-div-14'].join(' ')}>
                {user?.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName ?? 'User profile'}
                    referrerPolicy="no-referrer"
                    className={['header-img-15'].join(' ')}
                  />
                )}
                <span className={['header-span-16'].join(' ')}>
                  {user?.displayName ?? user?.email ?? 'User'}
                </span>
                <button
                  onClick={() => {
                    void logout();
                  }}
                  type="button"
                  className={['header-button-17'].join(' ')}
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
