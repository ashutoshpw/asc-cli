/**
 * Analytics commands
 * asc analytics sales/request/requests/download
 */
import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { AppStoreConnectError, Client } from "../../../api/client";
import type {
	AnalyticsAccessType,
	AnalyticsReportInstancesResponse,
	AnalyticsReportRequestResponse,
	AnalyticsReportRequestsResponse,
	AnalyticsReportSegmentsResponse,
	SalesReportFrequency,
	SalesReportResult,
	SalesReportRow,
	SalesReportSubType,
	SalesReportType,
	SalesReportVersion,
} from "../../../api/types/analytics";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printInfo,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import {
	getReportsDailyCsvPath,
	getReportsMonthCsvPath,
} from "../../../utils/report-cache";
import {
	parseSalesCsv,
	salesRowsToCsv,
	summarizeDeveloperProceeds,
} from "../../../utils/sales-csv";
import {
	formatSalesSummary,
	parseTSV,
	summarizeSalesData,
} from "../../../utils/tsv";
import { type Command, type CommandContext, registry } from "../../router";

const analyticsCommand: Command = {
	name: "analytics",
	description: "Request and download analytics and sales reports",
	subcommands: {
		sales: {
			name: "sales",
			description: "Download sales and trends reports",
			options: {
				vendor: {
					type: "string",
					short: "v",
					description:
						"Vendor number (or ASC_VENDOR_NUMBER/ASC_ANALYTICS_VENDOR_NUMBER env)",
					required: true,
				},
				type: {
					type: "string",
					short: "t",
					description:
						"Report type: SALES, PRE_ORDER, NEWSSTAND, SUBSCRIPTION, SUBSCRIPTION_EVENT",
					required: true,
				},
				subtype: {
					type: "string",
					short: "s",
					description: "Report subtype: SUMMARY, DETAILED",
					required: true,
				},
				frequency: {
					type: "string",
					short: "f",
					description: "Frequency: DAILY, WEEKLY, MONTHLY, YEARLY",
					required: true,
				},
				date: {
					type: "string",
					short: "d",
					description:
						"Report date: daily/weekly YYYY-MM-DD, monthly YYYY-MM, yearly YYYY",
					required: true,
				},
				version: {
					type: "string",
					description: "Report format version: 1_0 (default), 1_1",
					default: "1_0",
				},
				output: {
					type: "string",
					short: "o",
					description:
						"Output file path (default: sales_report_{date}_{type}.tsv.gz)",
				},
				decompress: {
					type: "boolean",
					description: "Decompress gzip output to .tsv",
					default: false,
				},
				parse: {
					type: "boolean",
					description: "Parse TSV and show summary statistics",
					default: false,
				},
			},
			execute: downloadSalesReport,
		},
		proceeds: {
			name: "proceeds",
			description: "Calculate proceeds with cache-aware report downloads",
			options: {
				vendor: {
					type: "string",
					short: "v",
					description:
						"Vendor number (or ASC_VENDOR_NUMBER/ASC_ANALYTICS_VENDOR_NUMBER env)",
				},
				month: {
					type: "string",
					description: "Month in YYYY-MM format",
				},
				from: {
					type: "string",
					description: "Start date in YYYY-MM-DD format",
				},
				to: {
					type: "string",
					description: "End date in YYYY-MM-DD format",
				},
				refresh: {
					type: "boolean",
					description: "Ignore cached files and re-download reports",
					default: false,
				},
			},
			execute: calculateProceeds,
		},
		request: {
			name: "request",
			description: "Create an analytics report request",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
				"access-type": {
					type: "string",
					description: "Access type: ONGOING, ONE_TIME_SNAPSHOT",
					default: "ONGOING",
				},
			},
			execute: createAnalyticsRequest,
		},
		requests: {
			name: "requests",
			description: "List analytics report requests for an app",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
			},
			execute: listAnalyticsRequests,
		},
		reports: {
			name: "reports",
			description: "List analytics reports for a request",
			options: {
				"request-id": {
					type: "string",
					short: "r",
					description: "Analytics report request ID",
					required: true,
				},
			},
			execute: listAnalyticsReports,
		},
		instances: {
			name: "instances",
			description: "List analytics report instances",
			options: {
				"report-id": {
					type: "string",
					short: "r",
					description: "Analytics report ID",
					required: true,
				},
			},
			execute: listAnalyticsInstances,
		},
		download: {
			name: "download",
			description: "Download analytics report data",
			options: {
				"instance-id": {
					type: "string",
					short: "i",
					description: "Analytics report instance ID",
					required: true,
				},
				output: {
					type: "string",
					short: "o",
					description: "Output file path",
				},
			},
			execute: downloadAnalyticsReport,
		},
	},
};

