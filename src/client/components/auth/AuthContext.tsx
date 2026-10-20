import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { loginWithGoogle, logoutUser, subscribeToAuthChanges } from '../../lib/firebase.js';
import { AuthContext } from './context.js';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const u = await loginWithGoogle();
      setUser(u);
    } catch {
      // In guest mode or offline, user continues smoothly
    }
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isGuest: !user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
