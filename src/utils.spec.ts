/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { DomUtils, ElementSerdeMode } from './utils'; // adjust as needed
import { describe, test, expect, beforeEach } from 'vitest'; // or use Jest
import { JSDOM } from 'jsdom';

describe('DomUtils', () => {

    describe('elementToJSON', () => {
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

        test('converts element to JSON', () => {
            const serialized = DomUtils.elementToJSON(container, { mode: ElementSerdeMode.INLINE_STYLES });
            const json = JSON.parse(serialized);
            expect(json).toHaveProperty('html');
            expect(json).toHaveProperty('css');
            expect(typeof json.html).toBe('string');
            expect(typeof json.css).toBe('string');
        });
    })

    describe('snapshotElement', () => {
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
            const { classes, css, element } = DomUtils.snapshotElement(container);

            // Basic shape check
            expect(classes).toBeDefined();
            expect(css).toBeDefined();
            expect(element).toBeDefined();
            expect(Array.isArray(classes)).toBe(true);
            expect(typeof css === 'string').toBe(true);
            expect(element).toBeInstanceOf(window.HTMLElement);

            // Should generate CSS rules
            expect(css.length).toBeGreaterThan(0);
            console.log(css)
            expect(css.split('\n')[0]).toMatch(/^\.\S+\s*{/); // `.🇨🇦0 { ... }`

            // Check that elements got classes
            const classCount = classes.length;
            expect(classCount).toBeGreaterThan(0);
        });
    })

});
