/**
 * Analytics commands
 * asc analytics sales/request/requests/download
 */
import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { Client } from "../../../api/client";
import type {
	AnalyticsAccessType,
	AnalyticsReportInstancesResponse,
	AnalyticsReportRequestResponse,
	AnalyticsReportRequestsResponse,
	AnalyticsReportSegmentsResponse,
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
	printInfo,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
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

async function downloadSalesReport(ctx: CommandContext): Promise<void> {
	const { options } = ctx.args;

	const creds = await requireCredentials({ profile: ctx.global.profile });

	// Get vendor number from flag, env, or profile
	const vendorNumber =
		(options.vendor as string) ||
		process.env.ASC_VENDOR_NUMBER ||
		process.env.ASC_ANALYTICS_VENDOR_NUMBER ||
		creds.vendorNumber;

	if (!vendorNumber) {
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
						console.log(`\n${formatted}`);
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
