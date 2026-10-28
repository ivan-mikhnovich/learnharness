/**
 * Model grouping (provider-choice wave): one model served by several
 * providers is ONE group, with a picker row per provider. Pins: identity
 * strips the gateway's "<Vendor>: " prefix, groups order the native
 * contract before a gateway, and version/alias markers keep their own
 * groups (a heuristic merge would silently reroute a pick).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupModels, modelIdentity, pickerModelRows, ROUTER_PROVIDERS, rowSearchTerms } from "../src/core/model-groups.ts";
import type { ModelCatalogEntry } from "../src/core/contracts/models.ts";

function entry(provider: string, id: string, name: string): ModelCatalogEntry {
	return {
		id,
		name,
		provider,
		reasoning: true,
		input: ["text"],
		supportedLevels: ["low", "high"],
		cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1_000_000,
		maxTokens: 10_000,
	};
}

const NATIVE = entry("deepseek", "deepseek-flash", "DeepSeek V4.1 Flash");
const GATEWAY = entry("openrouter", "deepseek/deepseek-v4.1-flash", "DeepSeek: DeepSeek V4.1 Flash");
const ALIAS = entry("openrouter", "~deepseek/deepseek-flash-latest", "DeepSeek: DeepSeek Flash Latest");
const SOLO = entry("groq", "llama-x", "Llama X");

describe("model identity across providers", () => {
	it("strips the gateway's vendor prefix and folds case/whitespace", () => {
		assert.equal(modelIdentity(GATEWAY), "deepseek v4.1 flash");
		assert.equal(modelIdentity(NATIVE), "deepseek v4.1 flash");
		assert.equal(modelIdentity(entry("x", "y", "  DeepSeek:   DeepSeek   V4.1 Flash ")), "deepseek v4.1 flash");
	});

	it("keeps alias and batch markers significant — they name different entries", () => {
		assert.equal(modelIdentity(ALIAS), "deepseek flash latest");
		assert.notEqual(modelIdentity(entry("openrouter", "a/b:batch", "DeepSeek: DeepSeek V4.1 Flash (batch)")), modelIdentity(NATIVE));
	});

	it("names the router set (ordering only, never a routing policy)", () => {
		assert.equal(ROUTER_PROVIDERS.openrouter, true);
		assert.equal(ROUTER_PROVIDERS.deepseek, undefined);
	});
});

describe("groupModels", () => {
	it("merges one model across providers, native contract first", () => {
		const groups = groupModels([GATEWAY, NATIVE]);
		assert.equal(groups.length, 1);
		assert.equal(groups[0]!.key, "deepseek v4.1 flash");
		assert.equal(groups[0]!.title, "DeepSeek V4.1 Flash");
		assert.deepEqual(
			groups[0]!.members.map((m) => `${m.provider}/${m.id}`),
			["deepseek/deepseek-flash", "openrouter/deepseek/deepseek-v4.1-flash"],
		);
	});

	it("keeps an alias in its own group — no silent merge of versions", () => {
		const groups = groupModels([NATIVE, GATEWAY, ALIAS]);
		const byTitle = new Map(groups.map((g) => [g.title, g.members.map((m) => m.id)]));
		assert.deepEqual(byTitle.get("DeepSeek V4.1 Flash"), ["deepseek-flash", "deepseek/deepseek-v4.1-flash"]);
		assert.deepEqual(byTitle.get("DeepSeek Flash Latest"), ["~deepseek/deepseek-flash-latest"]);
	});

	it("is stable and title-ordered; a lone model stays a single-member group", () => {
		const groups = groupModels([GATEWAY, NATIVE, SOLO]);
		assert.deepEqual(groups.map((g) => [g.title, g.members.length]), [["DeepSeek V4.1 Flash", 2], ["Llama X", 1]]);
		// Same input in any order groups the same way.
		assert.deepEqual(groupModels([SOLO, NATIVE, GATEWAY]), groups);
	});
});

describe("pickerModelRows", () => {
	it("lists a shared model once: a header, then one row per provider", () => {
		const rows = pickerModelRows([NATIVE, GATEWAY, SOLO]);
		assert.deepEqual(
			rows.map((row) => (row.kind === "header" ? `header:${row.group.title}` : `${row.grouped ? "grouped" : "solo"}:${row.entry.provider}/${row.entry.id}`)),
			[
				"header:DeepSeek V4.1 Flash",
				"grouped:deepseek/deepseek-flash",
				"grouped:openrouter/deepseek/deepseek-v4.1-flash",
				"solo:groq/llama-x",
			],
		);
	});

	it("leaves a single-provider model as a plain, ungrouped row", () => {
		const rows = pickerModelRows([SOLO]);
		assert.deepEqual(rows.map((row) => (row.kind === "model" ? row.grouped : "header")), [false]);
	});
});

describe("rowSearchTerms", () => {
	it("a model row searches by provider, id and name — including the qualified pair", () => {
		const terms = rowSearchTerms({ kind: "model", entry: GATEWAY, grouped: true });
		assert.deepEqual(terms, ["openrouter", "deepseek/deepseek-v4.1-flash", "DeepSeek: DeepSeek V4.1 Flash", "openrouter/deepseek/deepseek-v4.1-flash"]);
	});

	it("a group header carries its members' terms, so a provider query keeps the heading", () => {
		const group = groupModels([NATIVE, GATEWAY])[0]!;
		const terms = rowSearchTerms({ kind: "header", group });
		assert.equal(terms[0], "DeepSeek V4.1 Flash");
		assert.ok(terms.includes("openrouter"));
		assert.ok(terms.includes("deepseek-flash"));
	});
});
