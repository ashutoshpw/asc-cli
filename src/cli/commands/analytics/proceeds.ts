import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { AppStoreConnectError, Client } from "../../../api/client";
import type {
	SalesReportFrequency,
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
import { parseTSV } from "../../../utils/tsv";
import type { CommandContext } from "../../router";
import {
	fetchSkuToBundleIdMap,
	parseGroupByMode,
	summarizeGroupedProceeds,
} from "./proceeds-grouping";
import {
	buildRangeSegments,
	formatDate,
	getDateStringsInRange,
	getMonthEndDate,
	isValidMonth,
	parseIsoDateStrict,
	parseIsoMonthStrict,
	resolveQueryMode,
	round2,
	roundCurrencyMap,
} from "./proceeds-helpers";
import {
	printMissingVendorHelp,
	readStreamToBuffer,
	resolveVendorNumber,
} from "./shared";

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

export async function calculateProceeds(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const { options } = ctx.args;
	const refresh = options.refresh === true;

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const vendorNumber = resolveVendorNumber(options, creds.vendorNumber);
	if (!vendorNumber) {
		printMissingVendorHelp(printError);
		process.exit(1);
	}

	const month = (options.month as string | undefined)?.trim();
	const from = (options.from as string | undefined)?.trim();
	const to = (options.to as string | undefined)?.trim();
	const groupBy = parseGroupByMode(
		(options["group-by"] as string | undefined)?.trim(),
	);

	if ((options["group-by"] as string | undefined) && !groupBy) {
		printError("--group-by must be one of: bundle-id, sku");
		process.exit(1);
	}

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
	const skuToBundleId =
		groupBy === "bundle-id" ? await fetchSkuToBundleIdMap(client) : undefined;

	try {
		if (mode === "month") {
			if (!month || !isValidMonth(month)) {
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
			const groupedProceeds = groupBy
				? summarizeGroupedProceeds(monthResult.rows, groupBy, skuToBundleId)
				: undefined;
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
				groupBy,
				groupedProceeds,
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
		const groupedProceeds = groupBy
			? summarizeGroupedProceeds(allRows, groupBy, skuToBundleId)
			: undefined;
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
			groupBy,
			groupedProceeds,
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

function isNotFoundError(error: unknown): boolean {
	return error instanceof AppStoreConnectError && error.isNotFound;
}
