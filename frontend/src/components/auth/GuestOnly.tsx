import React from 'react';
import { useAuth } from '../../context/AuthContext';

export interface GuestOnlyProps {
  children: React.ReactNode;
}

/**
 * GuestOnly renders children only when the visitor is NOT authenticated.
 * Renders null during authentication loading to prevent any UI flashing.
 */
export const GuestOnly: React.FC<GuestOnlyProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

export default GuestOnly;
