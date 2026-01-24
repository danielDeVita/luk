'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Loader2 } from 'lucide-react';

interface MeQueryResult {
  me: {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    role: 'USER' | 'ADMIN' | 'BANNED';
  };
}

const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      nombre
      apellido
      role
    }
  }
`;

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const storeToken = useAuthStore((state) => state.token);
  const tokensProcessedRef = useRef(false);

  const successParam = searchParams.get('success');
  const errorParam = searchParams.get('error');
  const tokenParam = searchParams.get('token');
  const refreshTokenParam = searchParams.get('refreshToken');

  // Store tokens from URL synchronously on mount (for cross-subdomain where cookies are blocked)
  // Using ref to track processing and avoid re-runs - no setState in effect needed
  if (tokenParam && !tokensProcessedRef.current) {
    tokensProcessedRef.current = true;
    // Store tokens synchronously before render completes
    useAuthStore.setState({ token: tokenParam, refreshToken: refreshTokenParam });
  }

  // Clear tokens from URL for security (after initial render)
  useEffect(() => {
    if (tokensProcessedRef.current && tokenParam) {
      window.history.replaceState({}, '', '/auth/callback?success=true');
    }
  }, [tokenParam]);

  // Check if we have a valid token (either just stored or from persisted state)
  const hasToken = Boolean(storeToken || tokenParam);

  // Query user data - will use Authorization header from stored token
  const { data, error, loading } = useQuery<MeQueryResult>(ME_QUERY, {
    skip: !hasToken,
    fetchPolicy: 'network-only',
  });

  // Handle successful auth
  useEffect(() => {
    if (data?.me) {
      const storedToken = useAuthStore.getState().token;
      const storedRefreshToken = useAuthStore.getState().refreshToken;
      if (storedToken) {
        setAuth(data.me, storedToken, storedRefreshToken || undefined);
        router.replace('/');
      }
    }
  }, [data, setAuth, router]);

  // Handle query error
  useEffect(() => {
    if (error && !loading) {
      router.replace('/auth/login?error=callback_failed');
    }
  }, [error, loading, router]);

  // Handle OAuth error from backend
  useEffect(() => {
    if (errorParam) {
      router.replace(`/auth/login?error=${encodeURIComponent(errorParam)}`);
    }
  }, [errorParam, router]);

  // If no success param and no error, redirect to login
  useEffect(() => {
    if (successParam !== 'true' && !errorParam) {
      router.replace('/auth/login');
    }
  }, [successParam, errorParam, router]);

  if (errorParam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error de autenticación</h1>
          <p className="text-muted-foreground">{errorParam}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Completando inicio de sesión...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
