/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export enum ElementSerdeMode {
    INLINE_STYLES = 0,
    // PARSE_CSS = 1 // Future mode: parse CSS rather than using computed styles
}
export type ElementToJSONOptions = {
    mode?: ElementSerdeMode;
}

export namespace DomUtils {

    export const HANDLED_PSEUDO_ELEMENTS = ['::before', '::after'];
    // TODO: potential optimization, encode as UTF16 codepoints instead of using number.toString()
    let ELEMENT_ID = 0;

    function getNextElementId(): string {
        return (ELEMENT_ID++).toString();
    }

    function isPseudoElementVisible(style: CSSStyleDeclaration): boolean {
        if (style.content === 'none') return false;
        if (style.display === 'none' || style.visibility === 'hidden') return false;

        const width = parseFloat(style.width);
        const height = parseFloat(style.height);
        const fontSize = parseFloat(style.fontSize);

        if (width > 0 || height > 0 || fontSize > 0) return true;

        const contentValue = style.content.replace(/['"]/g, '').trim();
        return contentValue.length > 0;
    }

    export function snapshotElement(element: HTMLElement) {
        const clone = element.cloneNode(true) as HTMLElement
        const styleToElementIds = new Map<string, Set<string>>()
        const elementIdsToStyles = new Map<string, Set<string>>()
        const elementToId = new Map<HTMLElement, string>()
        const idToElement = new Map<string, HTMLElement>()

        function gatherStyles(element: HTMLElement, clone: HTMLElement) {
            // Remove existing classes from clone as they'll be redundant
            clone.removeAttribute('class');
            let elementId = elementToId.get(clone);

            if (!elementId) {
                elementId = getNextElementId();

                const targetsToStyles: { [key: string]: CSSStyleDeclaration | undefined } = {
                    [elementId]: window.getComputedStyle(element)
                };

                for (const pseudo of HANDLED_PSEUDO_ELEMENTS) {
                    const pseudoStyle = window.getComputedStyle(element, pseudo);
                    if (isPseudoElementVisible(pseudoStyle)) {
                        targetsToStyles[`${elementId}${pseudo}`] = pseudoStyle;
                    }
                }
                elementToId.set(clone, elementId)

                for (const elementId in targetsToStyles) {
                    idToElement.set(elementId, clone);
                    const styles = targetsToStyles[elementId]!;

                    for (let i = 0; i < styles.length; i++) {
                        const prop = styles[i];

                        // Skip CSS variable declarations, as they are not needed in the final output
                        if (prop.startsWith('--')) {
                            continue;
                        }

                        const value = styles.getPropertyValue(prop);
                        const style = `${prop}:${value};`
                        const set = styleToElementIds.get(style);

                        if (set) {
                            set.add(elementId)
                        } else {
                            styleToElementIds.set(style, new Set([elementId]))
                        }
                    }
                }
            }

            const children = Array.from(element.children)
            const clones = Array.from(clone.children)

            children.forEach((e, i) => gatherStyles(e as HTMLElement, clones[i] as HTMLElement))
        }
        gatherStyles(element, clone)

        styleToElementIds.forEach((elementIds, style) => {
            const ids = Array.from(elementIds).sort().join(',')
            const elements = elementIdsToStyles.get(ids)

            if (elements) {
                elementIdsToStyles.set(ids, elements.add(style))
            } else {
                elementIdsToStyles.set(ids, new Set([style]))
            }
        })
        let counter = 0;
        const classes: string[] = [];
        const rules: string[] = [];

        elementIdsToStyles.forEach((styles, ids) => {
            const targets: { [t: string]: string } = {
                base: `🫰${counter}`
            };
            classes.push(targets.base);

            const splitIds = ids.split(',');
            splitIds.forEach(id => {
                const e = idToElement.get(id)!
                const [_, pseudo] = id.split('::');
                let className = targets.base;

                // TODO: potential optimization:
                // rather than create a new class for each pseudo-element,
                // we could potentially reuse existing classes on parent elements
                // (if an existing combination of classes exists to match all pseudo-element parents)
                if (pseudo) {
                    // The class for the parent of the pseudo-element
                    className += 'p';
                    if (!(pseudo in targets)) {
                        classes.push(className);
                        // The rule target for the pseudo-element
                        targets[pseudo] = `${className}::${pseudo}`;
                    }
                }
                e.classList.add(className);
            })

            const selector = Object.entries(targets)
                .filter(([_, v]) => v)
                .map(([_, v]) => `.${v}`)
                .join(', ');
            const rule = `${selector} { ${Array.from(styles).join('')} }`
            rules.push(rule)

            counter++;
        })

        return {
            classes,
            css: rules.join('\n'),
            element: clone
        }
    }

    export function hydrate(html: string, css: string): HTMLElement {
        const element = document.createElement('div')

        const template = document.createElement('template');
        template.innerHTML = html;
        element.appendChild(template.content);

        const style = document.createElement('style');
        style.innerHTML = css;
        element.appendChild(style);

        return element;
    }

    /**
     * Normalizes resource URL protocols to HTTPS (i.e, convert <img src="//example.com"> to <img src="https://example.com">) for a given element and its descendants.
     * @param element The root element to normalize resource URLs for
     */
    export function normalizeResourceURLs(element: HTMLElement): void {
        // Helper to normalize a single attribute
        const normalizeAttr = (el: HTMLElement, attr: string) => {
            const val = el.getAttribute(attr);
            if (val?.startsWith('//')) {
                el.setAttribute(attr, `https:${val}`);
            }
        };

        // img[src]
        element.querySelectorAll('img').forEach(img => normalizeAttr(img, 'src'));

        // a[href]
        element.querySelectorAll('a').forEach(link => normalizeAttr(link, 'href'));

        // script[src]
        element.querySelectorAll('script').forEach(script => normalizeAttr(script, 'src'));

        // iframe[src]
        element.querySelectorAll('iframe').forEach(iframe => normalizeAttr(iframe, 'src'));

        // link[href] (for stylesheets, icons)
        element.querySelectorAll('link').forEach(link => normalizeAttr(link, 'href'));

        // form[action]
        element.querySelectorAll('form').forEach(form => normalizeAttr(form, 'action'));

        // audio[src] and video[src]
        element.querySelectorAll('audio, video').forEach(media => normalizeAttr(media as HTMLMediaElement, 'src'));
    }

    function isTransparent(color: string): boolean {
        return color == '' || color === 'transparent' || /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(color);
    }

    /**
     * Finds the nearest non-transparent background color of an element or its ancestors.
     * @param element The element to check.
     * @returns The background color as a string.
     */
    export function findNearestBackgroundColor(element: HTMLElement): string {
        let color = 'transparent';
        let el: HTMLElement | null = element;

        while (
            el &&
            ((color = window.getComputedStyle(el).backgroundColor),
                isTransparent(color))
        ) {
            el = el.parentElement;
        }

        return color;
    }

    /**
     * Removes redundant attributes from an element and its descendants that don't contribute
     * to styling or accessibility.
     *
     * @param element The element to clean
     */
    export function removeUnusedAttributes(element: HTMLElement) {
        // Define attributes that should always be preserved for all elements
        const basePreserveAttributes = new Set([
            // Accessibility attributes
            'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-expanded', 'aria-hidden',
            'aria-live', 'aria-atomic', 'aria-relevant', 'aria-busy', 'aria-disabled',
            'aria-checked', 'aria-selected', 'aria-pressed', 'aria-current', 'aria-level',
            'aria-setsize', 'aria-posinset', 'aria-owns', 'aria-controls', 'aria-flowto',
            'role', 'alt', 'title', 'tabindex',

            // Functional/semantic attributes
            'name', 'for', 'href', 'src', 'srcset', 'sizes', 'type', 'value',
            'placeholder', 'disabled', 'readonly', 'required', 'checked', 'selected',
            'multiple', 'autocomplete', 'autofocus', 'pattern', 'min', 'max', 'step',
            'maxlength', 'minlength', 'rows', 'cols', 'wrap', 'accept', 'capture',
            'form', 'formaction', 'formenctype', 'formmethod', 'formnovalidate', 'formtarget',

            // Media and content attributes
            'width', 'height', 'loading', 'decoding', 'crossorigin', 'referrerpolicy',
            'integrity', 'media', 'rel', 'target', 'download', 'ping',

            // Table attributes with semantic meaning
            'colspan', 'rowspan', 'headers', 'scope',

            // List attributes
            'start', 'reversed', 'type',

            // Meta attributes
            'charset', 'content', 'http-equiv', 'property',

            // The new classes generated by snapshotElement
            'class'
        ]);

        // SVG-specific attributes that are crucial for visual rendering
        const svgPreserveAttributes = new Set([
            // SVG structural attributes
            'viewbox', 'xmlns', 'xmlns:xlink', 'version', 'baseprofile', 'contentscripttype', 'contentstyletype',

            // SVG geometric attributes
            'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height',
            'dx', 'dy', 'rotate', 'transform', 'pathlength',

            // SVG path attributes
            'd', 'pathdata',

            // SVG presentation attributes (these can affect visual appearance)
            'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity',
            'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
            'stroke-dashoffset', 'opacity', 'visibility', 'display', 'overflow',
            'clip-path', 'clip-rule', 'mask', 'filter', 'color', 'color-interpolation',
            'color-interpolation-filters', 'color-rendering', 'shape-rendering',
            'text-rendering', 'image-rendering', 'font-family', 'font-size', 'font-style',
            'font-weight', 'font-variant', 'text-anchor', 'text-decoration', 'letter-spacing',
            'word-spacing', 'writing-mode', 'direction', 'unicode-bidi', 'dominant-baseline',
            'alignment-baseline', 'baseline-shift', 'text-decoration', 'glyph-orientation-vertical',
            'glyph-orientation-horizontal', 'kerning', 'text-rendering',

            // SVG gradient and pattern attributes
            'gradientunits', 'gradienttransform', 'spreadmethod', 'patternunits', 'patterntransform',
            'patterncontentunits', 'offset', 'stop-color', 'stop-opacity',

            // SVG animation attributes
            'attributename', 'attributetype', 'begin', 'dur', 'end', 'min', 'max', 'restart',
            'repeatcount', 'repeatdur', 'fill', 'calcmode', 'values', 'keytimes', 'keysplines',
            'from', 'to', 'by', 'additive', 'accumulate',

            // SVG linking and references
            'href', 'xlink:href', 'xlink:type', 'xlink:role', 'xlink:arcrole', 'xlink:title',
            'xlink:show', 'xlink:actuate',

            // SVG text attributes
            'text-anchor', 'textlength', 'lengthadjust', 'startoffset', 'method', 'spacing',

            // SVG filter and effect attributes
            'in', 'in2', 'result', 'operator', 'k1', 'k2', 'k3', 'k4', 'dx', 'dy', 'stddeviation',
            'edgemode', 'kernelmatrix', 'divisor', 'bias', 'targetx', 'targety', 'tablevalues',
            'slope', 'intercept', 'amplitude', 'exponent', 'seed', 'stitchtiles', 'type',
            'values', 'mode', 'scale', 'xchannelselector', 'ychannelselector', 'diffuseconstant',
            'specularconstant', 'specularexponent', 'limitingconeangle', 'pointsatx', 'pointsaty',
            'pointsatz', 'azimuth', 'elevation', 'surfacescale', 'kernelunitlength',

            // SVG marker attributes
            'markerunits', 'markerwidth', 'markerheight', 'orient', 'refx', 'refy',

            // SVG clipping and masking
            'clippathtunits', 'maskunits', 'maskcontentunits',

            // SVG symbol and use attributes
            'preserveaspectratio', 'viewbox', 'refx', 'refy'
        ]);

        // Canvas-specific attributes
        const canvasPreserveAttributes = new Set([
            'width', 'height'
        ]);

        // Video/Audio-specific attributes
        const mediaPreserveAttributes = new Set([
            'autoplay', 'controls', 'loop', 'muted', 'poster', 'preload', 'playsinline',
            'width', 'height', 'src', 'crossorigin'
        ]);

        // MathML-specific attributes
        const mathmlPreserveAttributes = new Set([
            'mathvariant', 'mathsize', 'mathcolor', 'mathbackground', 'dir', 'fontfamily',
            'fontsize', 'fontstyle', 'fontweight', 'scriptlevel', 'displaystyle', 'scriptsizemultiplier',
            'scriptminsize', 'infixlinebreakstyle', 'decimalpoint', 'grouping-separator',
            'rowalign', 'columnalign', 'groupalign', 'alignmentscope', 'columnwidth', 'width',
            'rowspacing', 'columnspacing', 'rowlines', 'columnlines', 'frame', 'framespacing',
            'equalrows', 'equalcolumns', 'side', 'minlabelspacing', 'form', 'fence', 'separator',
            'lspace', 'rspace', 'stretchy', 'symmetric', 'maxsize', 'minsize', 'largeop',
            'movablelimits', 'accent', 'linebreak', 'lineleading', 'linebreakstyle',
            'linebreakmultchar', 'indentalign', 'indentshift', 'indenttarget', 'indentalignfirst',
            'indentshiftfirst', 'indentalignlast', 'indentshiftlast', 'depth', 'height', 'notation',
            'numalign', 'denomalign', 'bevelled', 'linethickness', 'stackalign', 'align', 'position',
            'shift', 'location', 'rowspan', 'columnspan', 'edge', 'actiontype', 'selection'
        ]);

        function shouldPreserveAttribute(el: Element, attrName: string): boolean {
            const lowerAttrName = attrName.toLowerCase();

            // Always check base attributes first
            if (basePreserveAttributes.has(lowerAttrName)) {
                return true;
            }

            const tagName = el.tagName.toLowerCase();
            const namespace = el.namespaceURI;

            // Handle SVG elements (including elements within SVG namespace)
            if (namespace === 'http://www.w3.org/2000/svg' || tagName === 'svg' || el.closest('svg')) {
                if (svgPreserveAttributes.has(lowerAttrName)) {
                    return true;
                }
            }

            // Handle Canvas elements
            if (tagName === 'canvas') {
                if (canvasPreserveAttributes.has(lowerAttrName)) {
                    return true;
                }
            }

            // Handle Video/Audio elements
            if (tagName === 'video' || tagName === 'audio') {
                if (mediaPreserveAttributes.has(lowerAttrName)) {
                    return true;
                }
            }

            // Handle MathML elements
            if (namespace === 'http://www.w3.org/1998/Math/MathML' || tagName.startsWith('m') && el.closest('math')) {
                if (mathmlPreserveAttributes.has(lowerAttrName)) {
                    return true;
                }
            }

            return false;
        }

        function cleanElement(el: HTMLElement): void {
            const attributes = Array.from(el.attributes);

            for (const attr of attributes) {
                // Always preserve attributes in our preserve lists
                if (shouldPreserveAttribute(el, attr.name)) {
                    continue;
                }

                // Special handling for namespaced attributes (like xlink:href)
                const colonIndex = attr.name.indexOf(':');
                if (colonIndex > -1) {
                    const namespacedName = attr.name.toLowerCase();
                    if (shouldPreserveAttribute(el, namespacedName)) {
                        continue;
                    }
                }

                el.removeAttribute(attr.name);
            }

            // Recursively clean child elements
            const children = Array.from(el.children) as HTMLElement[];
            children.forEach(child => cleanElement(child));
        }

        cleanElement(element);
    }

    /**
     * Serializes an element (and its children) as a JSON string
     *
     * @param element The element to serialize
     * @param options Serialization options
     * @returns a JSON string of { html, css }
     */
    export function elementToJSON(element: HTMLElement, { mode }: ElementToJSONOptions): string {
        if (!element) return "<No element received>";

        let result = { html: '<div>Unrecognized mode</div>', css: '' }

        switch (mode) {
            case ElementSerdeMode.INLINE_STYLES:
                const { css, element: el } = snapshotElement(element)
                removeUnusedAttributes(el);
                // Fix in case background color is not set
                // TODO: should likely be an option to disable this behavior
                const bg = findNearestBackgroundColor(element);
                el.style.backgroundColor = bg;
                result.html = el.outerHTML;
                result.css = css;
                break;
        }
        // Convert to HTML string with inline styles
        return JSON.stringify(result)
    }
}