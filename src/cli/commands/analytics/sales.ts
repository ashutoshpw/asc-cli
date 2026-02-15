import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { Client } from "../../../api/client";
import type {
	SalesReportFrequency,
	SalesReportResult,
	SalesReportSubType,
	SalesReportType,
	SalesReportVersion,
} from "../../../api/types/analytics";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import {
	formatSalesSummary,
	parseTSV,
	summarizeSalesData,
} from "../../../utils/tsv";
import type { CommandContext } from "../../router";
import {
	printMissingVendorHelp,
	readStreamToBuffer,
	resolveVendorNumber,
} from "./shared";

const VALID_TYPES: SalesReportType[] = [
	"SALES",
	"PRE_ORDER",
	"NEWSSTAND",
	"SUBSCRIPTION",
	"SUBSCRIPTION_EVENT",
];

const VALID_SUB_TYPES: SalesReportSubType[] = ["SUMMARY", "DETAILED"];
const VALID_FREQUENCIES: SalesReportFrequency[] = [
	"DAILY",
	"WEEKLY",
	"MONTHLY",
	"YEARLY",
];
const VALID_VERSIONS: SalesReportVersion[] = ["1_0", "1_1"];

export async function downloadSalesReport(ctx: CommandContext): Promise<void> {
	const { options } = ctx.args;
	const creds = await requireCredentials({ profile: ctx.global.profile });
	const vendorNumber = resolveVendorNumber(options, creds.vendorNumber);

	if (!vendorNumber) {
		printMissingVendorHelp(printError);
		process.exit(1);
	}

	const reportType = options.type as string;
	const reportSubType = options.subtype as string;
	const frequency = options.frequency as string;
	const reportDate = options.date as string;
	const version = (options.version as string) || "1_0";
	const decompress = options.decompress === true;
	const parse = options.parse === true;

	if (!VALID_TYPES.includes(reportType as SalesReportType)) {
		printError(
			`Invalid report type: ${reportType}. Must be one of: ${VALID_TYPES.join(", ")}`,
		);
		process.exit(1);
	}

	if (!VALID_SUB_TYPES.includes(reportSubType as SalesReportSubType)) {
		printError(
			`Invalid report subtype: ${reportSubType}. Must be one of: ${VALID_SUB_TYPES.join(", ")}`,
		);
		process.exit(1);
	}

	if (!VALID_FREQUENCIES.includes(frequency as SalesReportFrequency)) {
		printError(
			`Invalid frequency: ${frequency}. Must be one of: ${VALID_FREQUENCIES.join(", ")}`,
		);
		process.exit(1);
	}

	if (!VALID_VERSIONS.includes(version as SalesReportVersion)) {
		printError(
			`Invalid version: ${version}. Must be one of: ${VALID_VERSIONS.join(", ")}`,
		);
		process.exit(1);
	}

	const defaultOutput = `sales_report_${reportDate}_${reportType}.tsv.gz`;
	const compressedPath = (options.output as string) || defaultOutput;
	const decompressedPath = compressedPath.replace(/\.gz$/, "");
	const format = getOutputFormat(ctx.global);

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	try {
		const stream = await client.downloadSalesReport({
			vendorNumber,
			reportType,
			reportSubType,
			frequency,
			reportDate,
			version,
		});

		const buffer = await readStreamToBuffer(stream);
		const outputDir = dirname(compressedPath);
		if (outputDir !== "." && outputDir !== "") {
			await mkdir(outputDir, { recursive: true });
		}

		await writeFile(compressedPath, buffer);
		const compressedSize = buffer.length;

		let decompressedSize = 0;
		if (decompress || parse) {
			const decompressed = gunzipSync(buffer);
			await writeFile(decompressedPath, decompressed);
			decompressedSize = decompressed.length;

			if (parse) {
				try {
					const rows = parseTSV(decompressed.toString("utf-8"));
					const summary = summarizeSalesData(rows);
					const formatted = formatSalesSummary(summary);
					if (!ctx.global.raw && format !== "raw") {
						printOutput(formatted, format);
					}
				} catch (parseError) {
					if (parseError instanceof Error) {
						printError(`Failed to parse TSV data: ${parseError.message}`);
					}
				}
			}
		}

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
