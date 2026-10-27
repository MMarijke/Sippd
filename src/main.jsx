import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from '@/App.jsx'
import '@/index.css'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Strip PII — never log email, name, or user-identifiable data
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    return event;
  },
})

const ErrorFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center px-5 text-center">
    <div className="space-y-3">
      <p className="text-lg font-display font-bold text-foreground">
        Something went wrong
      </p>
      <p className="text-sm font-mono text-muted-foreground">
        Refresh the page to try again
      </p>
      <button
        onClick={() => window.location.reload()}
        className="text-xs font-mono text-primary underline"
      >
        Refresh
      </button>
    </div>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <App />
  </Sentry.ErrorBoundary>
)
