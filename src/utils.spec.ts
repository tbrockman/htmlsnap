/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { DomUtils, ElementSerdeMode } from './utils'; // adjust as needed
import { describe, test, expect, beforeEach } from 'vitest'; // or use Jest
import { JSDOM } from 'jsdom';

describe('DomUtils', () => {

    describe.only('serializeElement', () => {
        let container: HTMLElement;

        beforeEach(() => {
            const dom = new JSDOM(`<div id="root">
          <div style="color: red;">Red</div>
          <div style="color: blue;">Blue</div>
          <div style="color: red;">Also Red</div>
        </div>`, { pretendToBeVisual: true });

            // Mock global document/window
            global.window = dom.window as unknown as Window & typeof globalThis;
            global.document = dom.window.document;

            container = document.getElementById('root')!;
        });

        test('serializes html', () => {
            const serialized = DomUtils.serializeElement(container, { mode: ElementSerdeMode.INLINE_STYLES });

            console.log(serialized)

        });
    })

    describe('groupByComputedStyles', () => {
        let container: HTMLElement;

        beforeEach(() => {
            const dom = new JSDOM(`<div id="root">
          <div style="color: red;">Red</div>
          <div style="color: blue;">Blue</div>
          <div style="color: red;">Also Red</div>
        </div>`, { pretendToBeVisual: true });

            // Mock global document/window
            global.window = dom.window as unknown as Window & typeof globalThis;
            global.document = dom.window.document;

            container = document.getElementById('root')!;
        });

        test('groups elements by computed styles and returns CSS rules', () => {
            const { classes, css, element, elementToClassMap } = DomUtils.groupByComputedStyles(container);

            // Basic shape check
            expect(classes).toBeDefined();
            expect(css).toBeDefined();
            expect(element).toBeDefined();
            expect(elementToClassMap).toBeDefined()
            expect(Array.isArray(classes)).toBe(true);
            expect(Array.isArray(css)).toBe(true);
            expect(element).toBeInstanceOf(window.HTMLElement);

            // Should generate CSS rules
            expect(css.length).toBeGreaterThan(0);
            expect(css[0]).toMatch(/^\.\S+\s*{/); // `.🇨🇦0 { ... }`

            // Check that elements got classes
            const classCount = classes.length;
            expect(classCount).toBeGreaterThan(0);
        });
    })

});
