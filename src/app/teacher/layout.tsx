import AuthGuard from '@/components/auth-guard';
import Header from '@/components/header';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="teacher">
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
