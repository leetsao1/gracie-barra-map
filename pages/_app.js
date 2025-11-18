import "../styles/globals.css";
import { ErrorBoundary } from 'react-error-boundary';
import * as Sentry from '@sentry/nextjs';

// Global error handler for mobile crash prevention
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // Prevent crashes from propagating
    console.error('Global error caught:', event.error);
    // Don't prevent default to allow normal error reporting
  });

  window.addEventListener('unhandledrejection', (event) => {
    // Handle unhandled promise rejections
    console.error('Unhandled promise rejection:', event.reason);
    // Prevent the default handler from running
    event.preventDefault();
  });

  // Add mobile-specific error handling
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    // Disable context menu on long press to prevent crashes
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // Prevent double-tap zoom which can cause issues
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  }
}

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
