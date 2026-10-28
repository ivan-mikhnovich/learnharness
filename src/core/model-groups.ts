/**
 * Model grouping for the provider-aware picker (provider-choice wave,
 * 2026-10-28): the catalog federates every keyed provider, so one model
 * shipped by several providers appears once per provider. The picker
 * collapses those rows into ONE group per model and lists the providers
 * inside it, so the route is an explicit choice instead of an accident —
 * the OpenRouter-vs-native-DeepSeek confusion came from the gateway's
 * alias sitting in the same flat list as the vendor's own model.
 *
 * Grouping is by the model's published NAME (the gateway's "<Vendor>: "
 * prefix stripped), never by id: ids are provider-local, names are what
 * the user reads. Version and alias markers stay significant — "…-latest"
 * and "… (batch)" name different entries and keep their own groups.
 *
 * Pure and browser-safe: the menu groups the DTOs it already holds, so
 * there is no server change and no second catalog to drift.
 */

import type { ModelCatalogEntry } from "./contracts/models.ts";

/** Providers that re-expose OTHER vendors' models behind a gateway. Used
 *  ONLY for ordering inside a group (a direct vendor contract outranks a
 *  gateway), never as a routing policy: every provider stays pickable. */
export const ROUTER_PROVIDERS: Readonly<Record<string, true>> = {
	"cloudflare-ai-gateway": true,
	opencode: true,
	"opencode-go": true,
	openrouter: true,
	radius: true,
	"vercel-ai-gateway": true,
};

/** The namespace prefix gateways put in front of a model's published name
 *  ("DeepSeek: DeepSeek V4.1 Flash"). Stripped so the same model on a
 *  gateway and on its native provider share one identity. */
const VENDOR_PREFIX = /^[^:\n]{1,40}:\s+/;

/** The model's identity across providers: the published name without the
 *  gateway's "<Vendor>: " prefix, case-folded, whitespace collapsed. */
export function modelIdentity(entry: Pick<ModelCatalogEntry, "name">): string {
	return groupTitle(entry).toLowerCase();
}

/** The display title: the published name without the gateway prefix, in
 *  the provider's own case. */
export function groupTitle(entry: Pick<ModelCatalogEntry, "name">): string {
	return entry.name.replace(VENDOR_PREFIX, "").trim().replace(/\s+/g, " ");
}

/** One model across every provider that serves it. `members` is ordered
 *  native-first (see compareMembers); `title` comes from the first member,
 *  so a gateway-only group keeps the gateway's own naming. */
export interface ModelGroup {
	/** The identity key (grouped by it). */
	key: string;
	/** The display name (original case). */
	title: string;
	members: ModelCatalogEntry[];
}

/** Inside a group a direct vendor contract comes first, gateways after —
 *  the user's own key paying the vendor is the natural default while the
 *  gateway stays one click away; then provider, then id (stable order). */
function compareMembers(a: ModelCatalogEntry, b: ModelCatalogEntry): number {
	const rank = (entry: ModelCatalogEntry) => (ROUTER_PROVIDERS[entry.provider] ? 1 : 0);
	return rank(a) - rank(b) || a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id);
}

/** Collapse the catalog into model groups, one per identity, ordered by
 *  title. A single-member group is a plain row — the picker renders it
 *  exactly like the pre-grouping list. */
export function groupModels(entries: readonly ModelCatalogEntry[]): ModelGroup[] {
	const byKey = new Map<string, ModelGroup>();
	for (const entry of entries) {
		const key = modelIdentity(entry);
		const group = byKey.get(key);
		if (group) group.members.push(entry);
		else byKey.set(key, { key, title: groupTitle(entry), members: [entry] });
	}
	const groups = [...byKey.values()];
	for (const group of groups) {
		group.members.sort(compareMembers);
		group.title = groupTitle(group.members[0]!);
	}
	return groups.sort((a, b) => a.title.localeCompare(b.title));
}

/** One picker row: a MODEL header (the model is served by several
 *  providers) or a pickable model — a single-provider model, or one
 *  provider's row inside a group. */
export type ModelPickerRow =
	| { kind: "header"; group: ModelGroup }
	| { kind: "model"; entry: ModelCatalogEntry; grouped: boolean };

/** Flatten the catalog into the picker's rows (provider-choice wave): a
 *  model is listed ONCE, and when several providers serve it the model's
 *  name becomes a non-selectable header followed by one row per provider,
 *  labelled "provider/id" — the exact pair a settings write stores. A
 *  single-provider model stays an ordinary row, exactly as before the
 *  grouping existed. */
export function pickerModelRows(entries: readonly ModelCatalogEntry[]): ModelPickerRow[] {
	const rows: ModelPickerRow[] = [];
	for (const group of groupModels(entries)) {
		const first = group.members[0];
		if (!first) continue;
		if (group.members.length === 1) {
			rows.push({ kind: "model", entry: first, grouped: false });
			continue;
		}
		rows.push({ kind: "header", group });
		for (const entry of group.members) rows.push({ kind: "model", entry, grouped: true });
	}
	return rows;
}

/** One model's searchable fields. The qualified "provider/id" joins them
 *  so a row can be searched the way it is written. */
export function modelSearchTerms(entry: ModelCatalogEntry): string[] {
	return [entry.provider, entry.id, entry.name, `${entry.provider}/${entry.id}`];
}

/** A row's search fields. A header carries its members' terms too, so a
 *  query that matches any provider keeps the model's heading in view while
 *  the non-matching rows drop out underneath it. */
export function rowSearchTerms(row: ModelPickerRow): string[] {
	return row.kind === "header"
		? [row.group.title, ...row.group.members.flatMap(modelSearchTerms)]
		: modelSearchTerms(row.entry);
}
