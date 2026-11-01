import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isGuest: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => Promise.reject(new Error('AuthProvider is required')),
  logout: () => Promise.reject(new Error('AuthProvider is required')),
  isGuest: true,
});
