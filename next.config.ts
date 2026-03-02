import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  hideSourceMaps: true,
};

const sentryBuildPluginEnabled = process.env.SENTRY_ENABLE_BUILD_PLUGIN === "1";

export default sentryBuildPluginEnabled ? withSentryConfig(nextConfig, sentryOptions) : nextConfig;
