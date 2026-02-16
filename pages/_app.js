import { useEffect } from "react";
import "../styles/globals.css";
import { ErrorBoundary } from 'react-error-boundary';
import * as Sentry from '@sentry/nextjs';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert" style={{
      padding: '40px',
      maxWidth: '600px',
      margin: '100px auto',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ color: '#dc2626', marginBottom: '16px' }}>
        Oops! Something went wrong
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        We're sorry for the inconvenience. The application encountered an unexpected error.
      </p>
      <details style={{
        marginBottom: '24px',
        padding: '16px',
        background: '#f3f4f6',
        borderRadius: '8px',
        textAlign: 'left'
      }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
          Error Details
        </summary>
        <pre style={{
          fontSize: '12px',
          overflow: 'auto',
          color: '#dc2626'
        }}>
          {error.message}
        </pre>
      </details>
      <button
        onClick={resetErrorBoundary}
        style={{
          padding: '12px 24px',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          cursor: 'pointer',
          fontWeight: '500'
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
      >
        Try Again
      </button>
    </div>
  );
}

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    const errorHandler = (event) => {
      // Prevent crashes from propagating
      console.error('Global error caught:', event.error);
      // Don't prevent default to allow normal error reporting
    };

    const rejectionHandler = (event) => {
      // Handle unhandled promise rejections
      console.error('Unhandled promise rejection:', event.reason);
      // Prevent the default handler from running
      event.preventDefault();
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    let contextMenuHandler;
    let touchEndHandler;

    // Add mobile-specific error handling
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      // Disable context menu on long press to prevent crashes
      contextMenuHandler = (e) => {
        e.preventDefault();
        return false;
      };
      document.addEventListener('contextmenu', contextMenuHandler);

      // Prevent double-tap zoom which can cause issues
      let lastTouchEnd = 0;
      touchEndHandler = (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          event.preventDefault();
        }
        lastTouchEnd = now;
      };
      document.addEventListener('touchend', touchEndHandler, false);
    }

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
      if (contextMenuHandler) {
        document.removeEventListener('contextmenu', contextMenuHandler);
      }
      if (touchEndHandler) {
        document.removeEventListener('touchend', touchEndHandler);
      }
    };
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        // Log to console in development
        console.error('Application Error:', error);
        console.error('Error Info:', errorInfo);

        // Send to Sentry (if configured)
        if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
          Sentry.captureException(error, {
            contexts: {
              react: {
                componentStack: errorInfo.componentStack,
              },
            },
          });
        }
      }}
      onReset={() => {
        // Reset app state if needed
        window.location.href = '/';
      }}
    >
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}

export default MyApp;
