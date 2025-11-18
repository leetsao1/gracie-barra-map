import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Store error details in state
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // You can also log the error to an error reporting service here
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Reload the page to reset the app state
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          backgroundColor: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            maxWidth: '600px',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px'
            }}>⚠️</div>
            
            <h1 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '12px'
            }}>
              Something went wrong
            </h1>
            
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              marginBottom: '24px',
              lineHeight: '1.5'
            }}>
              We're sorry, but something unexpected happened. The error has been logged and we'll look into it.
            </p>

            <button
              onClick={this.handleReset}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: '16px'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
            >
              Reload Page
            </button>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                marginTop: '24px',
                textAlign: 'left',
                backgroundColor: '#fef2f2',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #fecaca'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: '500',
                  color: '#dc2626',
                  marginBottom: '8px'
                }}>
                  Error Details (Development Only)
                </summary>
                <pre style={{
                  fontSize: '12px',
                  color: '#991b1b',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

