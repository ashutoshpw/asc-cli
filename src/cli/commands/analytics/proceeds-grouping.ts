import type { Client } from "../../../api/client";
import type { SalesReportRow } from "../../../api/types/analytics";
import type { AppAttributes } from "../../../api/types/apps";
import { round2, roundCurrencyMap } from "./proceeds-helpers";

export type GroupByMode = "bundle-id" | "sku";

export async function fetchSkuToBundleIdMap(
	client: Client,
): Promise<Record<string, string>> {
	const apps = await client.paginate<AppAttributes>("/v1/apps?limit=200");
	const map: Record<string, string> = {};

	for (const app of apps) {
		const sku = app.attributes?.sku;
		const bundleId = app.attributes?.bundleId;
		if (sku && bundleId) {
			map[sku] = bundleId;
		}
	}

	return map;
}

export function parseGroupByMode(
	value: string | undefined,
): GroupByMode | undefined {
	if (!value) {
		return undefined;
	}
	if (value === "bundle-id") {
		return "bundle-id";
	}
	if (value === "sku") {
		return "sku";
	}
	return undefined;
}

export function summarizeGroupedProceeds(
	rows: SalesReportRow[],
	mode: GroupByMode,
	skuToBundleId?: Record<string, string>,
): Array<{
	group: string;
	totalDeveloperProceeds: number;
	byCurrency: Record<string, number>;
	rowCount: number;
}> {
	const grouped = new Map<
		string,
		{
			totalDeveloperProceeds: number;
			byCurrency: Record<string, number>;
			rowCount: number;
		}
	>();

	for (const row of rows) {
		const groupKey = getGroupKey(row, mode, skuToBundleId);
		const proceeds = parseNumericProceeds(row.developerProceeds);
		const currency = getCurrencyKey(row.currencyOfProceeds);

		const existing = grouped.get(groupKey) || {
			totalDeveloperProceeds: 0,
			byCurrency: {},
			rowCount: 0,
		};
		existing.totalDeveloperProceeds += proceeds;
		existing.byCurrency[currency] =
			(existing.byCurrency[currency] || 0) + proceeds;
		existing.rowCount += 1;
		grouped.set(groupKey, existing);
	}

	return [...grouped.entries()]
		.map(([group, summary]) => ({
			group,
			totalDeveloperProceeds: round2(summary.totalDeveloperProceeds),
			byCurrency: roundCurrencyMap(summary.byCurrency),
			rowCount: summary.rowCount,
		}))
		.filter((item) => item.totalDeveloperProceeds !== 0)
		.sort((a, b) => b.totalDeveloperProceeds - a.totalDeveloperProceeds);
}

function getGroupKey(
	row: SalesReportRow,
	mode: GroupByMode,
	skuToBundleId?: Record<string, string>,
): string {
	const sku =
		typeof row.sku === "string" && row.sku.trim() ? row.sku.trim() : "UNKNOWN";
	if (mode === "sku") {
		return sku;
	}
	return skuToBundleId?.[sku] || `UNKNOWN_BUNDLE_ID(${sku})`;
}

function parseNumericProceeds(value: string | number | undefined): number {
	if (typeof value === "number") {
		return Number.isNaN(value) ? 0 : value;
	}
	if (typeof value === "string") {
		const parsed = Number.parseFloat(value);
		return Number.isNaN(parsed) ? 0 : parsed;
	}
	return 0;
}

function getCurrencyKey(value: string | number | undefined): string {
	if (typeof value === "string" && value.trim() !== "") {
		return value.trim();
	}
	return "UNKNOWN";
}