type QueryMode = "month" | "range";

interface ProceedsMonthResult {
	rows: SalesReportRow[];
	source: string;
	cachePath?: string;
	missingDates: string[];
}

interface ProceedsDailyResult {
	rows: SalesReportRow[];
	source: string;
	cachePath?: string;
	missingDates: string[];
}

interface RangeSegment {
	month: string;
	from: string;
	to: string;
	fullMonth: boolean;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

async function calculateProceeds(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const { options } = ctx.args;
	const refresh = options.refresh === true;

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const vendorNumber = resolveVendorNumber(options, creds.vendorNumber);
	if (!vendorNumber) {
		printMissingVendorHelp();
		process.exit(1);
	}

	const month = (options.month as string | undefined)?.trim();
	const from = (options.from as string | undefined)?.trim();
	const to = (options.to as string | undefined)?.trim();

	const mode = resolveQueryMode(month, from, to);
	if (!mode) {
		printError(
			"Use either --month YYYY-MM or --from YYYY-MM-DD --to YYYY-MM-DD",
		);
		process.exit(1);
	}

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	try {
		if (mode === "month") {
			if (!month || !MONTH_PATTERN.test(month)) {
				printError("--month must be in YYYY-MM format");
				process.exit(1);
			}

			const monthResult = await getMonthRows({
				client,
				vendorNumber,
				month,
				refresh,
			});
			const proceeds = summarizeDeveloperProceeds(monthResult.rows);
			const result = {
				mode: "month",
				month,
				vendorNumber,
				source: monthResult.source,
				cachePath: monthResult.cachePath,
				totalDeveloperProceeds: round2(proceeds.totalDeveloperProceeds),
				byCurrency: roundCurrencyMap(proceeds.byCurrency),
				rowCount: proceeds.rowCount,
				missingDates: monthResult.missingDates,
			};

			printOutput(result, format);
			if (!ctx.global.raw && format !== "raw") {
				printSuccess(
					`Calculated proceeds for ${month}: ${round2(proceeds.totalDeveloperProceeds)}`,
				);
				if (monthResult.cachePath) {
					printInfo(`Cache: ${monthResult.cachePath}`);
				}
				if (monthResult.missingDates.length > 0) {
					printInfo(
						`Missing unpublished dates: ${monthResult.missingDates.join(", ")}`,
					);
				}
			}
			return;
		}

		if (!from || !to) {
			printError("Both --from and --to are required for range mode");
			process.exit(1);
		}

		const fromDate = parseIsoDateStrict(from);
		const toDate = parseIsoDateStrict(to);
		if (!fromDate || !toDate) {
			printError("--from and --to must be in YYYY-MM-DD format");
			process.exit(1);
		}
		if (fromDate > toDate) {
			printError("--from must be on or before --to");
			process.exit(1);
		}

		const segments = buildRangeSegments(fromDate, toDate);
		const allRows: SalesReportRow[] = [];
		const missingDates = new Set<string>();
		const segmentResults: Array<{
			month: string;
			from: string;
			to: string;
			fullMonth: boolean;
			source: string;
			cachePath?: string;
			rowCount: number;
			totalDeveloperProceeds: number;
		}> = [];

		for (const segment of segments) {
			if (segment.fullMonth) {
				const monthResult = await getMonthRows({
					client,
					vendorNumber,
					month: segment.month,
					refresh,
				});
				const summary = summarizeDeveloperProceeds(monthResult.rows);
				allRows.push(...monthResult.rows);
				for (const missingDate of monthResult.missingDates) {
					missingDates.add(missingDate);
				}
				segmentResults.push({
					month: segment.month,
					from: segment.from,
					to: segment.to,
					fullMonth: true,
					source: monthResult.source,
					cachePath: monthResult.cachePath,
					rowCount: summary.rowCount,
					totalDeveloperProceeds: round2(summary.totalDeveloperProceeds),
				});
				continue;
			}

			const dailyResult = await getDailyRowsForDateRange({
				client,
				vendorNumber,
				startDate: segment.from,
				endDate: segment.to,
				refresh,
			});
			const summary = summarizeDeveloperProceeds(dailyResult.rows);
			allRows.push(...dailyResult.rows);
			for (const missingDate of dailyResult.missingDates) {
				missingDates.add(missingDate);
			}
			segmentResults.push({
				month: segment.month,
				from: segment.from,
				to: segment.to,
				fullMonth: false,
				source: dailyResult.source,
				cachePath: dailyResult.cachePath,
				rowCount: summary.rowCount,
				totalDeveloperProceeds: round2(summary.totalDeveloperProceeds),
			});
		}

		const proceeds = summarizeDeveloperProceeds(allRows);
		const result = {
			mode: "range",
			from,
			to,
			vendorNumber,
			totalDeveloperProceeds: round2(proceeds.totalDeveloperProceeds),
			byCurrency: roundCurrencyMap(proceeds.byCurrency),
			rowCount: proceeds.rowCount,
			missingDates: [...missingDates].sort((a, b) => a.localeCompare(b)),
			segments: segmentResults,
		};

		printOutput(result, format);
		if (!ctx.global.raw && format !== "raw") {
			printSuccess(
				`Calculated proceeds for ${from} to ${to}: ${round2(proceeds.totalDeveloperProceeds)}`,
			);
		}
	} catch (error) {
		if (error instanceof Error) {
			printError(`Failed to calculate proceeds: ${error.message}`);
		} else {
			printError("Failed to calculate proceeds");
		}
		process.exit(1);
	}
}

async function getMonthRows(params: {
	client: Client;
	vendorNumber: string;
	month: string;
	refresh: boolean;
}): Promise<ProceedsMonthResult> {
	const { client, vendorNumber, month, refresh } = params;
	const monthPath = getReportsMonthCsvPath(vendorNumber, month);

	if (!refresh) {
		const cached = await readCachedRows(monthPath);
		if (cached) {
			return {
				rows: cached,
				source: "cache-monthly",
				cachePath: monthPath,
				missingDates: [],
			};
		}
	}

	try {
		const rows = await downloadSalesRows(client, {
			vendorNumber,
			reportType: "SALES",
			reportSubType: "SUMMARY",
			frequency: "MONTHLY",
			reportDate: month,
			version: "1_0",
		});

		await writeRowsToCsv(monthPath, rows);
		return {
			rows,
			source: "fetched-monthly",
			cachePath: monthPath,
			missingDates: [],
		};
	} catch (error) {
		if (isNotFoundError(error)) {
			const parsedMonth = parseIsoMonthStrict(month);
			if (!parsedMonth) {
				throw new Error(`Invalid month format: ${month}`);
			}
			const monthStart = `${month}-01`;
			const monthEnd = formatDate(getMonthEndDate(parsedMonth));
			const dailyResult = await getDailyRowsForDateRange({
				client,
				vendorNumber,
				startDate: monthStart,
				endDate: monthEnd,
				refresh,
			});
			return {
				rows: dailyResult.rows,
				source: "daily-fallback",
				cachePath: dailyResult.cachePath,
				missingDates: dailyResult.missingDates,
			};
		}
		throw error;
	}
}

async function getDailyRowsForDateRange(params: {
	client: Client;
	vendorNumber: string;
	startDate: string;
	endDate: string;
	refresh: boolean;
}): Promise<ProceedsDailyResult> {
	const { client, vendorNumber, startDate, endDate, refresh } = params;
	const dates = getDateStringsInRange(startDate, endDate);
	const rows: SalesReportRow[] = [];
	const missingDates: string[] = [];
	let usedCache = false;
	let downloaded = false;

	for (const date of dates) {
		const dailyPath = getReportsDailyCsvPath(vendorNumber, date);

		if (!refresh) {
			const cached = await readCachedRows(dailyPath);
			if (cached) {
				rows.push(...cached);
				usedCache = true;
				continue;
			}
		}

		try {
			const dailyRows = await downloadSalesRows(client, {
				vendorNumber,
				reportType: "SALES",
				reportSubType: "SUMMARY",
				frequency: "DAILY",
				reportDate: date,
				version: "1_0",
			});
			await writeRowsToCsv(dailyPath, dailyRows);
			rows.push(...dailyRows);
			downloaded = true;
		} catch (error) {
			if (isNotFoundError(error)) {
				missingDates.push(date);
				continue;
			}
			throw error;
		}
	}

	const source = downloaded
		? usedCache
			? "mixed-daily"
			: "fetched-daily"
		: "cache-daily";

	return {
		rows,
		source,
		cachePath:
			dates.length > 0
				? dirname(getReportsDailyCsvPath(vendorNumber, dates[0]))
				: undefined,
		missingDates,
	};
}

async function downloadSalesRows(
	client: Client,
	params: {
		vendorNumber: string;
		reportType: SalesReportType;
		reportSubType: SalesReportSubType;
		frequency: SalesReportFrequency;
		reportDate: string;
		version: SalesReportVersion;
	},
): Promise<SalesReportRow[]> {
	const stream = await client.downloadSalesReport(params);
	const compressedBuffer = await readStreamToBuffer(stream);
	const decompressed = gunzipSync(compressedBuffer);
	return parseTSV(decompressed.toString("utf-8"));
}

async function readCachedRows(path: string): Promise<SalesReportRow[] | null> {
	try {
		const content = await readFile(path, "utf-8");
		return parseSalesCsv(content);
	} catch {
		return null;
	}
}

async function writeRowsToCsv(
	path: string,
	rows: SalesReportRow[],
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, salesRowsToCsv(rows));
}

