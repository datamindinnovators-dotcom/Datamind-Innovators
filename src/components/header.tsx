
"use client";

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-provider';
import { Icons } from './icons';
import Link from 'next/link';

export default function Header() {
  const { logout, user } = useAuth();

  return (
    <header className="flex h-16 items-center border-b bg-card px-4 md:px-6 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Link href={`/${user?.role}/dashboard`} className="flex items-center gap-3">
          <Icons.logo className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-semibold font-headline text-foreground">Classroom Hub</h1>
        </Link>
      </div>
      <div className="ml-auto flex items-center gap-4">
        {user && <span className="text-sm text-muted-foreground hidden md:inline">{user.email}</span>}
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
