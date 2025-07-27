
"use client";

import React, { ReactNode, useEffect } from 'react';
import { useAuth } from '@/context/auth-provider';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from './ui/skeleton';
import { Icons } from './icons';
import Link from 'next/link';
import { Button } from './ui/button';
import { LogOut, Users, CalendarClock } from 'lucide-react';

export default function AuthGuard({ children, role }: { children: React.ReactNode, role: 'admin' | 'teacher' }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return; // Wait until loading is finished
    }

    if (!user) {
      if (pathname !== '/login') {
        router.replace('/login');
      }
    } else if (user.role !== role) {
      router.replace(`/${user.role}/dashboard`);
    }
  }, [user, loading, role, router, pathname]);


  if (loading) {
    return (
        <div className="flex flex-col h-screen">
            <header className="flex h-16 shrink-0 items-center border-b bg-card px-4 md:px-6 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-6 w-32" />
                </div>
                <div className="ml-auto flex items-center gap-4">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                </div>
            </header>
            <main className="flex-1 p-4 md:p-8 lg:p-10">
                <Skeleton className="w-full h-full rounded-lg" />
            </main>
        </div>
    )
  }

  // If user is not authenticated or role doesn't match, we return null
  // because the useEffect will handle the redirection.
  if (!user || user.role !== role) {
    return null;
  }

  return <>{children}</>;
}
