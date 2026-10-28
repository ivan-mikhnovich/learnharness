/**
 * The linkedom DOM bag for interaction tests, imported BEFORE react-dom.
 *
 * Import order matters: React reads `canUseDOM` and probes `oninput` once,
 * at module evaluation. Without a browser-looking document it takes the
 * legacy input polyfill path, whose keydown handler dereferences a null
 * focused instance ("Cannot read properties of null (reading 'tag')") the
 * moment a test dispatches Enter or an arrow key at a text input. linkedom
 * exposes no `oninput` property, so React would probe `document.createElement`
 * and still miss — declaring it puts React on the modern path.
 *
 * Usage: `import { dom } from "./helpers/linkedom-dom.ts";` as the FIRST
 * import of a test file that types or presses keys, then import React.
 */
import { parseHTML } from "linkedom";

export const dom = parseHTML("<html><body></body></html>");

if (!("oninput" in dom.window.document)) {
	Object.defineProperty(dom.window.document, "oninput", { configurable: true, writable: true, value: null });
}

Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	Element: dom.window.Element,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	CustomEvent: dom.window.CustomEvent,
	IS_REACT_ACT_ENVIRONMENT: true,
});

dom.window.HTMLElement.prototype.scrollIntoView = () => {};
