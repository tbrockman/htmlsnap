/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import serializeElementForDevTools from "funcstr:./dom";
import CleanCSS from 'clean-css';

const cleanCSS = new CleanCSS({
    level: 2,
    format: 'keep-breaks', // Preserve some readability
    inline: ['all'], // Don't process external resources
});

const copyBtn = document.getElementById('copy');

async function updateSidebar() {

    chrome.devtools.inspectedWindow.eval(
        // @ts-ignore
        serializeElementForDevTools,  // This is now an executable string
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

            console.debug({ html, css, parse: JSON.parse(result as string) });
            // Use CleanCSS to minify the CSS rules
            const cleaned = cleanCSS.minify(css);

            if (cleaned?.errors?.length > 0) {
                console.error("CSS minification errors:", cleaned.errors);
            }

            const previewParent = document.getElementById('preview')?.parentElement;
            if (!previewParent) {
                console.error("Could not find preview parent element.");
                return;
            }

            // Create new container with same ID for replacement
            const newPreview = document.createElement('div');
            newPreview.id = 'preview';

            // Create a template to parse the HTML
            const template = document.createElement('template');
            template.innerHTML = html as string;
            newPreview.appendChild(template.content);

            // Apply the cleaned CSS as a style element
            const style = document.createElement('style');
            style.innerHTML = cleaned.styles;
            newPreview.appendChild(style);

            // Replace old preview with new one
            const oldPreview = document.getElementById('preview');
            oldPreview?.replaceWith(newPreview);

            // @ts-ignore
            window.view?.dispatch({ changes: { insert: newPreview.outerHTML, from: 0, to: window?.view.state.doc.length } })
        }
    );
}

copyBtn?.addEventListener('click', () => {

    const preview = document.getElementById('preview');
    const raw = preview?.getHTML();

    // Send message to background script to handle the copy
    chrome.runtime.sendMessage(
        { action: 'copy-to-clipboard', text: raw },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error("DevTools: Error sending copy message:", chrome.runtime.lastError.message);
                copyBtn.textContent = 'Error!';
                setTimeout(() => (copyBtn.textContent = 'Copy to clipboard'), 2500);
            } else if (response && response.success) {
                copyBtn.textContent = 'Copied!';
                console.log("DevTools: Copy successful (via background).");
                setTimeout(() => (copyBtn.textContent = 'Copy to clipboard'), 1500);
            } else {
                console.error("DevTools: Copy failed (reported by background):", response?.error || 'Unknown error');
                copyBtn.textContent = 'Copy Failed!';
                setTimeout(() => (copyBtn.textContent = 'Copy to clipboard'), 2500);
            }
        }
    );
});

chrome.devtools.panels.elements.createSidebarPane("Styled HTML", (sidebar) => {
    sidebar.setPage("devtools.html");

    // Refresh the page when the panel is shown
    sidebar.onShown.addListener(updateSidebar);
});
chrome.devtools.panels.elements.onSelectionChanged.addListener(updateSidebar);

updateSidebar();