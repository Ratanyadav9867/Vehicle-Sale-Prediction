import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import api from '../api/client';
import type { User } from '../types/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>;
  adminLogin: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, confirm_password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (data: { name: string }) => Promise<User>;
  changePassword: (data: { current_password: string; new_password: string; confirm_new_password: string }) => Promise<{ message: string; token?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * SECURITY FIX: Session is restored by calling GET /api/auth/me.
   * The httpOnly cookie is sent automatically by the browser (withCredentials=true).
   * No token is ever read from or written to localStorage / sessionStorage.
   */
  const restoreSession = useCallback(async () => {
    try {
      const response = await api.auth.me();
      setUser(response.user);
    } catch {
      // No valid session cookie — user is logged out
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = async (email: string, password: string, rememberMe = true): Promise<User> => {
    // Backend sets the httpOnly cookie via Set-Cookie; withCredentials ensures the
    // browser stores and sends it automatically from this point forward.
    const response = await api.auth.login({ email, password, remember_me: rememberMe });
    setUser(response.user);
    return response.user;
  };

  const adminLogin = async (email: string, password: string): Promise<User> => {
    const response = await api.auth.adminLogin({ email, password });
    setUser(response.user);
    return response.user;
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    confirm_password: string
  ): Promise<User> => {
    const response = await api.auth.register({ name, email, password, confirm_password });
    setUser(response.user);
    return response.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors — still clear local user state
    } finally {
      setUser(null);
    }
  };

  const updateProfile = async (data: { name: string }): Promise<User> => {
    const updatedUser = await api.auth.updateProfile(data);
    setUser(updatedUser);
    return updatedUser;
  };

  const changePassword = async (data: {
    current_password: string;
    new_password: string;
    confirm_new_password: string;
  }): Promise<{ message: string; token?: string }> => {
    return await api.auth.changePassword(data);
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await api.auth.me();
      setUser(response.user);
    } catch {
      // Keep existing state if offline
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        isAdmin,
        login,
        adminLogin,
        register,
        logout,
        updateProfile,
        changePassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
