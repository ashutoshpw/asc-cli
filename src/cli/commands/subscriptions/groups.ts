import { Client } from "../../../api/client";
import type {
	SubscriptionGroupResponse,
	SubscriptionGroupsResponse,
} from "../../../api/types/subscriptions";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import type { Command, CommandContext } from "../../router";
import { groupLocalizationsCommand } from "./group-localizations";
import { getAppId } from "./shared";

// ============================================================================
// Groups subcommands
// ============================================================================

export async function listGroups(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = getAppId(ctx);

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const paginate = ctx.args.options.paginate === true;

	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));

	const path = `/v1/apps/${appId}/subscriptionGroups?${params.toString()}`;

	if (paginate) {
		const groups = await client.paginate(path);
		printOutput({ data: groups }, format);
	} else {
		const response = await client.get<SubscriptionGroupsResponse>(path);
		printOutput(response, format);
	}
}

export async function getGroup(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.get<SubscriptionGroupResponse>(
		`/v1/subscriptionGroups/${id}`,
	);
	printOutput(response, format);
}

export async function createGroup(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = getAppId(ctx);
	const referenceName = ctx.args.options["reference-name"] as string;

	if (!referenceName) {
		printError("--reference-name is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.post<SubscriptionGroupResponse>(
		"/v1/subscriptionGroups",
		{
			data: {
				type: "subscriptionGroups",
				attributes: {
					referenceName,
				},
				relationships: {
					app: {
						data: { type: "apps", id: appId },
					},
				},
			},
		},
	);

	printSuccess(`Created subscription group: ${referenceName}`);
	printOutput(response, format);
}

export async function updateGroup(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;
	const referenceName = ctx.args.options["reference-name"] as string;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!referenceName) {
		printError("--reference-name is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.patch<SubscriptionGroupResponse>(
		`/v1/subscriptionGroups/${id}`,
		{
			data: {
				type: "subscriptionGroups",
				id,
				attributes: {
					referenceName,
				},
			},
		},
	);

	printSuccess(`Updated subscription group: ${id}`);
	printOutput(response, format);
}

export async function deleteGroup(ctx: CommandContext): Promise<void> {
	const id = ctx.args.options.id as string;
	const confirm = ctx.args.options.confirm === true;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!confirm) {
		printError("Use --confirm to delete. This action cannot be undone.");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	await client.delete(`/v1/subscriptionGroups/${id}`);
	printSuccess(`Deleted subscription group ${id}`);
}

// ============================================================================
// Command definition
// ============================================================================

export const groupsCommand: Command = {
	name: "groups",
	description: "Manage subscription groups",
	subcommands: {
		list: {
			name: "list",
			description: "List subscription groups for an app",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID (or set ASC_APP_ID env)",
					required: true,
				},
				limit: {
					type: "string",
					short: "l",
					description: "Maximum number of results (1-200)",
					default: "50",
				},
				paginate: {
					type: "boolean",
					description: "Fetch all pages automatically",
					default: false,
				},
			},
			execute: listGroups,
		},
		get: {
			name: "get",
			description: "Get subscription group by ID",
			options: {
				id: {
					type: "string",
					description: "Subscription group ID",
					required: true,
				},
			},
			execute: getGroup,
		},
		create: {
			name: "create",
			description: "Create a subscription group",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID (or set ASC_APP_ID env)",
					required: true,
				},
				"reference-name": {
					type: "string",
					short: "n",
					description: "Reference name",
					required: true,
				},
			},
			execute: createGroup,
		},
		update: {
			name: "update",
			description: "Update a subscription group",
			options: {
				id: {
					type: "string",
					description: "Subscription group ID",
					required: true,
				},
				"reference-name": {
					type: "string",
					short: "n",
					description: "Reference name",
					required: true,
				},
			},
			execute: updateGroup,
		},
		delete: {
			name: "delete",
			description: "Delete a subscription group",
			options: {
				id: {
					type: "string",
					description: "Subscription group ID",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm deletion",
					default: false,
				},
			},
			execute: deleteGroup,
		},
		localizations: groupLocalizationsCommand,
	},
};
