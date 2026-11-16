/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

if (process.env.NODE_ENV === "production") {
  if (!process.env.NEXT_PUBLIC_API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL must be configured for production builds.");
  }
  const parsedApiUrl = new URL(apiUrl);
  if (parsedApiUrl.protocol !== "https:" ||
      parsedApiUrl.hostname === "localhost" ||
      parsedApiUrl.hostname === "example.com" ||
      parsedApiUrl.hostname.endsWith(".example.com")) {
    throw new Error("NEXT_PUBLIC_API_URL must use a production HTTPS API origin.");
  }
}

const nextConfig = {
  turbopack: {
    root: process.cwd()
  },
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_PUBLIC_REGISTRATION_ENABLED: process.env.NEXT_PUBLIC_PUBLIC_REGISTRATION_ENABLED || "false"
  }
};

export default nextConfig;