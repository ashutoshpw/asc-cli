import { describe, expect, test } from "bun:test";
import {
	parseGroupByMode,
	summarizeGroupedProceeds,
} from "../cli/commands/analytics/proceeds-grouping";
import {
	buildRangeSegments,
	getDateStringsInRange,
	parseIsoDateStrict,
	parseIsoMonthStrict,
	resolveQueryMode,
	roundCurrencyMap,
} from "../cli/commands/analytics/proceeds-helpers";
import { getReportsDailyCsvPath, getReportsMonthCsvPath } from "./report-cache";
import {
	parseSalesCsv,
	salesRowsToCsv,
	summarizeDeveloperProceeds,
} from "./sales-csv";
import { formatSalesSummary, parseTSV, summarizeSalesData } from "./tsv";

describe("sales and analytics data utilities", () => {
	test("round-trips CSV values, numbers, and escaped cells", () => {
		const rows = [
			{
				title: "A, B",
				units: 2,
				developerProceeds: 3.5,
				countryCode: "US",
				note: 'contains "quotes"',
			},
		];

		const csv = salesRowsToCsv(rows);
		const parsed = parseSalesCsv(csv);

		expect(csv).toContain('"A, B"');
		expect(csv).toContain('"contains ""quotes"""');
		expect(parsed).toEqual(rows);
	});

	test("summarizes developer proceeds by currency", () => {
		const summary = summarizeDeveloperProceeds([
			{ developerProceeds: 1.25, currencyOfProceeds: "USD" },
			{ developerProceeds: 2.75, currencyOfProceeds: "USD" },
			{ developerProceeds: Number.NaN },
		]);

		expect(summary).toEqual({
			totalDeveloperProceeds: 4,
			byCurrency: { USD: 4, UNKNOWN: 0 },
			rowCount: 3,
		});
	});

	test("parses TSV rows and creates sorted summary output", () => {
		const rows = parseTSV(
			"Title\tUnits\tDeveloper Proceeds\tCountry Code\tDevice\n" +
				"App A\t2\t1.5\tUS\tiPhone\n" +
				"App B\t1\t2.0\tIN\tiPad\n",
		);
		const summary = summarizeSalesData(rows);
		const formatted = formatSalesSummary(summary);

		expect(summary.totalUnits).toBe(3);
		expect(summary.totalProceeds).toBe(3.5);
		expect(formatted.totalProceeds).toBe("$3.50");
		expect(formatted.topCountries[0]?.country).toBe("US");
	});

	test("validates dates and splits a range across calendar months", () => {
		expect(parseIsoMonthStrict("2024-02")?.toISOString()).toBe(
			"2024-02-01T00:00:00.000Z",
		);
		expect(parseIsoMonthStrict("2024-13")).toBeNull();
		expect(parseIsoDateStrict("2024-02-29")).not.toBeNull();
		expect(parseIsoDateStrict("2023-02-29")).toBeNull();
		expect(resolveQueryMode("2024-02", undefined, undefined)).toBe("month");
		expect(resolveQueryMode(undefined, "2024-01-01", "2024-02-01")).toBe(
			"range",
		);

		const segments = buildRangeSegments(
			new Date("2024-01-30T00:00:00Z"),
			new Date("2024-02-02T00:00:00Z"),
		);
		expect(segments).toEqual([
			{
				month: "2024-01",
				from: "2024-01-30",
				to: "2024-01-31",
				fullMonth: false,
			},
			{
				month: "2024-02",
				from: "2024-02-01",
				to: "2024-02-02",
				fullMonth: false,
			},
		]);
		expect(getDateStringsInRange("2024-01-30", "2024-02-01")).toEqual([
			"2024-01-30",
			"2024-01-31",
			"2024-02-01",
		]);
	});

	test("groups proceeds by SKU or bundle ID and omits zero totals", () => {
		expect(parseGroupByMode("sku")).toBe("sku");
		expect(parseGroupByMode("unknown")).toBeUndefined();

		const rows = [
			{ sku: "SKU-1", developerProceeds: 3, currencyOfProceeds: "USD" },
			{ sku: "SKU-1", developerProceeds: -3, currencyOfProceeds: "USD" },
			{ sku: "SKU-2", developerProceeds: 4.25, currencyOfProceeds: "USD" },
		];

		expect(summarizeGroupedProceeds(rows, "sku")).toEqual([
			{
				group: "SKU-2",
				totalDeveloperProceeds: 4.25,
				byCurrency: { USD: 4.25 },
				rowCount: 1,
			},
		]);
		expect(
			summarizeGroupedProceeds(rows, "bundle-id", { "SKU-2": "com.example" }),
		).toEqual([
			{
				group: "com.example",
				totalDeveloperProceeds: 4.25,
				byCurrency: { USD: 4.25 },
				rowCount: 1,
			},
		]);
	});

	test("rounds currency maps and generates stable report cache paths", () => {
		expect(roundCurrencyMap({ USD: 1.235, EUR: 0.004 })).toEqual({ USD: 1.24 });
		expect(getReportsMonthCsvPath("123", "2024-01")).toMatch(
			/vendors[\\/]123[\\/]reports[\\/]2024-01[\\/]file\.csv$/,
		);
		expect(getReportsDailyCsvPath("123", "2024-01-02")).toMatch(
			/vendors[\\/]123[\\/]reports[\\/]2024-01[\\/]daily[\\/]2024-01-02\.csv$/,
		);
	});
});
