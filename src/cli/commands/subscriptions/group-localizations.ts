import { Client } from "../../../api/client";
import type {
	SubscriptionGroupLocalizationResponse,
	SubscriptionGroupLocalizationsResponse,
} from "../../../api/types/subscriptions";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import type { Command, CommandContext } from "../../router";

// ============================================================================
// Groups localizations subcommands
// ============================================================================

export async function listGroupLocalizations(
	ctx: CommandContext,
): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const groupId = ctx.args.options["group-id"] as string;

	if (!groupId) {
		printError("--group-id is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const paginate = ctx.args.options.paginate === true;

	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));

	const path = `/v1/subscriptionGroups/${groupId}/subscriptionGroupLocalizations?${params.toString()}`;

	if (paginate) {
		const localizations = await client.paginate(path);
		printOutput({ data: localizations }, format);
	} else {
		const response =
			await client.get<SubscriptionGroupLocalizationsResponse>(path);
		printOutput(response, format);
	}
}

export async function createGroupLocalization(
	ctx: CommandContext,
): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const groupId = ctx.args.options["group-id"] as string;
	const locale = ctx.args.options.locale as string;
	const name = ctx.args.options.name as string;
	const customAppName = ctx.args.options["custom-app-name"] as
		| string
		| undefined;

	if (!groupId) {
		printError("--group-id is required");
		process.exit(1);
	}
	if (!locale) {
		printError("--locale is required");
		process.exit(1);
	}
	if (!name) {
		printError("--name is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const attributes: Record<string, string> = { name, locale };
	if (customAppName) attributes.customAppName = customAppName;

	const response = await client.post<SubscriptionGroupLocalizationResponse>(
		"/v1/subscriptionGroupLocalizations",
		{
			data: {
				type: "subscriptionGroupLocalizations",
				attributes,
				relationships: {
					subscriptionGroup: {
						data: { type: "subscriptionGroups", id: groupId },
					},
				},
			},
		},
	);

	printSuccess(`Created localization for ${locale}`);
	printOutput(response, format);
}

export async function updateGroupLocalization(
	ctx: CommandContext,
): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;
	const name = ctx.args.options.name as string | undefined;
	const customAppName = ctx.args.options["custom-app-name"] as
		| string
		| undefined;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!name && !customAppName) {
		printError("At least one of --name or --custom-app-name is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const attributes: Record<string, string> = {};
	if (name) attributes.name = name;
	if (customAppName) attributes.customAppName = customAppName;

	const response = await client.patch<SubscriptionGroupLocalizationResponse>(
		`/v1/subscriptionGroupLocalizations/${id}`,
		{
			data: {
				type: "subscriptionGroupLocalizations",
				id,
				attributes,
			},
		},
	);

	printSuccess(`Updated localization ${id}`);
	printOutput(response, format);
}

export async function deleteGroupLocalization(
	ctx: CommandContext,
): Promise<void> {
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

	await client.delete(`/v1/subscriptionGroupLocalizations/${id}`);
	printSuccess(`Deleted localization ${id}`);
}

// ============================================================================
// Command definition
// ============================================================================

export const groupLocalizationsCommand: Command = {
	name: "localizations",
	description: "Manage subscription group localizations",
	subcommands: {
		list: {
			name: "list",
			description: "List localizations for a group",
			options: {
				"group-id": {
					type: "string",
					description: "Subscription group ID",
					required: true,
				},
				limit: {
					type: "string",
					short: "l",
					description: "Maximum number of results",
					default: "50",
				},
				paginate: {
					type: "boolean",
					description: "Fetch all pages",
					default: false,
				},
			},
			execute: listGroupLocalizations,
		},
		create: {
			name: "create",
			description: "Create a group localization",
			options: {
				"group-id": {
					type: "string",
					description: "Subscription group ID",
					required: true,
				},
				locale: {
					type: "string",
					description: "Locale (e.g., en-US)",
					required: true,
				},
				name: {
					type: "string",
					short: "n",
					description: "Localized name",
					required: true,
				},
				"custom-app-name": {
					type: "string",
					description: "Custom app name",
				},
			},
			execute: createGroupLocalization,
		},
		update: {
			name: "update",
			description: "Update a group localization",
			options: {
				id: {
					type: "string",
					description: "Localization ID",
					required: true,
				},
				name: {
					type: "string",
					short: "n",
					description: "Localized name",
				},
				"custom-app-name": {
					type: "string",
					description: "Custom app name",
				},
			},
			execute: updateGroupLocalization,
		},
		delete: {
			name: "delete",
			description: "Delete a group localization",
			options: {
				id: {
					type: "string",
					description: "Localization ID",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm deletion",
					default: false,
				},
			},
			execute: deleteGroupLocalization,
		},
	},
};
