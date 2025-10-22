/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export enum ElementSerdeMode {
    INLINE_STYLES = 0,
    // PARSE_CSS = 1
}
export type ElementToJSONOptions = {
    mode?: ElementSerdeMode;
}

export namespace DomUtils {

    export function groupByComputedStyles(element: HTMLElement) {
        const clone = element.cloneNode(true) as HTMLElement
        const styleToElementIds = new Map<string, Set<string>>()
        const elementIdsToStyles = new Map<string, Set<string>>()
        const elementIdsToClasses = new Map<string, string[]>()
        const elementToId = new Map<HTMLElement, string>()
        const idToElement = new Map<string, HTMLElement>()
        let id = 0;

        function elementsToIds(elements: Set<string>) {
            return Array.from(elements).sort().join(',')
        }

        // TODO: filter default styles
        function gatherStyles(element: HTMLElement, clone: HTMLElement) {
            const computedStyle = window.getComputedStyle(element);
            // TODO: handle pseudo-elements
            const beforeStyle = window.getComputedStyle(element, '::before');
            const afterStyle = window.getComputedStyle(element, '::after');
            // Remove existing classes from clone as they'll be redundant
            clone.removeAttribute('class');
            let elementId = elementToId.get(clone);

            if (!elementId) {
                elementId = id.toString()
                let ids = [elementId]

                if (beforeStyle && beforeStyle.content && beforeStyle.content !== 'none') {
                    ids.push('::before')
                }
                if (afterStyle && afterStyle.content && afterStyle.content !== 'none') {
                    ids.push('::after')
                }

                elementToId.set(clone, elementId)
                idToElement.set(elementId, clone)
                id++;
            }

            for (let i = 0; i < computedStyle.length; i++) {
                const prop = computedStyle[i];
                
                // Skip CSS variable declarations, as they are not needed in the final output
                if (prop.startsWith('--')) {
                    continue;
                }
                
                const value = computedStyle.getPropertyValue(prop);
                const style = `${prop}:${value};`
                const set = styleToElementIds.get(style);

                if (set) {
                    set.add(elementId)
                } else {
                    styleToElementIds.set(style, new Set([elementId]))
                }
            }

            const children = Array.from(element.children)
            const clones = Array.from(clone.children)

            children.forEach((e, i) => gatherStyles(e as HTMLElement, clones[i] as HTMLElement))
        }
        gatherStyles(element, clone)

        // TODO: handle ::after and ::before pseudo elements
        styleToElementIds.forEach((set, style) => {
            const ids = elementsToIds(set)
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
            const className = `🫰${counter}`
            classes.push(className)

            const rule = `.${className} { ${Array.from(styles).join('')} }`
            rules.push(rule)

            ids.split(',').forEach(id => {
                const e = idToElement.get(id)!
                const classNames = elementIdsToClasses.get(id)
                e.classList.add(className)

                if (classNames) {
                    classNames.push(className)
                } else {
                    elementIdsToClasses.set(id, [className])
                }
            })
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

    export function fixImageSrcs(element: HTMLElement): void {
        const images = element.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src?.startsWith('//')) {
                img.setAttribute('src', `https:${src}`);
            }
        });
    }

    export function fixAnchorHrefs(element: HTMLElement): void {
        const links = element.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>;
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href?.startsWith('//')) {
                link.setAttribute('href', `https:${href}`);
            }
        });
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
    export function cleanRedundantAttributes(element: HTMLElement) {
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

            // The new classes generated by groupByComputedStyles
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
                const { css, element: el } = groupByComputedStyles(element)
                cleanRedundantAttributes(el);
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