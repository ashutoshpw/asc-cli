import { Client } from "../../../api/client";
import type {
	AppStoreVersionResponse,
	AppStoreVersionsResponse,
} from "../../../api/types/versions";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * Versions commands
 * asc versions list/get/create/update
 */
import { type Command, type CommandContext, registry } from "../../router";

const versionsCommand: Command = {
	name: "versions",
	description: "Manage App Store versions",
	subcommands: {
		list: {
			name: "list",
			description: "List App Store versions",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
				limit: {
					type: "string",
					short: "l",
					description: "Maximum number of versions to return",
					default: "50",
				},
				platform: {
					type: "string",
					description: "Filter by platform (IOS, MAC_OS, TV_OS, VISION_OS)",
				},
				state: {
					type: "string",
					description: "Filter by app store state",
				},
				sort: {
					type: "string",
					short: "s",
					description: "Sort order",
					default: "-createdDate",
				},
			},
			execute: listVersions,
		},
		get: {
			name: "get",
			description: "Get version by ID",
			options: {
				version: {
					type: "string",
					short: "v",
					description: "Version ID",
					required: true,
				},
				include: {
					type: "string",
					description: "Include related resources (comma-separated)",
				},
			},
			execute: getVersion,
		},
		create: {
			name: "create",
			description: "Create a new App Store version",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
				"version-string": {
					type: "string",
					short: "v",
					description: "Version string (e.g., 1.0.0)",
					required: true,
				},
				platform: {
					type: "string",
					description: "Platform (IOS, MAC_OS, TV_OS, VISION_OS)",
					default: "IOS",
				},
				"release-type": {
					type: "string",
					description: "Release type (MANUAL, AFTER_APPROVAL, SCHEDULED)",
					default: "AFTER_APPROVAL",
				},
				copyright: {
					type: "string",
					description: "Copyright text",
				},
			},
			execute: createVersion,
		},
		update: {
			name: "update",
			description: "Update an App Store version",
			options: {
				version: {
					type: "string",
					short: "v",
					description: "Version ID",
					required: true,
				},
				"version-string": {
					type: "string",
					description: "New version string",
				},
				"release-type": {
					type: "string",
					description: "Release type (MANUAL, AFTER_APPROVAL, SCHEDULED)",
				},
				copyright: {
					type: "string",
					description: "Copyright text",
				},
				downloadable: {
					type: "boolean",
					description: "Whether the version is downloadable",
				},
			},
			execute: updateVersion,
		},
	},
};

async function listVersions(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = ctx.args.options.app as string;

	if (!appId) {
		printError("--app is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const opts = ctx.args.options;
	const limit = Number.parseInt(opts.limit as string, 10) || 50;

	// Build query params
	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));
	params.set("sort", (opts.sort as string) || "-createdDate");

	if (opts.platform) {
		params.set("filter[platform]", opts.platform as string);
	}
	if (opts.state) {
		params.set("filter[appStoreState]", opts.state as string);
	}

	const response = await client.get<AppStoreVersionsResponse>(
		`/v1/apps/${appId}/appStoreVersions?${params.toString()}`,
	);
	printOutput(response, format);
}

async function getVersion(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const versionId = ctx.args.options.version as string;

	if (!versionId) {
		printError("--version is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const include = ctx.args.options.include as string | undefined;
	let path = `/v1/appStoreVersions/${versionId}`;

	if (include) {
		path += `?include=${encodeURIComponent(include)}`;
	}

	const response = await client.get<AppStoreVersionResponse>(path);
	printOutput(response, format);
}

async function createVersion(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const opts = ctx.args.options;

	const appId = opts.app as string;
	const versionString = opts["version-string"] as string;

	if (!appId) {
		printError("--app is required");
		process.exit(1);
	}
	if (!versionString) {
		printError("--version-string is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const attributes: Record<string, unknown> = {
		platform: (opts.platform as string) || "IOS",
		versionString,
		releaseType: opts["release-type"] || "AFTER_APPROVAL",
	};

	if (opts.copyright) {
		attributes.copyright = opts.copyright;
	}

	const response = await client.post<AppStoreVersionResponse>(
		"/v1/appStoreVersions",
		{
			data: {
				type: "appStoreVersions",
				attributes,
				relationships: {
					app: {
						data: {
							type: "apps",
							id: appId,
						},
					},
				},
			},
		},
	);

	printSuccess(`Created version ${versionString}`);
	printOutput(response, format);
}

async function updateVersion(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const versionId = ctx.args.options.version as string;

	if (!versionId) {
		printError("--version is required");
		process.exit(1);
	}

	const opts = ctx.args.options;
	const attributes: Record<string, unknown> = {};

	if (opts["version-string"]) {
		attributes.versionString = opts["version-string"];
	}
	if (opts["release-type"]) {
		attributes.releaseType = opts["release-type"];
	}
	if (opts.copyright) {
		attributes.copyright = opts.copyright;
	}
	if (opts.downloadable !== undefined) {
		attributes.downloadable = opts.downloadable;
	}

	if (Object.keys(attributes).length === 0) {
		printError("At least one attribute to update is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.patch<AppStoreVersionResponse>(
		`/v1/appStoreVersions/${versionId}`,
		{
			data: {
				type: "appStoreVersions",
				id: versionId,
				attributes,
			},
		},
	);

	printSuccess(`Updated version ${versionId}`);
	printOutput(response, format);
}

export function registerVersionsCommands(): void {
	registry.register(versionsCommand);
}
