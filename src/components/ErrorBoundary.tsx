import React, { useState, useEffect, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

export function ErrorBoundary({ children }: Props) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const errorHandler = (e: ErrorEvent) => {
      setHasError(true);
      setError(e.error);
    };
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    let errorMessage = "An unexpected error occurred.";
    try {
      const parsed = JSON.parse(error?.message || "");
      if (parsed.error && parsed.operationType) {
        errorMessage = `Firebase ${parsed.operationType} error: ${parsed.error}`;
      }
    } catch (e) {
      errorMessage = error?.message || errorMessage;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <Card className="max-w-md w-full border-red-200">
          <CardHeader className="flex flex-row items-center gap-2 text-red-600">
            <AlertCircle className="w-6 h-6" />
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Reload Application
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
