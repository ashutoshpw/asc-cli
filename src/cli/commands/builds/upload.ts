import { open } from "node:fs/promises";
import { resolve } from "node:path";
import {
	commitBuildUploadFile,
	createBuildUpload,
	createBuildUploadFile,
	getBuildUpload,
} from "../../../api/build-uploads";
import { Client } from "../../../api/client";
import type { BinaryUploadOperation } from "../../../api/client-types";
import type {
	BuildUpload,
	BuildUploadFile,
	BuildUploadOperation,
} from "../../../api/types/build-uploads";
import type { BuildResource, BuildResponse } from "../../../api/types/builds";
import type { AppStorePlatform } from "../../../api/types/commerce-versions";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import { loadEnvConfig } from "../../../utils/env";
import {
	type BuildPackageMetadata,
	inspectBuildPackageBytes,
} from "../../../utils/package-inspector";
import { sleep } from "../../../utils/retry";
import type { Command, CommandContext } from "../../router";

const PLATFORMS: AppStorePlatform[] = ["IOS", "MAC_OS", "TV_OS", "VISION_OS"];
const DEFAULT_UPLOAD_TIMEOUT = 120_000;
const POLL_INTERVAL = 2_000;

export interface WaitForBuildResult {
	upload: BuildUpload;
	build?: BuildResource;
}

export interface PollOptions {
	timeoutMs: number;
	now?: () => number;
	sleepFn?: (milliseconds: number) => Promise<void>;
}

function parsePlatform(
	value: string | undefined,
): AppStorePlatform | undefined {
	if (!value) return undefined;
	const platform = value.toUpperCase() as AppStorePlatform;
	if (!PLATFORMS.includes(platform)) {
		throw new Error(
			`Invalid platform. Must be one of: ${PLATFORMS.join(", ")}`,
		);
	}
	return platform;
}

function parseTimeout(value: string | undefined): number | undefined {
	if (value === undefined) return undefined;
	const timeout = Number(value);
	if (!Number.isSafeInteger(timeout) || timeout <= 0) {
		throw new Error("--timeout must be a positive integer in milliseconds");
	}
	return timeout;
}

function requireMetadata(
	metadata: BuildPackageMetadata,
	options: Record<string, string | boolean | undefined>,
): {
	marketingVersion: string;
	buildNumber: string;
	platform: AppStorePlatform;
} {
	const marketingVersion =
		(options.version as string | undefined) ?? metadata.marketingVersion;
	const buildNumber =
		(options["build-number"] as string | undefined) ?? metadata.buildNumber;
	const platform =
		parsePlatform(options.platform as string | undefined) ?? metadata.platform;
	const missing = [
		!marketingVersion && "--version",
		!buildNumber && "--build-number",
		!platform && "--platform",
	].filter((value): value is string => Boolean(value));
	if (missing.length > 0) {
		throw new Error(
			`Could not determine ${missing.join(", ")}; provide the missing flag${missing.length === 1 ? "" : "s"}`,
		);
	}
	if (!marketingVersion || !buildNumber || !platform) {
		throw new Error("Build metadata is incomplete");
	}
	return { marketingVersion, buildNumber, platform };
}

function toBinaryOperation(
	operation: BuildUploadOperation,
): BinaryUploadOperation {
	return {
		method: operation.method,
		url: operation.url,
		length: operation.length,
		offset: operation.offset,
		requestHeaders: operation.requestHeaders,
	};
}

function checksumHex(bytes: Uint8Array): Promise<string> {
	const input = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(input).set(bytes);
	return crypto.subtle
		.digest("SHA-256", input)
		.then((digest) =>
			[...new Uint8Array(digest)]
				.map((value) => value.toString(16).padStart(2, "0"))
				.join(""),
		);
}

function uploadError(upload: BuildUpload): string {
	const details = upload.attributes?.state?.errors;
	if (!details || details.length === 0) return "Build upload failed";
	return details
		.map((detail) =>
			String(detail.description ?? detail.code ?? "Unknown upload error"),
		)
		.join("; ");
}

export async function waitForBuildUpload(
	client: Client,
	uploadId: string,
	initialUpload: BuildUpload,
	options: PollOptions,
): Promise<WaitForBuildResult> {
	const now = options.now ?? Date.now;
	const sleepFn = options.sleepFn ?? sleep;
	const deadline = now() + options.timeoutMs;
	let upload = initialUpload;

	while (now() <= deadline) {
		const state = upload.attributes?.state?.state;
		if (state === "FAILED")
			throw new Error(`${uploadError(upload)} (upload ${uploadId})`);

		if (state === "COMPLETE") {
			const buildId = upload.relationships?.build?.data?.id;
			if (buildId) {
				const response = await client.get<BuildResponse>(
					`/v1/builds/${buildId}`,
				);
				const build = response.data;
				const processingState = build.attributes?.processingState;
				if (processingState === "VALID") {
					return { upload, build };
				}
				if (processingState === "FAILED" || processingState === "INVALID") {
					throw new Error(
						`Build ${buildId} processing state is ${processingState}`,
					);
				}
			}
		}

		const remaining = deadline - now();
		if (remaining <= 0) break;
		await sleepFn(Math.min(POLL_INTERVAL, remaining));
		upload = await getBuildUpload(client, uploadId);
	}

	throw new Error(`Timed out waiting for build upload ${uploadId}`);
}

