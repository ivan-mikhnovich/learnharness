import { dom } from "./helpers/linkedom-dom.ts";
import React, { act } from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createRoot, type Root } from "react-dom/client";
import { ModelMenuList } from "../components/settings/model-menu.tsx";
import type { ModelCatalogEntry } from "../src/core/contracts/models.ts";

// The shared-menu grouping contract (provider-choice wave): one model,
// several providers → a non-selectable MODEL header with one pickable
// "provider/id" row per provider underneath. Mounted against an isolated
// DOM, as in setup-dialog-interaction; search ranking is covered by the
// pure pickerModelRows/rowSearchTerms tests (synthetic typing into a
// controlled input under linkedom runs away and is avoided deliberately).
// The linkedom helper is imported FIRST so React takes its modern input
// path — without it a keydown on a text input crashes the test run.

function entry(provider: string, id: string, name: string): ModelCatalogEntry {
	return {
		id,
		name,
		provider,
		reasoning: true,
		input: ["text"],
		supportedLevels: ["low", "high"],
		cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 },
		contextWindow: 1_000_000,
		maxTokens: 384_000,
	};
}

const NATIVE = entry("deepseek", "deepseek-flash", "DeepSeek V4.1 Flash");
const GATEWAY = entry("openrouter", "deepseek/deepseek-v4.1-flash", "DeepSeek: DeepSeek V4.1 Flash");
const SOLO = entry("groq", "llama-x", "Llama X");

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let picks: ModelCatalogEntry[] = [];

async function mount(models: ModelCatalogEntry[]) {
	picks = [];
	host = document.createElement("div");
	document.body.appendChild(host);
	root = createRoot(host);
	await act(async () => {
		root!.render(<ModelMenuList models={models} effectiveId={undefined} onPick={(m) => picks.push(m)} />);
	});
}

function element(selector: string): HTMLElement {
	const node = document.querySelector<HTMLElement>(selector);
	assert.ok(node, `expected ${selector}`);
	return node;
}

async function click(target: HTMLElement) {
	await act(async () => {
		target.click();
	});
}

async function press(key: string, target: HTMLElement) {
	await act(async () => {
		const event = new dom.window.Event("keydown", { bubbles: true, cancelable: true });
		Object.assign(event, { key });
		target.dispatchEvent(event);
	});
}

afterEach(async () => {
	await act(async () => {
		root?.unmount();
	});
	root = null;
	host?.remove();
	host = null;
});

beforeEach(() => {
	picks = [];
});

describe("provider-aware model menu", () => {
	it("renders a model header with one provider row per provider, plus lone models", async () => {
		await mount([NATIVE, GATEWAY, SOLO]);
		const header = element('[data-testid="model-group-deepseek_v4_1_flash"]');
		assert.notEqual(header.tagName, "BUTTON", "the model header is not pickable");
		assert.ok(header.textContent!.includes("DeepSeek V4.1 Flash"));
		assert.ok(header.textContent!.includes("2 providers"));

		const rows = [...document.querySelectorAll<HTMLElement>('[data-testid^="model-option-"]')];
		assert.equal(rows.length, 3, "two providers of the shared model + the lone model");
		const texts = rows.map((row) => row.textContent!);
		assert.ok(texts[0]!.includes("deepseek/deepseek-flash"), "native contract first");
		assert.ok(texts[1]!.includes("openrouter/deepseek/deepseek-v4.1-flash"));
		assert.ok(texts[2]!.includes("Llama X"));
	});

	it("picks the exact provider coordinates of the clicked row", async () => {
		await mount([NATIVE, GATEWAY, SOLO]);
		const rows = [...document.querySelectorAll<HTMLElement>('[data-testid^="model-option-"]')];
		await click(rows[1]!);
		assert.equal(picks.length, 1);
		assert.equal(picks[0]!.provider, "openrouter");
		assert.equal(picks[0]!.id, "deepseek/deepseek-v4.1-flash");
	});

	it("Enter walks the pickable rows, skipping the group header", async () => {
		await mount([NATIVE, GATEWAY, SOLO]);
		const searchField = element('[data-testid="model-search"]');
		await press("Enter", searchField);
		assert.equal(picks.length, 1);
		assert.equal(picks[0]!.provider, "deepseek", "the first pickable row is the native contract");

		// Nothing is walked yet: the first ArrowDown lands on row 0, the
		// second on row 1 — the gateway's row (the header is not walked).
		await press("ArrowDown", searchField);
		await press("ArrowDown", searchField);
		await press("Enter", searchField);
		assert.equal(picks.length, 2);
		assert.equal(picks[1]!.provider, "openrouter");
	});
});
