/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// Function to setup or get the offscreen document
async function setupOffscreenDocument(path: string) {
    // Added console log
    console.log("Background: Checking for existing offscreen document...");
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
        documentUrls: [chrome.runtime.getURL(path)]
    });

    if (existingContexts.length > 0) {
        // Added console log
        console.log("Background: Offscreen document already exists.");
        return; // Offscreen document already exists
    }

    // Added console log
    console.log("Background: Attempting to create offscreen document...");
    try {
        await chrome.offscreen.createDocument({
            url: path,
            reasons: ['CLIPBOARD'],
            justification: 'Needed to copy text to the clipboard',
        });
        // Added console log
        console.log("Background: createDocument call completed (request sent).");
        // Note: Creation might take a moment after this promise resolves.
    } catch (error) {
        // Added specific logging for creation error
        console.error("Background: Error creating offscreen document:", error);
        throw error; // Re-throw the error to be caught by the main handler
    }
}

// Listen for messages from other parts of the extension (like devtools.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handle = async () => {

        // Log message reception for ALL messages initially
        console.log("Background: Received message:", JSON.stringify(message), "from:", sender.tab ? `tab ${sender.tab.id}` : "extension context");

        // Only handle messages meant for background copy action
        if (message.action === 'copy-to-clipboard') {
            console.log("Background: Handling 'copy-to-clipboard'.");

            // Validate input
            if (typeof message.text !== 'string') {
                console.error('Background: Invalid text received.');
                sendResponse({ success: false, error: 'Invalid text' });
            }

            try {
                console.log("Background: (Try Block) Calling setupOffscreenDocument...");
                await setupOffscreenDocument('offscreen.html');
                console.log("Background: (Try Block) setupOffscreenDocument finished.");

                console.log("Background: (Try Block) Sending 'perform-copy' message to offscreen...");
                const responseFromOffscreen = await chrome.runtime.sendMessage({
                    target: 'offscreen',
                    action: 'perform-copy',
                    text: message.text
                });
                // Log the specific response received
                console.log("Background: (Try Block) Received response from offscreen:", JSON.stringify(responseFromOffscreen));

                // Check if response looks valid before sending
                if (responseFromOffscreen && typeof responseFromOffscreen.success === 'boolean') {
                    console.log("Background: (Try Block) Sending final response back to devtools:", JSON.stringify(responseFromOffscreen));
                    sendResponse(responseFromOffscreen);
                    console.log("Background: (Try Block) Final response sent to devtools.");
                } else {
                    // Handle cases where the response from offscreen is malformed
                    console.error("Background: (Try Block) Received invalid response structure from offscreen:", responseFromOffscreen);
                    sendResponse({ success: false, error: "Invalid response from offscreen document" });
                    console.log("Background: (Try Block) Malformed response error sent to devtools.");
                }

            } catch (error: any) {
                // Catch errors from setupOffscreenDocument or sendMessage to offscreen
                console.error('Background: (Catch Block) Error handling copy request:', error.name, error.message, error.stack);
                console.log("Background: (Catch Block) Sending error response back to devtools...");
                sendResponse({ success: false, error: `Background script error: ${error.message}` });
                console.log("Background: (Catch Block) Error response sent to devtools.");
            }
            sendResponse({ success: true });
        } else if (message.target === 'offscreen') {
            // Ignore messages clearly intended for the offscreen doc within this listener
            console.log("Background: Ignoring message targeted to offscreen.");
            // Do not return true here, let the offscreen listener handle it.
        } else {
            // Log unhandled actions for debugging
            console.log("Background: Message action not handled:", message.action);
            // No response needed for these actions, port can close.
            // return false; // or allow implicit undefined return
        }
    }
    handle();
    return true;
});

// Log when the service worker starts/wakes up
console.log("Background service worker started or woken up at:", new Date().toLocaleTimeString());

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed or updated.");
});

chrome.runtime.onSuspend.addListener(() => {
    console.log("Background service worker suspending.");
});