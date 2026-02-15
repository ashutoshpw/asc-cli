import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Client } from "../../../api/client";
import type {
	AnalyticsAccessType,
	AnalyticsReportInstancesResponse,
	AnalyticsReportRequestResponse,
	AnalyticsReportRequestsResponse,
	AnalyticsReportSegmentsResponse,
	AnalyticsReportsResponse,
} from "../../../api/types/analytics";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printInfo,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import type { CommandContext } from "../../router";
import { readStreamToBuffer } from "./shared";

const VALID_ACCESS_TYPES: AnalyticsAccessType[] = [
	"ONGOING",
	"ONE_TIME_SNAPSHOT",
];

export async function createAnalyticsRequest(
	ctx: CommandContext,
): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const { options } = ctx.args;

	const appId = options.app as string;
	const accessType =
		(options["access-type"] as AnalyticsAccessType) || "ONGOING";

	if (!appId) {
		printError("--app is required");
		process.exit(1);
	}

	if (!VALID_ACCESS_TYPES.includes(accessType)) {
		printError(
			`Invalid access type: ${accessType}. Must be one of: ${VALID_ACCESS_TYPES.join(", ")}`,
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

export async function listAnalyticsRequests(
	ctx: CommandContext,
): Promise<void> {
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

export async function listAnalyticsReports(ctx: CommandContext): Promise<void> {
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
		const response: AnalyticsReportsResponse =
			await client.getAnalyticsReports(requestId);
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

export async function listAnalyticsInstances(
	ctx: CommandContext,
): Promise<void> {
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

export async function downloadAnalyticsReport(
	ctx: CommandContext,
): Promise<void> {
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
		const segmentsResponse: AnalyticsReportSegmentsResponse =
			await client.getAnalyticsReportSegments(instanceId);

		if (segmentsResponse.data.length === 0) {
			printError("No segments found for this report instance");
			process.exit(1);
		}

		const downloadedFiles: string[] = [];
		const totalSize: number[] = [];

		for (let i = 0; i < segmentsResponse.data.length; i++) {
			const segment = segmentsResponse.data[i];
			const downloadUrl = segment.attributes.url;

			let filename: string;
			if (outputPath) {
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

			const stream = await client.downloadAnalyticsReport(downloadUrl);
			const buffer = await readStreamToBuffer(stream);

			const outputDir = dirname(filename);
			if (outputDir !== "." && outputDir !== "") {
				await mkdir(outputDir, { recursive: true });
			}

			await writeFile(filename, buffer);
			downloadedFiles.push(filename);
			totalSize.push(buffer.length);
		}

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
