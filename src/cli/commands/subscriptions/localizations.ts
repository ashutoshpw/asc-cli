import { Client } from "../../../api/client";
import type {
	SubscriptionLocalizationResponse,
	SubscriptionLocalizationsResponse,
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
// Localizations subcommands
// ============================================================================

export async function listLocalizations(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subId = ctx.args.options["subscription-id"] as string;

	if (!subId) {
		printError("--subscription-id is required");
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

	const path = `/v1/subscriptions/${subId}/subscriptionLocalizations?${params.toString()}`;

	if (paginate) {
		const localizations = await client.paginate(path);
		printOutput({ data: localizations }, format);
	} else {
		const response = await client.get<SubscriptionLocalizationsResponse>(path);
		printOutput(response, format);
	}
}

export async function getLocalization(ctx: CommandContext): Promise<void> {
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

	const response = await client.get<SubscriptionLocalizationResponse>(
		`/v1/subscriptionLocalizations/${id}`,
	);
	printOutput(response, format);
}

export async function createLocalization(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subId = ctx.args.options["subscription-id"] as string;
	const locale = ctx.args.options.locale as string;
	const name = ctx.args.options.name as string;
	const description = ctx.args.options.description as string | undefined;

	if (!subId) {
		printError("--subscription-id is required");
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
	if (description) attributes.description = description;

	const response = await client.post<SubscriptionLocalizationResponse>(
		"/v1/subscriptionLocalizations",
		{
			data: {
				type: "subscriptionLocalizations",
				attributes,
				relationships: {
					subscription: {
						data: { type: "subscriptions", id: subId },
					},
				},
			},
		},
	);

	printSuccess(`Created localization for ${locale}`);
	printOutput(response, format);
}

export async function updateLocalization(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;
	const name = ctx.args.options.name as string | undefined;
	const description = ctx.args.options.description as string | undefined;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!name && !description) {
		printError("At least one of --name or --description is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const attributes: Record<string, string> = {};
	if (name) attributes.name = name;
	if (description) attributes.description = description;

	const response = await client.patch<SubscriptionLocalizationResponse>(
		`/v1/subscriptionLocalizations/${id}`,
		{
			data: {
				type: "subscriptionLocalizations",
				id,
				attributes,
			},
		},
	);

	printSuccess(`Updated localization ${id}`);
	printOutput(response, format);
}

export async function deleteLocalization(ctx: CommandContext): Promise<void> {
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

	await client.delete(`/v1/subscriptionLocalizations/${id}`);
	printSuccess(`Deleted localization ${id}`);
}

// ============================================================================
// Command definition
// ============================================================================

export const localizationsCommand: Command = {
	name: "localizations",
	description: "Manage subscription localizations",
	subcommands: {
		list: {
			name: "list",
			description: "List subscription localizations",
			options: {
				"subscription-id": {
					type: "string",
					description: "Subscription ID",
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
			execute: listLocalizations,
		},
		get: {
			name: "get",
			description: "Get subscription localization by ID",
			options: {
				id: {
					type: "string",
					description: "Localization ID",
					required: true,
				},
			},
			execute: getLocalization,
		},
		create: {
			name: "create",
			description: "Create a subscription localization",
			options: {
				"subscription-id": {
					type: "string",
					description: "Subscription ID",
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
				description: {
					type: "string",
					short: "d",
					description: "Localized description",
				},
			},
			execute: createLocalization,
		},
		update: {
			name: "update",
			description: "Update a subscription localization",
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
				description: {
					type: "string",
					short: "d",
					description: "Localized description",
				},
			},
			execute: updateLocalization,
		},
		delete: {
			name: "delete",
			description: "Delete a subscription localization",
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
			execute: deleteLocalization,
		},
	},
};
