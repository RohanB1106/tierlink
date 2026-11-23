import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Old links (pitch decks, Devpost) keep working.
      { source: "/ask", destination: "/chatbot", permanent: true },
    ];
  },
};

export default nextConfig;
