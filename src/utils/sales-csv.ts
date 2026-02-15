import type { SalesReportRow } from "../api/types/analytics";

const NUMERIC_COLUMNS = new Set([
	"units",
	"developerProceeds",
	"customerPrice",
]);

const DEFAULT_COLUMN_ORDER: string[] = [
	"provider",
	"providerCountry",
	"sku",
	"developer",
	"title",
	"version",
	"productTypeIdentifier",
	"units",
	"developerProceeds",
	"beginDate",
	"endDate",
	"customerCurrency",
	"countryCode",
	"currencyOfProceeds",
	"appleIdentifier",
	"customerPrice",
	"promoCode",
	"parentIdentifier",
	"subscription",
	"period",
	"category",
	"cmb",
	"device",
	"supportedPlatforms",
	"proceedsReason",
	"preservedPricing",
	"client",
	"orderType",
];

export function salesRowsToCsv(rows: SalesReportRow[]): string {
	const columns = getColumns(rows);
	const lines: string[] = [];
	lines.push(columns.map(escapeCsvCell).join(","));

	for (const row of rows) {
		const line = columns
			.map((column) => {
				const value = row[column];
				if (value === undefined || value === null) {
					return "";
				}
				return escapeCsvCell(String(value));
			})
			.join(",");
		lines.push(line);
	}

	return `${lines.join("\n")}\n`;
}

export function parseSalesCsv(content: string): SalesReportRow[] {
	const records = parseCsvRecords(content);
	if (records.length === 0) {
		return [];
	}

	const [header, ...dataRows] = records;
	const columns = header.map((h) => h.trim()).filter(Boolean);
	if (columns.length === 0) {
		return [];
	}

	const rows: SalesReportRow[] = [];
	for (const dataRow of dataRows) {
		if (dataRow.length === 1 && dataRow[0] === "") {
			continue;
		}
		const row: SalesReportRow = {};
		for (let i = 0; i < columns.length; i++) {
			const column = columns[i];
			const rawValue = dataRow[i] ?? "";
			if (rawValue === "") {
				continue;
			}

			if (NUMERIC_COLUMNS.has(column)) {
				const num = Number.parseFloat(rawValue);
				row[column] = Number.isNaN(num) ? 0 : num;
				continue;
			}

			row[column] = rawValue;
		}
		rows.push(row);
	}

	return rows;
}

export function summarizeDeveloperProceeds(rows: SalesReportRow[]): {
	totalDeveloperProceeds: number;
	byCurrency: Record<string, number>;
	rowCount: number;
} {
	let total = 0;
	const byCurrency: Record<string, number> = {};

	for (const row of rows) {
		const proceeds = getNumericProceeds(row.developerProceeds);
		const currency = getCurrencyKey(row.currencyOfProceeds);
		total += proceeds;
		byCurrency[currency] = (byCurrency[currency] || 0) + proceeds;
	}

	return {
		totalDeveloperProceeds: total,
		byCurrency,
		rowCount: rows.length,
	};
}

function getNumericProceeds(value: string | number | undefined): number {
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

function getColumns(rows: SalesReportRow[]): string[] {
	const keys = new Set<string>();
	for (const row of rows) {
		for (const key of Object.keys(row)) {
			keys.add(key);
		}
	}

	if (keys.size === 0) {
		return [...DEFAULT_COLUMN_ORDER];
	}

	const orderedKnown = DEFAULT_COLUMN_ORDER.filter((key) => keys.has(key));
	const extras = [...keys]
		.filter((key) => !DEFAULT_COLUMN_ORDER.includes(key))
		.sort((a, b) => a.localeCompare(b));

	return [...orderedKnown, ...extras];
}

function escapeCsvCell(value: string): string {
	if (
		value.includes(",") ||
		value.includes('"') ||
		value.includes("\n") ||
		value.includes("\r")
	) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function parseCsvRecords(content: string): string[][] {
	const records: string[][] = [];
	let currentRow: string[] = [];
	let currentField = "";
	let inQuotes = false;

	for (let i = 0; i < content.length; i++) {
		const char = content[i];

		if (inQuotes) {
			if (char === '"') {
				const next = content[i + 1];
				if (next === '"') {
					currentField += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				currentField += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
			continue;
		}

		if (char === ",") {
			currentRow.push(currentField);
			currentField = "";
			continue;
		}

		if (char === "\n") {
			currentRow.push(currentField);
			if (!isEmptyRow(currentRow)) {
				records.push(currentRow);
			}
			currentRow = [];
			currentField = "";
			continue;
		}

		if (char === "\r") {
			continue;
		}

		currentField += char;
	}

	currentRow.push(currentField);
	if (!isEmptyRow(currentRow)) {
		records.push(currentRow);
	}

	return records;
}

function isEmptyRow(row: string[]): boolean {
	return row.every((field) => field === "");
}
