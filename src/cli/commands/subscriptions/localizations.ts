import { Client } from "../../../api/client";
import {
	type CommerceVersion,
	resolveCommerceVersion,
} from "../../../api/commerce-versions";
import {
	createVersionLocalization,
	deleteVersionLocalization,
	getVersionLocalization,
	listVersionLocalizations,
	updateVersionLocalization,
	versionLocalizationsPath,
} from "../../../api/version-localizations";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import type { Command, CommandContext } from "../../router";

function getSubscriptionId(ctx: CommandContext): string {
	const subscriptionId = ctx.args.options["subscription-id"] as
		| string
		| undefined;
	if (!subscriptionId) {
		printError("--subscription-id is required");
		process.exit(1);
	}
	return subscriptionId;
}

async function getClient(ctx: CommandContext): Promise<Client> {
	const creds = await requireCredentials({ profile: ctx.global.profile });
	return Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});
}

function getVersionId(version: CommerceVersion): string {
	return version.id;
}

export async function listLocalizations(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subscriptionId = getSubscriptionId(ctx);
	const requestedVersionId = ctx.args.options["version-id"] as
		| string
		| undefined;
	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const client = await getClient(ctx);
	const version = await resolveCommerceVersion(
		client,
		"subscription",
		subscriptionId,
		requestedVersionId,
		false,
	);
	const path = versionLocalizationsPath(
		"subscription",
		getVersionId(version),
		limit,
	);

	if (ctx.args.options.paginate === true) {
		const localizations = await client.paginate(path);
		printOutput({ data: localizations }, format);
		return;
	}

	const localizations = await listVersionLocalizations(
		client,
		"subscription",
		getVersionId(version),
	);
	printOutput({ data: localizations.slice(0, Math.min(limit, 200)) }, format);
}

export async function getLocalization(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string | undefined;
	if (!id) {
		printError("--id is required");
		process.exit(1);
	}

	const localization = await getVersionLocalization(
		await getClient(ctx),
		"subscription",
		id,
	);
	printOutput({ data: localization }, format);
}

export async function createLocalization(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subscriptionId = getSubscriptionId(ctx);
	const locale = ctx.args.options.locale as string | undefined;
	const name = ctx.args.options.name as string | undefined;
	const description = ctx.args.options.description as string | undefined;
	const requestedVersionId = ctx.args.options["version-id"] as
		| string
		| undefined;

	if (!locale) {
		printError("--locale is required");
		process.exit(1);
	}
	if (!name) {
		printError("--name is required");
		process.exit(1);
	}

	const client = await getClient(ctx);
	const version = await resolveCommerceVersion(
		client,
		"subscription",
		subscriptionId,
		requestedVersionId,
		true,
	);
	const attributes: Record<string, string> = { name, locale };
	if (description) attributes.description = description;
	const localization = await createVersionLocalization(
		client,
		"subscription",
		getVersionId(version),
		attributes,
	);
	printSuccess(`Created localization for ${locale}`);
	printOutput({ data: localization }, format);
}

export async function updateLocalization(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string | undefined;
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

	const attributes: Record<string, string> = {};
	if (name) attributes.name = name;
	if (description) attributes.description = description;
	const localization = await updateVersionLocalization(
		await getClient(ctx),
		"subscription",
		id,
		attributes,
	);
	printSuccess(`Updated localization ${id}`);
	printOutput({ data: localization }, format);
}

export async function deleteLocalization(ctx: CommandContext): Promise<void> {
	const id = ctx.args.options.id as string | undefined;
	const confirm = ctx.args.options.confirm === true;
	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!confirm) {
		printError("Use --confirm to delete. This action cannot be undone.");
		process.exit(1);
	}

	await deleteVersionLocalization(await getClient(ctx), "subscription", id);
	printSuccess(`Deleted localization ${id}`);
}

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
				"version-id": {
					type: "string",
					description: "Explicit subscription version ID",
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
				"version-id": {
					type: "string",
					description: "Explicit subscription version ID",
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
