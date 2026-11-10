import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  distDir: process.env.NEXT_TEST_DIST_DIR || ".next",
};
export default config;
