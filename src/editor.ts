/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { EditorView, basicSetup } from "codemirror";
import { html } from "@codemirror/lang-html";

const mountCodeMirror = () => {
    const mount = document.querySelector("#codemirror");
    if (!mount) {
        throw new Error("Element #codemirror not found");
    }

    const view = new EditorView({
        doc: "<!DOCTYPE html>\n<html>\n  <head>\n    <title>Example</title>\n  </head>\n  <body>\n    <h1>Hello, CodeMirror!</h1>\n  </body>\n</html>",
        extensions: [basicSetup, html()],
        parent: mount,
    });
    return view;
};

// @ts-ignore
window.view = mountCodeMirror();