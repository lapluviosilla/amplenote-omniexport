import { defineConfig } from "vitest/config";
import string from "vite-plugin-string"; // Only if using Option 2 below

import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const mediaTypes = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "avif", "webp"];
export default defineConfig({
  test: {
    assetsInlineLimit: Infinity,
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
    {
      name: "media-to-data-url",
      enforce: "pre",
      load(id) {
        for (const mediaType of mediaTypes) {
          if (id.endsWith(`.${mediaType}`)) {
            const src = fs.readFileSync(id).toString("base64");
            return `export default "data:image/${mediaType};base64,${src}"`;
          }
        }
      },
    },
  ],
});
