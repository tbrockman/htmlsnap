/**
 * Copyright 2025 Theodore Brockman
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export enum ElementSerdeMode {
    INLINE_STYLES = 0,
    // PARSE_CSS = 1
}
export type ElementSerdeOptions = {
    mode?: ElementSerdeMode;
}

export namespace DomUtils {

    export function groupByComputedStyles(element: HTMLElement) {
        const clone = element.cloneNode(true) as HTMLElement
        const styleToElements = new Map<string, Set<HTMLElement>>()
        const elementsToStyles = new Map<string, Set<string>>()
        const elementToClasses = new Map<HTMLElement, string[]>()
        const elementToId = new Map<HTMLElement, string>()
        const idToElement = new Map<string, HTMLElement>()
        let id = 0;

        function elementsToIds(elements: Set<HTMLElement>) {
            return Array.from(elements).map(e => elementToId.get(e)).sort().join(',')
        }

        // TODO: filter default styles
        function gatherStyles(element: HTMLElement, clone: HTMLElement) {
            const computedStyle = window.getComputedStyle(element);

            if (!elementToId.has(clone)) {
                const strId = id.toString()
                elementToId.set(clone, strId)
                idToElement.set(strId, clone)
                id++;
            }

            for (let i = 0; i < computedStyle.length; i++) {
                const prop = computedStyle[i];
                const value = computedStyle.getPropertyValue(prop);
                const style = `${prop}: ${value};`
                const set = styleToElements.get(style);

                if (set) {
                    set.add(clone)
                } else {
                    styleToElements.set(style, new Set([clone]))
                }
            }

            const children = Array.from(element.children)
            const clones = Array.from(clone.children)

            children.forEach((e, i) => gatherStyles(e as HTMLElement, clones[i] as HTMLElement))
        }
        gatherStyles(element, clone)

        styleToElements.forEach((set, style) => {
            const ids = elementsToIds(set)
            const elements = elementsToStyles.get(ids)

            if (elements) {
                elementsToStyles.set(ids, elements.add(style))
            } else {
                elementsToStyles.set(ids, new Set([style]))
            }
        })
        let counter = 0;
        const classes: string[] = [];
        const rules: string[] = [];

        elementsToStyles.forEach((styles, ids) => {
            const className = `🇨🇦${counter}`
            classes.push(className)

            const rule = `.${className} { ${Array.from(styles).join(' ')} }`
            rules.push(rule)

            ids.split(',').forEach(id => {
                const e = idToElement.get(id)!
                const classNames = elementToClasses.get(e)
                e.classList.add(className)

                if (classNames) {
                    classNames.push(className)
                } else {
                    elementToClasses.set(e, [className])
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

    /**
     * 
     * @param element The element to serialize
     * @param options Serialization options
     * @description Serializes the element and its children
     * @returns
     */
    export function serializeElement(element: HTMLElement, { mode }: ElementSerdeOptions): string {
        if (!element) return "<No element received>";

        let result = { html: '<div>Unrecognized mode</div>', css: '' }

        switch (mode) {
            case ElementSerdeMode.INLINE_STYLES:
                const { css, element: el } = groupByComputedStyles(element)

                result.html = el.outerHTML;
                result.css = css;
                console.log({ result })
                break;
        }
        // Convert to HTML string with inline styles
        return JSON.stringify(result)
    }
}