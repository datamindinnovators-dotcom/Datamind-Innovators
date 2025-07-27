import AuthGuard from '@/components/auth-guard';
import { AdminNav } from '@/components/admin/admin-nav';
import Header from '@/components/header';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="admin">
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <AdminNav />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