export async function uploadBuild(ctx: CommandContext): Promise<void> {
	const options = ctx.args.options;
	const appId = options.app as string | undefined;
	const inputPath = options.file as string | undefined;
	if (!appId) throw new Error("--app is required");
	if (!inputPath) throw new Error("--file is required");

	const filePath = resolve(inputPath);
	const file = await open(filePath, "r");
	let bytes: Uint8Array;
	try {
		const fileStat = await file.stat();
		if (!fileStat.isFile())
			throw new Error(`Build path is not a file: ${inputPath}`);
		if (fileStat.size < 1 || fileStat.size > Number.MAX_SAFE_INTEGER) {
			throw new Error(
				"Build file size must be between 1 byte and Number.MAX_SAFE_INTEGER",
			);
		}

		bytes = new Uint8Array(await file.readFile());
		if (bytes.byteLength !== fileStat.size) {
			throw new Error("Build file changed while it was being read");
		}
	} finally {
		await file.close();
	}
	const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
	const inspected = inspectBuildPackageBytes(bytes, fileName);
	const packageMetadata = requireMetadata(inspected, options);
	const timeoutMs =
		parseTimeout(options.timeout as string | undefined) ??
		loadEnvConfig().uploadTimeout ??
		DEFAULT_UPLOAD_TIMEOUT;

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
		timeout: timeoutMs,
	});

	const upload = await createBuildUpload(client, {
		appId,
		...packageMetadata,
	});
	const uploadFile = await createBuildUploadFile(client, {
		uploadId: upload.id,
		fileName,
		fileSize: bytes.byteLength,
		uti: inspected.uti,
		assetType: "ASSET",
	});

	const operations = [...(uploadFile.attributes?.uploadOperations ?? [])].sort(
		(a, b) => (a.partNumber ?? a.offset) - (b.partNumber ?? b.offset),
	);
	if (operations.length === 0) {
		throw new Error(
			`Build upload file ${uploadFile.id} returned no upload operations`,
		);
	}

	const startedAt = Date.now();
	for (const operation of operations) {
		if (
			!Number.isSafeInteger(operation.offset) ||
			!Number.isSafeInteger(operation.length)
		) {
			throw new Error(
				"Build upload returned an invalid operation offset or length",
			);
		}
		const end = operation.offset + operation.length;
		if (
			operation.offset < 0 ||
			operation.length < 1 ||
			end > bytes.byteLength
		) {
			throw new Error("Build upload operation exceeds the local file bounds");
		}
		const remaining = timeoutMs - (Date.now() - startedAt);
		if (remaining <= 0)
			throw new Error(`Timed out uploading build ${upload.id}`);
		await client.uploadBinary(
			toBinaryOperation(operation),
			bytes.slice(operation.offset, end),
			{ timeout: remaining },
		);
	}

	const checksum = await checksumHex(bytes);
	const committedFile = await commitBuildUploadFile(
		client,
		uploadFile.id,
		checksum,
	);
	let waitResult: WaitForBuildResult | undefined;
	if (options.wait === true) {
		waitResult = await waitForBuildUpload(client, upload.id, upload, {
			timeoutMs,
		});
	}

	const format = getOutputFormat(ctx.global);
	printOutput(
		{
			upload: waitResult?.upload ?? upload,
			file: committedFile,
			metadata: { ...inspected, ...packageMetadata },
			checksum,
			build: waitResult?.build,
		},
		format,
	);
	if (!ctx.global.raw && format !== "raw") {
		printSuccess(`Uploaded ${fileName} as build upload ${upload.id}`);
	}
}

export const uploadCommand: Command = {
	name: "upload",
	description: "Upload an IPA or PKG build",
	options: {
		app: { type: "string", short: "a", description: "App ID", required: true },
		file: {
			type: "string",
			short: "f",
			description: "Path to an IPA or PKG file",
			required: true,
		},
		version: { type: "string", description: "Marketing version override" },
		"build-number": { type: "string", description: "CFBundleVersion override" },
		platform: { type: "string", description: "Platform override" },
		wait: {
			type: "boolean",
			description: "Wait for upload and build processing",
			default: false,
		},
		timeout: { type: "string", description: "Timeout in milliseconds" },
	},
	execute: uploadBuild,
};
