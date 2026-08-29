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

function getGroupId(ctx: CommandContext): string {
	const groupId = ctx.args.options["group-id"] as string | undefined;
	if (!groupId) {
		printError("--group-id is required");
		process.exit(1);
	}
	return groupId;
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

export async function listGroupLocalizations(
	ctx: CommandContext,
): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const groupId = getGroupId(ctx);
	const requestedVersionId = ctx.args.options["version-id"] as
		| string
		| undefined;
	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const client = await getClient(ctx);
	const version = await resolveCommerceVersion(
		client,
		"subscription-group",
		groupId,
		requestedVersionId,
		false,
	);
	const path = versionLocalizationsPath(
		"subscription-group",
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
		"subscription-group",
		getVersionId(version),
	);
	printOutput({ data: localizations.slice(0, Math.min(limit, 200)) }, format);
}

export async function createGroupLocalization(
	ctx: CommandContext,
): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const groupId = getGroupId(ctx);
	const locale = ctx.args.options.locale as string | undefined;
	const name = ctx.args.options.name as string | undefined;
	const customAppName = ctx.args.options["custom-app-name"] as
		| string
		| undefined;
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
		"subscription-group",
		groupId,
		requestedVersionId,
		true,
	);
	const attributes: Record<string, string> = { name, locale };
	if (customAppName) attributes.customAppName = customAppName;
	const localization = await createVersionLocalization(
		client,
		"subscription-group",
		getVersionId(version),
		attributes,
	);
	printSuccess(`Created localization for ${locale}`);
	printOutput({ data: localization }, format);
}

export async function updateGroupLocalization(
	ctx: CommandContext,
): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string | undefined;
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

	const attributes: Record<string, string> = {};
	if (name) attributes.name = name;
	if (customAppName) attributes.customAppName = customAppName;
	const localization = await updateVersionLocalization(
		await getClient(ctx),
		"subscription-group",
		id,
		attributes,
	);
	printSuccess(`Updated localization ${id}`);
	printOutput({ data: localization }, format);
}

export async function deleteGroupLocalization(
	ctx: CommandContext,
): Promise<void> {
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

	await deleteVersionLocalization(
		await getClient(ctx),
		"subscription-group",
		id,
	);
	printSuccess(`Deleted localization ${id}`);
}

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
				"version-id": {
					type: "string",
					description: "Explicit subscription group version ID",
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
				"version-id": {
					type: "string",
					description: "Explicit subscription group version ID",
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
