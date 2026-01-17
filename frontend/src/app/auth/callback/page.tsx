'use client';

import { useEffect, Suspense } from 'react';
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

  const successParam = searchParams.get('success');
  const errorParam = searchParams.get('error');
  const tokenParam = searchParams.get('token');

  // Store token from URL first (for cross-subdomain where cookies are blocked)
  useEffect(() => {
    if (tokenParam) {
      // Token is passed in URL, store it in auth store
      // This enables Authorization header for subsequent requests
      useAuthStore.setState({ token: tokenParam });
      // Clear token from URL for security
      window.history.replaceState({}, '', '/auth/callback?success=true');
    }
  }, [tokenParam]);

  // Query user data - will use Authorization header from stored token
  const { data, error, loading } = useQuery<MeQueryResult>(ME_QUERY, {
    skip: successParam !== 'true' || !tokenParam,
    fetchPolicy: 'network-only',
  });

  // Handle successful auth
  useEffect(() => {
    if (data?.me && tokenParam) {
      setAuth(data.me, tokenParam);
      router.replace('/');
    }
  }, [data, setAuth, router, tokenParam]);

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
