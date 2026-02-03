import { Client } from "../../../api/client";
import type { BuildResponse, BuildsResponse } from "../../../api/types/builds";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * Builds commands
 * asc builds list/get/latest/expire
 */
import { type Command, type CommandContext, registry } from "../../router";

const buildsCommand: Command = {
	name: "builds",
	description: "Manage builds",
	subcommands: {
		list: {
			name: "list",
			description: "List builds",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "Filter by App ID",
				},
				limit: {
					type: "string",
					short: "l",
					description: "Maximum number of builds to return",
					default: "50",
				},
				"processing-state": {
					type: "string",
					description:
						"Filter by processing state (PROCESSING, FAILED, INVALID, VALID)",
				},
				"pre-release-version": {
					type: "string",
					description: "Filter by pre-release version string",
				},
				expired: {
					type: "string",
					description: "Filter by expired status (true/false)",
				},
				sort: {
					type: "string",
					short: "s",
					description:
						"Sort order (uploadedDate, -uploadedDate, version, -version)",
					default: "-uploadedDate",
				},
				paginate: {
					type: "boolean",
					description: "Fetch all pages automatically",
					default: false,
				},
			},
			execute: listBuilds,
		},
		get: {
			name: "get",
			description: "Get build by ID",
			options: {
				build: {
					type: "string",
					short: "b",
					description: "Build ID",
					required: true,
				},
			},
			execute: getBuild,
		},
		latest: {
			name: "latest",
			description: "Get latest build for an app",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
				"pre-release-version": {
					type: "string",
					description: "Filter by pre-release version string",
				},
				"processing-state": {
					type: "string",
					description: "Filter by processing state",
					default: "VALID",
				},
			},
			execute: latestBuild,
		},
		expire: {
			name: "expire",
			description: "Expire a build",
			options: {
				build: {
					type: "string",
					short: "b",
					description: "Build ID to expire",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm the action",
					default: false,
				},
			},
			execute: expireBuild,
		},
	},
};

async function listBuilds(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const creds = await requireCredentials({ profile: ctx.global.profile });

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const opts = ctx.args.options;
	const limit = Number.parseInt(opts.limit as string, 10) || 50;
	const paginate = opts.paginate === true;

	// Build query params
	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));
	params.set("sort", (opts.sort as string) || "-uploadedDate");

	if (opts.app) {
		params.set("filter[app]", opts.app as string);
	}
	if (opts["processing-state"]) {
		params.set("filter[processingState]", opts["processing-state"] as string);
	}
	if (opts["pre-release-version"]) {
		params.set(
			"filter[preReleaseVersion.version]",
			opts["pre-release-version"] as string,
		);
	}
	if (opts.expired) {
		params.set("filter[expired]", opts.expired as string);
	}

	const path = `/v1/builds?${params.toString()}`;

	if (paginate) {
		const builds = await client.paginate(path);
		printOutput({ data: builds }, format);
	} else {
		const response = await client.get<BuildsResponse>(path);
		printOutput(response, format);
	}
}

async function getBuild(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const buildId = ctx.args.options.build as string;

	if (!buildId) {
		printError("--build is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.get<BuildResponse>(`/v1/builds/${buildId}`);
	printOutput(response, format);
}

async function latestBuild(ctx: CommandContext): Promise<void> {
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

	// Build query params
	const params = new URLSearchParams();
	params.set("filter[app]", appId);
	params.set("sort", "-uploadedDate");
	params.set("limit", "1");

	if (opts["processing-state"]) {
		params.set("filter[processingState]", opts["processing-state"] as string);
	}
	if (opts["pre-release-version"]) {
		params.set(
			"filter[preReleaseVersion.version]",
			opts["pre-release-version"] as string,
		);
	}

	const response = await client.get<BuildsResponse>(
		`/v1/builds?${params.toString()}`,
	);

	if (response.data.length === 0) {
		printError("No builds found matching criteria");
		process.exit(1);
	}

	// Return as single response format
	printOutput({ data: response.data[0] }, format);
}

async function expireBuild(ctx: CommandContext): Promise<void> {
	const buildId = ctx.args.options.build as string;
	const confirm = ctx.args.options.confirm === true;

	if (!buildId) {
		printError("--build is required");
		process.exit(1);
	}

	if (!confirm) {
		printError(
			"Use --confirm to expire the build. This action cannot be undone.",
		);
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	await client.patch(`/v1/builds/${buildId}`, {
		data: {
			type: "builds",
			id: buildId,
			attributes: {
				expired: true,
			},
		},
	});

	printSuccess(`Build ${buildId} expired`);
}

export function registerBuildsCommands(): void {
	registry.register(buildsCommand);
}
