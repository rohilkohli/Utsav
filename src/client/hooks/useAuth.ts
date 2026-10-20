import { useContext } from 'react';
import { AuthContext } from '../components/auth/context.js';

export const useAuth = () => useContext(AuthContext);
