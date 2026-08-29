import { Client } from "../../api/client";
import {
	type CommerceVersionKind,
	createCommerceVersion,
	getCommerceVersion,
	listCommerceVersions,
	ownerVersionsPath,
} from "../../api/commerce-versions";
import { requireCredentials } from "../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../output/formatter";
import type { Command, CommandContext } from "../router";

interface VersionCommandOptions {
	ownerFlag: "iap-id" | "subscription-id" | "group-id";
	ownerDescription: string;
	commandName: string;
}

function ownerOptions(config: VersionCommandOptions) {
	return {
		[config.ownerFlag]: {
			type: "string" as const,
			description: config.ownerDescription,
			required: true,
		},
	};
}

function getOwnerId(
	ctx: CommandContext,
	config: VersionCommandOptions,
): string {
	const ownerId = ctx.args.options[config.ownerFlag] as string | undefined;
	if (!ownerId) {
		printError(`--${config.ownerFlag} is required`);
		process.exit(1);
	}
	return ownerId;
}

function clientFor(ctx: CommandContext): Promise<Client> {
	return requireCredentials({ profile: ctx.global.profile }).then((creds) =>
		Client.fromCredentials(creds, {
			debug: ctx.global.debug,
			apiDebug: ctx.global.apiDebug,
		}),
	);
}

function makeVersionCommand(
	kind: CommerceVersionKind,
	config: VersionCommandOptions,
): Command {
	return {
		name: config.commandName,
		description: `Manage ${kind} versions`,
		subcommands: {
			list: {
				name: "list",
				description: `List ${kind} versions`,
				options: {
					...ownerOptions(config),
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
				execute: async (ctx) => {
					const format = getOutputFormat(ctx.global);
					const ownerId = getOwnerId(ctx, config);
					const limit =
						Number.parseInt(ctx.args.options.limit as string, 10) || 50;
					const client = await clientFor(ctx);
					const path = ownerVersionsPath(kind, ownerId, limit);

					if (ctx.args.options.paginate === true) {
						const versions = await client.paginate(path);
						printOutput({ data: versions }, format);
						return;
					}

					const versions = await listCommerceVersions(client, kind, ownerId);
					printOutput(
						{ data: versions.slice(0, Math.min(limit, 200)) },
						format,
					);
				},
			},
			get: {
				name: "get",
				description: `Get ${kind} version by ID`,
				options: {
					id: {
						type: "string",
						description: "Version ID",
						required: true,
					},
				},
				execute: async (ctx) => {
					const format = getOutputFormat(ctx.global);
					const id = ctx.args.options.id as string | undefined;
					if (!id) {
						printError("--id is required");
						process.exit(1);
					}
					const client = await clientFor(ctx);
					const version = await getCommerceVersion(client, kind, id);
					printOutput({ data: version }, format);
				},
			},
			create: {
				name: "create",
				description: `Create a ${kind} version`,
				options: ownerOptions(config),
				execute: async (ctx) => {
					const format = getOutputFormat(ctx.global);
					const ownerId = getOwnerId(ctx, config);
					const client = await clientFor(ctx);
					const version = await createCommerceVersion(client, kind, ownerId);
					printSuccess(`Created ${kind} version ${version.id}`);
					printOutput({ data: version }, format);
				},
			},
		},
	};
}

export const iapVersionsCommand = makeVersionCommand("iap", {
	ownerFlag: "iap-id",
	ownerDescription: "In-app purchase ID",
	commandName: "versions",
});

export const subscriptionVersionsCommand = makeVersionCommand("subscription", {
	ownerFlag: "subscription-id",
	ownerDescription: "Subscription ID",
	commandName: "versions",
});

export const subscriptionGroupVersionsCommand = makeVersionCommand(
	"subscription-group",
	{
		ownerFlag: "group-id",
		ownerDescription: "Subscription group ID",
		commandName: "group-versions",
	},
);
