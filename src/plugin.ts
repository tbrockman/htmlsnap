/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Plugin } from 'vite';
import { build } from 'esbuild';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Options for the function-to-string plugin
 */
interface FunctionToStringOptions {
    /**
     * The import prefix that triggers the transformation
     * @default "iife:"
     */
    importPrefix?: string;
}

/**
 * Creates a Vite plugin that transforms imports with a special prefix into
 * string representations of the compiled functions.
 */
export default function functionToStringPlugin(options: FunctionToStringOptions = {}): Plugin {
    const importPrefix = options.importPrefix || 'iife:';

    return {
        name: 'vite-plugin-function-to-string',

        async resolveId(id, importer) {
            // Check if this import uses our special prefix
            if (id.startsWith(importPrefix)) {
                const realPath = id.slice(importPrefix.length);
                // Resolve the real path of the module
                const resolved = await this.resolve(realPath, importer);
                if (resolved) {
                    // Mark it with a query param so we can identify it in the load hook
                    return `${resolved.id}?function-to-string`;
                }
            }
            return null;
        },

        async load(id) {
            // Check if this is one of our marked modules
            if (id.includes('?function-to-string')) {
                const realPath = id.split('?')[0];
                const fileContent = readFileSync(realPath, 'utf-8');

                // First, analyze the file to find the export name
                let mainExportName = 'default';
                const exportMatch = fileContent.match(/export\s+default\s+function\s+(\w+)/);
                if (exportMatch && exportMatch[1]) {
                    mainExportName = exportMatch[1];
                }

                // Use esbuild to bundle the file and its dependencies
                const result = await build({
                    stdin: {
                        contents: fileContent,
                        loader: path.extname(realPath).slice(1) as 'ts' | 'js',
                        resolveDir: path.dirname(realPath),
                    },
                    bundle: true,
                    write: false,
                    format: 'iife',
                    globalName: 'BundledModule', // Export to a global variable
                    minify: true,
                    target: 'esnext',
                });

                // Extract the bundled code
                const bundledCode = result.outputFiles[0].text;

                // Create a properly structured IIFE that executes the function and returns its result
                const executableCode = `
(function() {
    // Include the bundled module code
    ${bundledCode}
    
    // Execute the main function directly with access to $0
    const element = $0;
    if (!element) {
        console.error("No element selected in the Elements panel.");
        return JSON.stringify({
            html: "<div><b>Oops!</b> No element selected in the Elements panel</div>",
            css: ""
        });
    }
    
    try {
        // Access the bundled function
        const fn = BundledModule.default || BundledModule.${mainExportName};
        if (typeof fn !== 'function') {
            console.error("Could not find exported function in bundled module");
            return JSON.stringify({
                html: "<div><b>Error:</b> Serializer function not found</div>",
                css: ""
            });
        }
        
        // Execute the function with the selected element
        const result = fn(element);
        return result;
    } catch (err) {
        console.error("Error executing bundled function:", err);
        return JSON.stringify({
            html: "<div><b>Error:</b> " + err.message + "</div>",
            css: ""
        });
    }
})()`;

                // Return a module that exports the executable code as a string
                return `export default ${JSON.stringify(executableCode)};`;
            }
            return null;
        }
    };
}