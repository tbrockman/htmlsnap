/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { defineConfig } from "vite";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import functionToStringPlugin from "./src/plugin";

export default defineConfig({
    build: {
        outDir: "dist",
        rollupOptions: {
            input: {
                background: "src/background.ts",
                devtools: "src/devtools.ts",
                offscreen: "src/offscreen.ts",
                editor: "src/editor.ts",
            },
            output: {
                entryFileNames: "[name].js",
                extend: true,
            }
        },
        emptyOutDir: true
    },
    plugins: [
        functionToStringPlugin({
            importPrefix: 'funcstr:'
        }),
        nodePolyfills({
            // To exclude specific polyfills, list them here
            exclude: [
                'fs', // Excludes the polyfill for `fs` and `node:fs`
            ],
            // Whether to polyfill specific globals
            globals: {
                process: true,
            },
        })
    ],
});