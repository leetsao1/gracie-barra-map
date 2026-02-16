// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter out errors we don't care about
  beforeSend(event, hint) {
    // Don't send errors if Sentry is not configured
    if (!SENTRY_DSN) {
      return null;
    }

    // Filter out certain errors
    const error = hint.originalException;

    // Ignore MapboxGL worker errors (these are usually harmless)
    if (error && error.message && error.message.includes('mapbox')) {
      return null;
    }

    return event;
  },

  environment: process.env.NODE_ENV,
});
