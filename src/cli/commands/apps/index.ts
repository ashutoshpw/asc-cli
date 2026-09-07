import { Client } from "../../../api/client";
import type { AppResponse, AppsResponse } from "../../../api/types/apps";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
} from "../../../output/formatter";
/**
 * Apps commands
 * asc apps list/get
 */
import { type Command, type CommandContext, registry } from "../../router";

const appsCommand: Command = {
	name: "apps",
	description: "Manage apps",
	subcommands: {
		list: {
			name: "list",
			description: "List all apps",
			options: {
				limit: {
					type: "string",
					short: "l",
					description: "Maximum number of apps to return",
					default: "200",
				},
				filter: {
					type: "string",
					short: "f",
					description: "Filter by app name (legacy alias)",
				},
				"bundle-id": {
					type: "string",
					description: "Filter by bundle ID",
				},
				paginate: {
					type: "boolean",
					description: "Fetch all pages automatically",
					default: false,
				},
			},
			execute: listApps,
		},
		get: {
			name: "get",
			description: "Get app by ID",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
			},
			execute: getApp,
		},
	},
};

export async function listApps(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const creds = await requireCredentials({ profile: ctx.global.profile });

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 200;
	const filter = ctx.args.options.filter as string | undefined;
	const bundleId = ctx.args.options["bundle-id"] as string | undefined;
	const paginate = ctx.args.options.paginate === true;

	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));

	if (filter) {
		params.set("filter[name]", filter);
	}
	if (bundleId) {
		params.set("filter[bundleId]", bundleId);
	}

	const path = `/v1/apps?${params.toString()}`;

	if (paginate) {
		const apps = await client.paginate(path);
		printOutput({ data: apps }, format);
	} else {
		const response = await client.get<AppsResponse>(path);
		printOutput(response, format);
	}
}

async function getApp(ctx: CommandContext): Promise<void> {
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

	const response = await client.get<AppResponse>(`/v1/apps/${appId}`);
	printOutput(response, format);
}

export function registerAppsCommands(): void {
	registry.register(appsCommand);
}
