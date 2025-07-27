
"use client";

import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type Role = 'admin' | 'teacher';

interface User {
  email: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  login: (email: string) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // This effect runs once on initial load to check for a stored user session.
    if (typeof window === 'undefined') {
        setLoading(false);
        return;
    }

    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else if (pathname !== '/login') {
        router.replace('/login');
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('user');
      if (pathname !== '/login') {
        router.replace('/login');
      }
    } finally {
        setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount.

  const login = (email: string) => {
    // In a real app, you'd call Firebase here.
    // For this demo, we'll assign roles based on email.
    let role: Role | null = null;
    if (email.toLowerCase() === 'admin@classroom.ai') {
      role = 'admin';
    } else if (email.toLowerCase() === 'teacher@classroom.ai') {
      role = 'teacher';
    }

    if (role) {
      const userData = { email, role };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      router.push(`/${role}/dashboard`);
    } else {
        throw new Error("Invalid credentials. Use 'admin@classroom.ai' or 'teacher@classroom.ai'.");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    router.push('/login');
  };

  const value = { user, login, logout, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
