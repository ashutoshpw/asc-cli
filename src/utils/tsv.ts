/**
 * TSV (Tab-Separated Values) parser for sales reports
 */
import type { SalesReportRow } from "../api/types/analytics";

/**
 * Parse TSV content into array of objects
 */
export function parseTSV(content: string): SalesReportRow[] {
	const lines = content.trim().split("\n");
	if (lines.length === 0) {
		return [];
	}

	// First line is the header
	const headers = lines[0].split("\t");

	// Parse remaining lines
	const rows: SalesReportRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const values = lines[i].split("\t");
		const row: SalesReportRow = {};

		for (let j = 0; j < headers.length; j++) {
			const header = normalizeHeader(headers[j]);
			const value = values[j]?.trim() || "";

			// Convert numeric fields
			if (
				header === "units" ||
				header === "developerProceeds" ||
				header === "customerPrice"
			) {
				row[header] = value ? Number.parseFloat(value) : 0;
			} else {
				row[header] = value;
			}
		}

		rows.push(row);
	}

	return rows;
}

/**
 * Normalize header names to camelCase
 */
function normalizeHeader(header: string): string {
	// Common header mappings
	const mappings: Record<string, string> = {
		Provider: "provider",
		"Provider Country": "providerCountry",
		SKU: "sku",
		Developer: "developer",
		Title: "title",
		Version: "version",
		"Product Type Identifier": "productTypeIdentifier",
		Units: "units",
		"Developer Proceeds": "developerProceeds",
		"Begin Date": "beginDate",
		"End Date": "endDate",
		"Customer Currency": "customerCurrency",
		"Country Code": "countryCode",
		"Currency of Proceeds": "currencyOfProceeds",
		"Apple Identifier": "appleIdentifier",
		"Customer Price": "customerPrice",
		"Promo Code": "promoCode",
		"Parent Identifier": "parentIdentifier",
		Subscription: "subscription",
		Period: "period",
		Category: "category",
		CMB: "cmb",
		Device: "device",
		"Supported Platforms": "supportedPlatforms",
		"Proceeds Reason": "proceedsReason",
		"Preserved Pricing": "preservedPricing",
		Client: "client",
		"Order Type": "orderType",
	};

	return mappings[header] || header;
}

/**
 * Format TSV data as summary statistics
 */
export function summarizeSalesData(rows: SalesReportRow[]): {
	totalUnits: number;
	totalProceeds: number;
	byCountry: Record<string, { units: number; proceeds: number }>;
	byApp: Record<string, { units: number; proceeds: number }>;
	byDevice: Record<string, { units: number; proceeds: number }>;
} {
	const summary = {
		totalUnits: 0,
		totalProceeds: 0,
		byCountry: {} as Record<string, { units: number; proceeds: number }>,
		byApp: {} as Record<string, { units: number; proceeds: number }>,
		byDevice: {} as Record<string, { units: number; proceeds: number }>,
	};

	for (const row of rows) {
		const units = row.units || 0;
		const proceeds = row.developerProceeds || 0;

		summary.totalUnits += units;
		summary.totalProceeds += proceeds;

		// By country
		const country = row.countryCode || "Unknown";
		if (!summary.byCountry[country]) {
			summary.byCountry[country] = { units: 0, proceeds: 0 };
		}
		summary.byCountry[country].units += units;
		summary.byCountry[country].proceeds += proceeds;

		// By app
		const app = row.title || row.sku || "Unknown";
		if (!summary.byApp[app]) {
			summary.byApp[app] = { units: 0, proceeds: 0 };
		}
		summary.byApp[app].units += units;
		summary.byApp[app].proceeds += proceeds;

		// By device
		const device = row.device || "Unknown";
		if (!summary.byDevice[device]) {
			summary.byDevice[device] = { units: 0, proceeds: 0 };
		}
		summary.byDevice[device].units += units;
		summary.byDevice[device].proceeds += proceeds;
	}

	return summary;
}

/**
 * Convert summary to display format
 */
export function formatSalesSummary(
	summary: ReturnType<typeof summarizeSalesData>,
): {
	totalUnits: number;
	totalProceeds: string;
	topCountries: Array<{ country: string; units: number; proceeds: string }>;
	topApps: Array<{ app: string; units: number; proceeds: string }>;
	topDevices: Array<{ device: string; units: number; proceeds: string }>;
} {
	const formatCurrency = (amount: number) =>
		`$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

	const sortByUnits = (
		a: [string, { units: number; proceeds: number }],
		b: [string, { units: number; proceeds: number }],
	) => b[1].units - a[1].units;

	return {
		totalUnits: summary.totalUnits,
		totalProceeds: formatCurrency(summary.totalProceeds),
		topCountries: Object.entries(summary.byCountry)
			.sort(sortByUnits)
			.slice(0, 10)
			.map(([country, stats]) => ({
				country,
				units: stats.units,
				proceeds: formatCurrency(stats.proceeds),
			})),
		topApps: Object.entries(summary.byApp)
			.sort(sortByUnits)
			.slice(0, 10)
			.map(([app, stats]) => ({
				app,
				units: stats.units,
				proceeds: formatCurrency(stats.proceeds),
			})),
		topDevices: Object.entries(summary.byDevice)
			.sort(sortByUnits)
			.slice(0, 10)
			.map(([device, stats]) => ({
				device,
				units: stats.units,
				proceeds: formatCurrency(stats.proceeds),
			})),
	};
}
