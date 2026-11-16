/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";
const apiBackendOrigin = process.env.API_BACKEND_ORIGIN;
const apiUrl = process.env.NEXT_PUBLIC_API_URL || (isProduction ? "/api" : "http://localhost:4000/api");

if (isProduction) {
  if (!apiBackendOrigin) {
    throw new Error("API_BACKEND_ORIGIN must be configured for production builds.");
  }
  const parsedApiBackendOrigin = new URL(apiBackendOrigin);
  if (parsedApiBackendOrigin.protocol !== "https:" ||
      parsedApiBackendOrigin.origin !== apiBackendOrigin ||
      parsedApiBackendOrigin.hostname === "localhost" ||
      parsedApiBackendOrigin.hostname === "example.com" ||
      parsedApiBackendOrigin.hostname.endsWith(".example.com")) {
    throw new Error("API_BACKEND_ORIGIN must be a production HTTPS origin without a trailing path or slash.");
  }
  if (apiUrl !== "/api") {
    throw new Error("NEXT_PUBLIC_API_URL must be /api so requests use the same-origin Vercel proxy.");
  }
}

const nextConfig = {
  turbopack: {
    root: process.cwd()
  },
  async rewrites() {
    if (!apiBackendOrigin) return [];
    return [{
      source: "/api/:path*",
      destination: `${apiBackendOrigin}/api/:path*`
    }];
  },
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_PUBLIC_REGISTRATION_ENABLED: process.env.NEXT_PUBLIC_PUBLIC_REGISTRATION_ENABLED || "false"
  }
};

export default nextConfig;