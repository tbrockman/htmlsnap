/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import inspectedElementToJSON from "funcstr:./dom";
import CleanCSS from 'clean-css';
import { DomUtils } from "./utils";
import { basicSetup, EditorView } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { html } from "@codemirror/lang-html";
import { Compartment } from "@codemirror/state";

const cleanCSS = new CleanCSS({
    level: 2,
    format: 'keep-breaks',
    inline: ['all'],
});

let editorView: EditorView | null = null;

const isDarkMode = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

const getTheme = () =>
    isDarkMode()
        ? oneDark
        : EditorView.theme({}, { dark: false });
const themeCompartment = new Compartment;

const editor = () => {
    if (!editorView) {
        const parent = document.querySelector("#codemirror");
        if (!parent) throw new Error("Element #codemirror not found");

        editorView = new EditorView({
            doc: "<div>Loading...</div>",
            extensions: [
                basicSetup,
                html(),
                themeCompartment.of(getTheme())
            ],
            parent,
        });

        // Listen for theme changes
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            editorView!.dispatch({
                effects: themeCompartment.reconfigure(getTheme())
            });
        });
    }
    return editorView;
};

async function updateSidebar() {

    chrome.devtools.inspectedWindow.eval(
        inspectedElementToJSON,  // This is now an executable string
        (result, exceptionInfo) => {
            if (exceptionInfo && exceptionInfo.isException) {
                const preview = document.getElementById('preview');
                if (!preview) {
                    console.error("Could not find preview element.");
                    return;
                }
                preview.innerText = `<Error retrieving element: ${JSON.stringify(exceptionInfo)}>`;
                console.error("Exception evaluating element:", exceptionInfo);
                return;
            }

            const { html, css } = JSON.parse(result as string)

            // Use CleanCSS to minify the CSS rules
            const cleaned = cleanCSS.minify(css);
            console.debug({ cleaned })

            if (cleaned?.errors?.length > 0) {
                console.error("CSS minification errors:", cleaned.errors);
            }

            const previewParent = document.getElementById('preview')?.parentElement;
            if (!previewParent) {
                console.error("Could not find preview parent element.");
                return;
            }

            // Create new container with same ID for replacement
            const newPreview = DomUtils.hydrate(html as string, cleaned.styles)
            newPreview.id = 'preview';

            // Replace old preview with new one
            const oldPreview = document.getElementById('preview');
            oldPreview?.replaceWith(newPreview);
            editor().dispatch({ changes: { insert: newPreview.outerHTML, from: 0, to: editor().state.doc.length } })
        }
    );
}

// Set up everything after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    editor();
    chrome.devtools.panels.elements.onSelectionChanged.addListener(updateSidebar);
    updateSidebar();
});