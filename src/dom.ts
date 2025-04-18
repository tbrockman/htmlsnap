/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { DomUtils, ElementSerdeMode } from "./utils";

declare const $0: Element;

// Export a function that will be properly invoked in the DevTools context
export default function serializeElementForDevTools() {
    // Function body is intact, but will be called within an IIFE wrapper
    const element = $0;
    if (!element) {
        console.error("No element selected in the Elements panel.");
        return {
            html: '<div><b>Oops!</b> No element selected in the Elements panel</div>',
            css: ''
        };
    }
    return DomUtils.serializeElement(element as HTMLElement, { mode: ElementSerdeMode.INLINE_STYLES });
}