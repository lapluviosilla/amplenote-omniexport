import { defineConfig } from "vitest/config";
import string from "vite-plugin-string"; // Only if using Option 2 below

import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      include: ["lib/**"],
      exclude: [
        "coverage/**",
        "dist/**",
        "build/**",
        "**/node_modules/**",
        "**/__mocks__/**",
        "test?(-*).?(c|m)[jt]s?(x)",
        "**/*{.,-}{test,spec,bench,benchmark}?(-d).?(c|m)[jt]s?(x)",
        "lib/test-helpers.js",
        "lib/streamSaver.js",
      ],
    },
  },
  plugins: [
    // Only if using Option 2 below
    string({
      include: "**/*.html",
    }),
  ],
});
