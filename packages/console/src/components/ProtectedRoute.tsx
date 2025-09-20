import { useEffect, useState, type ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
        });
        if (!cancelled) {
          if (res.ok) {
            setAuthorized(true);
          } else {
            // Redirect to backend login route
            window.location.href = '/api/auth/login';
          }
        }
      } catch (e) {
        if (!cancelled) {
          window.location.href = '/api/auth/login';
        }
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  if (authorized === null) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-sm text-muted-foreground">
        Checking authentication...
      </div>
    );
  }

  if (!authorized) return null;

  return <>{children}</>;
}