async function readStreamToBuffer(stream: ReadableStream): Promise<Buffer> {
	const chunks: Uint8Array[] = [];
	const reader = stream.getReader();

	while (true) {
		const result = await reader.read();
		if (result.done) break;
		chunks.push(result.value);
	}

	return Buffer.concat(chunks);
}

function resolveVendorNumber(
	options: Record<string, string | boolean | undefined>,
	profileVendorNumber: string | undefined,
): string | undefined {
	return (
		(options.vendor as string) ||
		process.env.ASC_VENDOR_NUMBER ||
		process.env.ASC_ANALYTICS_VENDOR_NUMBER ||
		profileVendorNumber
	);
}

function printMissingVendorHelp(): void {
	printError(
		"--vendor is required (or set ASC_VENDOR_NUMBER env, or add to profile with 'asc auth edit')",
	);
	console.error(
		"\nTo find your vendor number:\n" +
			"  1. Go to https://appstoreconnect.apple.com/\n" +
			"  2. Navigate to 'Sales and Trends' or 'Payments and Financial Reports'\n" +
			"  3. Your vendor number is displayed at the top (usually 8 digits)\n" +
			"\nYou can add it to your profile with:\n" +
			"  asc auth edit -n <profile-name> -v <vendor-number>\n",
	);
}

