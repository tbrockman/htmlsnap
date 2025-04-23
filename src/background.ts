/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// Function to setup or get the offscreen document
async function setupOffscreenDocument(path: string) {
    console.debug("Background: Checking for existing offscreen document...");
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
        documentUrls: [chrome.runtime.getURL(path)]
    });

    if (existingContexts.length > 0) {
        console.debug("Background: Offscreen document already exists.");
        return; // Offscreen document already exists
    }

    console.debug("Background: Attempting to create offscreen document...");
    try {
        await chrome.offscreen.createDocument({
            url: path,
            reasons: ['CLIPBOARD'],
            justification: 'Needed to copy text to the clipboard',
        });
        console.debug("Background: createDocument call completed (request sent).");
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
        console.debug("Background: Received message:", JSON.stringify(message), "from:", sender.tab ? `tab ${sender.tab.id}` : "extension context");

        // Only handle messages meant for background copy action
        if (message.action === 'copy-to-clipboard') {
            console.debug("Background: Handling 'copy-to-clipboard'.");

            // Validate input
            if (typeof message.text !== 'string') {
                console.error('Background: Invalid text received.');
                sendResponse({ success: false, error: 'Invalid text' });
            }

            try {
                console.debug("Background: (Try Block) Calling setupOffscreenDocument...");
                await setupOffscreenDocument('offscreen.html');
                console.debug("Background: (Try Block) setupOffscreenDocument finished.");

                console.debug("Background: (Try Block) Sending 'perform-copy' message to offscreen...");
                const responseFromOffscreen = await chrome.runtime.sendMessage({
                    target: 'offscreen',
                    action: 'perform-copy',
                    text: message.text
                });
                // Log the specific response received
                console.debug("Background: (Try Block) Received response from offscreen:", JSON.stringify(responseFromOffscreen));

                // Check if response looks valid before sending
                if (responseFromOffscreen && typeof responseFromOffscreen.success === 'boolean') {
                    console.debug("Background: (Try Block) Sending final response back to devtools:", JSON.stringify(responseFromOffscreen));
                    sendResponse(responseFromOffscreen);
                    console.debug("Background: (Try Block) Final response sent to devtools.");
                } else {
                    // Handle cases where the response from offscreen is malformed
                    console.error("Background: (Try Block) Received invalid response structure from offscreen:", responseFromOffscreen);
                    sendResponse({ success: false, error: "Invalid response from offscreen document" });
                    console.debug("Background: (Try Block) Malformed response error sent to devtools.");
                }

            } catch (error: any) {
                // Catch errors from setupOffscreenDocument or sendMessage to offscreen
                console.error('Background: (Catch Block) Error handling copy request:', error.name, error.message, error.stack);
                console.debug("Background: (Catch Block) Sending error response back to devtools...");
                sendResponse({ success: false, error: `Background script error: ${error.message}` });
                console.debug("Background: (Catch Block) Error response sent to devtools.");
            }
            sendResponse({ success: true });
        } else if (message.target === 'offscreen') {
            // Ignore messages clearly intended for the offscreen doc within this listener
            console.debug("Background: Ignoring message targeted to offscreen.");
            // Do not return true here, let the offscreen listener handle it.
        } else {
            // Log unhandled actions for debugging
            console.debug("Background: Message action not handled:", message.action);
            // No response needed for these actions, port can close.
            // return false; // or allow implicit undefined return
        }
    }
    handle();
    return true;
});
