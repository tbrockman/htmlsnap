/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Check if the message is targeted to the offscreen document and is the perform-copy action
    if (message.target === 'offscreen' && message.action === 'perform-copy') {
        if (typeof message.text === 'string') {
            const textToCopy = message.text;

            console.debug('Offscreen: Received text to copy:', textToCopy);

            // --- Use document.execCommand('copy') ---
            // 1. Create a temporary textarea element
            const textArea = document.createElement('textarea');
            textArea.value = textToCopy; // Set its value to the text we want to copy
            document.body.appendChild(textArea);

            // 2. Focus and select the text
            textArea.focus();
            textArea.select();

            let success = false;
            let errorMsg = null;

            // 3. Execute the copy command
            try {
                success = document.execCommand('copy'); // This is the core command
                if (success) {
                    console.debug('Offscreen: Text copied successfully using execCommand.');
                } else {
                    // execCommand can return false if copy is not supported or disallowed
                    errorMsg = "document.execCommand('copy') returned false. Copy might be disallowed or unsupported.";
                    console.error('Offscreen:', errorMsg);
                }
            } catch (err: any) {
                // Catch any unexpected errors during the command execution
                success = false;
                // Log the specific error name and message for better debugging
                errorMsg = `Error during execCommand: ${err?.name} - ${err?.message}`;
                console.error('Offscreen:', errorMsg, err);
            } finally {
                // 4. Clean up the temporary element
                document.body.removeChild(textArea);

                // 5. Send the response back to the background script
                sendResponse({ success: success, error: errorMsg });
            }
            // --- End of execCommand logic ---

        } else {
            console.error('Offscreen: Received invalid text type.');
            sendResponse({ success: false, error: 'Invalid text received by offscreen document' });
        }
    }
    return true;

});