function resolveQueryMode(
	month: string | undefined,
	from: string | undefined,
	to: string | undefined,
): QueryMode | null {
	if (month && !from && !to) {
		return "month";
	}

	if (!month && from && to) {
		return "range";
	}

	return null;
}

function parseIsoMonthStrict(month: string): Date | null {
	if (!MONTH_PATTERN.test(month)) {
		return null;
	}
	const [year, monthPart] = month
		.split("-")
		.map((value) => Number.parseInt(value, 10));
	const date = new Date(Date.UTC(year, monthPart - 1, 1));
	return formatMonth(date) === month ? date : null;
}

function parseIsoDateStrict(date: string): Date | null {
	if (!DATE_PATTERN.test(date)) {
		return null;
	}
	const [year, month, day] = date
		.split("-")
		.map((value) => Number.parseInt(value, 10));
	const parsed = new Date(Date.UTC(year, month - 1, day));
	return formatDate(parsed) === date ? parsed : null;
}

function getMonthEndDate(monthStart: Date): Date {
	return new Date(
		Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
	);
}

function formatDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatMonth(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

function getDateStringsInRange(startDate: string, endDate: string): string[] {
	const start = parseIsoDateStrict(startDate);
	const end = parseIsoDateStrict(endDate);
	if (!start || !end) {
		return [];
	}

	const dates: string[] = [];
	for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
		dates.push(formatDate(d));
	}
	return dates;
}

function buildRangeSegments(startDate: Date, endDate: Date): RangeSegment[] {
	const segments: RangeSegment[] = [];
	let cursor = new Date(startDate);

	while (cursor <= endDate) {
		const monthStart = new Date(
			Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1),
		);
		const monthEnd = new Date(
			Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
		);
		const segmentStart = cursor;
		const segmentEnd = monthEnd < endDate ? monthEnd : endDate;

		segments.push({
			month: formatMonth(segmentStart),
			from: formatDate(segmentStart),
			to: formatDate(segmentEnd),
			fullMonth:
				formatDate(segmentStart) === formatDate(monthStart) &&
				formatDate(segmentEnd) === formatDate(monthEnd),
		});

		cursor = addDays(segmentEnd, 1);
	}

	return segments;
}

function addDays(date: Date, days: number): Date {
	return new Date(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate() + days,
		),
	);
}

function isNotFoundError(error: unknown): boolean {
	return error instanceof AppStoreConnectError && error.isNotFound;
}

function round2(value: number): number {
	return Number(value.toFixed(2));
}

function roundCurrencyMap(
	values: Record<string, number>,
): Record<string, number> {
	const result: Record<string, number> = {};
	for (const [currency, amount] of Object.entries(values)) {
		const rounded = round2(amount);
		if (rounded !== 0) {
			result[currency] = rounded;
		}
	}
	return result;
}

async function downloadSalesReport(ctx: CommandContext): Promise<void> {
	const { options } = ctx.args;

	const creds = await requireCredentials({ profile: ctx.global.profile });

	// Get vendor number from flag, env, or profile
	const vendorNumber = resolveVendorNumber(options, creds.vendorNumber);

	if (!vendorNumber) {
		printMissingVendorHelp();
		process.exit(1);
	}

	const reportType = options.type as string;
	const reportSubType = options.subtype as string;
	const frequency = options.frequency as string;
	const reportDate = options.date as string;
	const version = (options.version as string) || "1_0";
	const decompress = options.decompress === true;
	const parse = options.parse === true;

	// Validate report type
	const validTypes: SalesReportType[] = [
		"SALES",
		"PRE_ORDER",
		"NEWSSTAND",
		"SUBSCRIPTION",
		"SUBSCRIPTION_EVENT",
	];
	if (!validTypes.includes(reportType as SalesReportType)) {
		printError(
			`Invalid report type: ${reportType}. Must be one of: ${validTypes.join(", ")}`,
		);
		process.exit(1);
	}

	// Validate subtype
	const validSubTypes: SalesReportSubType[] = ["SUMMARY", "DETAILED"];
	if (!validSubTypes.includes(reportSubType as SalesReportSubType)) {
		printError(
			`Invalid report subtype: ${reportSubType}. Must be one of: ${validSubTypes.join(", ")}`,
		);
		process.exit(1);
	}

	// Validate frequency
	const validFrequencies: SalesReportFrequency[] = [
		"DAILY",
		"WEEKLY",
		"MONTHLY",
		"YEARLY",
	];
	if (!validFrequencies.includes(frequency as SalesReportFrequency)) {
		printError(
			`Invalid frequency: ${frequency}. Must be one of: ${validFrequencies.join(", ")}`,
		);
		process.exit(1);
	}

	// Validate version
	const validVersions: SalesReportVersion[] = ["1_0", "1_1"];
	if (!validVersions.includes(version as SalesReportVersion)) {
		printError(
			`Invalid version: ${version}. Must be one of: ${validVersions.join(", ")}`,
		);
		process.exit(1);
	}

	// Determine output path
	const defaultOutput = `sales_report_${reportDate}_${reportType}.tsv.gz`;
	const compressedPath = (options.output as string) || defaultOutput;
	const decompressedPath = compressedPath.replace(/\.gz$/, "");

	const format = getOutputFormat(ctx.global);

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	try {
		// Download the report
		const stream = await client.downloadSalesReport({
			vendorNumber,
			reportType,
			reportSubType,
			frequency,
			reportDate,
			version,
		});

		// Convert stream to buffer
		const chunks: Uint8Array[] = [];
		const reader = stream.getReader();

		// Read all chunks from the stream
		while (true) {
			const result = await reader.read();
			if (result.done) break;
			chunks.push(result.value);
		}

		const buffer = Buffer.concat(chunks);

		// Ensure output directory exists
		const outputDir = dirname(compressedPath);
		if (outputDir !== "." && outputDir !== "") {
			await mkdir(outputDir, { recursive: true });
		}

		// Write compressed file
		await writeFile(compressedPath, buffer);
		const compressedSize = buffer.length;

		let decompressedSize = 0;

		// Decompress if requested or if parsing is requested
		if (decompress || parse) {
			const decompressed = gunzipSync(buffer);
			await writeFile(decompressedPath, decompressed);
			decompressedSize = decompressed.length;

			// Parse and show summary if requested
			if (parse) {
				try {
					const tsvContent = decompressed.toString("utf-8");
					const rows = parseTSV(tsvContent);
					const summary = summarizeSalesData(rows);
					const formatted = formatSalesSummary(summary);

					if (!ctx.global.raw && format !== "raw") {
						printOutput(formatted, format);
					}
				} catch (parseError) {
					if (parseError instanceof Error) {
						printError(`Failed to parse TSV data: ${parseError.message}`);
					}
					// Continue anyway, file was still downloaded
				}
			}
		}

		// Create result object
		const result: SalesReportResult = {
			vendorNumber,
			reportType,
			reportSubType,
			frequency,
			reportDate,
			version,
			filePath: compressedPath,
			fileSize: compressedSize,
			decompressed: decompress || parse,
			decompressedPath: decompress || parse ? decompressedPath : undefined,
			decompressedSize: decompress || parse ? decompressedSize : undefined,
		};

		// Print output
		printOutput(result, format);

		if (!ctx.global.raw && format !== "raw") {
			printSuccess(`Report downloaded to ${compressedPath}`);
			if (decompress || parse) {
				printSuccess(`Decompressed to ${decompressedPath}`);
			}
		}
	} catch (error) {
		if (error instanceof Error) {
			printError(`Failed to download sales report: ${error.message}`);
		} else {
			printError("Failed to download sales report");
		}
		process.exit(1);
	}
}

async function createAnalyticsRequest(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const { options } = ctx.args;

	const appId = options.app as string;
	const accessType =
		(options["access-type"] as AnalyticsAccessType) || "ONGOING";

	if (!appId) {
		printError("--app is required");
		process.exit(1);
	}

	// Validate access type
	const validAccessTypes: AnalyticsAccessType[] = [
		"ONGOING",
		"ONE_TIME_SNAPSHOT",
	];
	if (!validAccessTypes.includes(accessType)) {
		printError(
			`Invalid access type: ${accessType}. Must be one of: ${validAccessTypes.join(", ")}`,
		);
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	try {
		const response: AnalyticsReportRequestResponse =
			await client.createAnalyticsReportRequest(appId, accessType);
		printOutput(response, format);

		if (!ctx.global.raw && format !== "raw") {
			printSuccess(`Analytics report request created: ${response.data.id}`);
			printInfo(`Access type: ${response.data.attributes.accessType}`);
		}
	} catch (error) {
		if (error instanceof Error) {
			printError(`Failed to create analytics report request: ${error.message}`);
		} else {
			printError("Failed to create analytics report request");
		}
		process.exit(1);
	}
}

async function listAnalyticsRequests(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const { options } = ctx.args;

	const appId = options.app as string;

	if (!appId) {
		printError("--app is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	try {
		const response: AnalyticsReportRequestsResponse =
			await client.getAnalyticsReportRequests(appId);
		printOutput(response, format);

		if (!ctx.global.raw && format !== "raw") {
			const count = response.data.length;
			printInfo(
				`Found ${count} analytics report request${count !== 1 ? "s" : ""}`,
			);
		}
	} catch (error) {
		if (error instanceof Error) {
			printError(`Failed to list analytics report requests: ${error.message}`);
		} else {
			printError("Failed to list analytics report requests");
		}
		process.exit(1);
	}
}

async function listAnalyticsReports(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const { options } = ctx.args;

	const requestId = options["request-id"] as string;

	if (!requestId) {
		printError("--request-id is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	try {
		const response = await client.getAnalyticsReports(requestId);
		printOutput(response, format);

		if (!ctx.global.raw && format !== "raw") {
			const count = response.data.length;
			printInfo(`Found ${count} analytics report${count !== 1 ? "s" : ""}`);
		}
	} catch (error) {
		if (error instanceof Error) {
			printError(`Failed to list analytics reports: ${error.message}`);
		} else {
			printError("Failed to list analytics reports");
		}
		process.exit(1);
	}
}

async function listAnalyticsInstances(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const { options } = ctx.args;

	const reportId = options["report-id"] as string;

	if (!reportId) {
		printError("--report-id is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	try {
		const response: AnalyticsReportInstancesResponse =
			await client.getAnalyticsReportInstances(reportId);
		printOutput(response, format);

		if (!ctx.global.raw && format !== "raw") {
			const count = response.data.length;
			printInfo(`Found ${count} report instance${count !== 1 ? "s" : ""}`);
		}
	} catch (error) {
		if (error instanceof Error) {
			printError(`Failed to list analytics report instances: ${error.message}`);
		} else {
			printError("Failed to list analytics report instances");
		}
		process.exit(1);
	}
}

async function downloadAnalyticsReport(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const { options } = ctx.args;

	const instanceId = options["instance-id"] as string;
	const outputPath = options.output as string | undefined;

	if (!instanceId) {
		printError("--instance-id is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	try {
		// Get segments for the instance
		const segmentsResponse: AnalyticsReportSegmentsResponse =
			await client.getAnalyticsReportSegments(instanceId);

		if (segmentsResponse.data.length === 0) {
			printError("No segments found for this report instance");
			process.exit(1);
		}

		// Download all segments
		const downloadedFiles: string[] = [];
		const totalSize: number[] = [];

		for (let i = 0; i < segmentsResponse.data.length; i++) {
			const segment = segmentsResponse.data[i];
			const downloadUrl = segment.attributes.url;

			// Determine output filename
			let filename: string;
			if (outputPath) {
				// If multiple segments, append segment number
				if (segmentsResponse.data.length > 1) {
					const ext = outputPath.match(/\.[^.]+$/)?.[0] || "";
					const base = outputPath.replace(/\.[^.]+$/, "");
					filename = `${base}_segment_${i}${ext}`;
				} else {
					filename = outputPath;
				}
			} else {
				filename = `analytics_report_${instanceId}_segment_${i}.csv`;
			}

			// Download segment
			const stream = await client.downloadAnalyticsReport(downloadUrl);

			// Convert stream to buffer
			const chunks: Uint8Array[] = [];
			const reader = stream.getReader();

			while (true) {
				const result = await reader.read();
				if (result.done) break;
				chunks.push(result.value);
			}

			const buffer = Buffer.concat(chunks);

			// Ensure output directory exists
			const outputDir = dirname(filename);
			if (outputDir !== "." && outputDir !== "") {
				await mkdir(outputDir, { recursive: true });
			}

			// Write file
			await writeFile(filename, buffer);
			downloadedFiles.push(filename);
			totalSize.push(buffer.length);
		}

		// Create result object
		const result = {
			instanceId,
			segmentCount: segmentsResponse.data.length,
			files: downloadedFiles,
			totalSize: totalSize.reduce((sum, size) => sum + size, 0),
		};

		printOutput(result, format);

		if (!ctx.global.raw && format !== "raw") {
			printSuccess(
				`Downloaded ${downloadedFiles.length} segment${downloadedFiles.length !== 1 ? "s" : ""}`,
			);
			for (const file of downloadedFiles) {
				printInfo(`  ${file}`);
			}
		}
	} catch (error) {
		if (error instanceof Error) {
			printError(`Failed to download analytics report: ${error.message}`);
		} else {
			printError("Failed to download analytics report");
		}
		process.exit(1);
	}
}

export function registerAnalyticsCommands(): void {
	registry.register(analyticsCommand);
}
