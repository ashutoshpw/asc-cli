import { Client } from "../../../api/client";
import type {
	BundleIdCapabilitiesResponse,
	BundleIdCapabilityResponse,
	BundleIdResponse,
	BundleIdsResponse,
} from "../../../api/types/bundleids";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * Bundle IDs commands
 * asc bundle-ids list/get/create/update/delete
 */
import { type Command, type CommandContext, registry } from "../../router";

const PLATFORMS = ["IOS", "MAC_OS", "UNIVERSAL"];

const bundleIdsCommand: Command = {
	name: "bundle-ids",
	description: "Manage bundle IDs and capabilities",
	subcommands: {
		list: {
			name: "list",
			description: "List bundle IDs",
			options: {
				platform: {
					type: "string",
					short: "p",
					description: "Filter by platform: IOS, MAC_OS, UNIVERSAL",
				},
				name: {
					type: "string",
					short: "n",
					description: "Filter by name",
				},
				identifier: {
					type: "string",
					short: "i",
					description: "Filter by identifier",
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
			execute: listBundleIds,
		},
		get: {
			name: "get",
			description: "Get bundle ID by ID",
			options: {
				id: {
					type: "string",
					description: "Bundle ID",
					required: true,
				},
				include: {
					type: "string",
					description:
						"Include related resources: bundleIdCapabilities, profiles, app",
				},
			},
			execute: getBundleId,
		},
		create: {
			name: "create",
			description: "Create a bundle ID",
			options: {
				identifier: {
					type: "string",
					short: "i",
					description: "Bundle identifier (e.g., com.example.app)",
					required: true,
				},
				name: {
					type: "string",
					short: "n",
					description: "Bundle ID name",
					required: true,
				},
				platform: {
					type: "string",
					short: "p",
					description: "Platform: IOS, MAC_OS, UNIVERSAL",
					default: "IOS",
				},
			},
			execute: createBundleId,
		},
		update: {
			name: "update",
			description: "Update a bundle ID",
			options: {
				id: {
					type: "string",
					description: "Bundle ID",
					required: true,
				},
				name: {
					type: "string",
					short: "n",
					description: "New name",
					required: true,
				},
			},
			execute: updateBundleId,
		},
		delete: {
			name: "delete",
			description: "Delete a bundle ID",
			options: {
				id: {
					type: "string",
					description: "Bundle ID",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm deletion",
					default: false,
				},
			},
			execute: deleteBundleId,
		},
		capabilities: {
			name: "capabilities",
			description: "Manage bundle ID capabilities",
			subcommands: {
				list: {
					name: "list",
					description: "List capabilities for a bundle ID",
					options: {
						bundle: {
							type: "string",
							short: "b",
							description: "Bundle ID",
							required: true,
						},
					},
					execute: listCapabilities,
				},
				enable: {
					name: "enable",
					description: "Enable a capability",
					options: {
						bundle: {
							type: "string",
							short: "b",
							description: "Bundle ID",
							required: true,
						},
						type: {
							type: "string",
							short: "t",
							description: "Capability type (e.g., PUSH_NOTIFICATIONS)",
							required: true,
						},
					},
					execute: enableCapability,
				},
				disable: {
					name: "disable",
					description: "Disable a capability",
					options: {
						id: {
							type: "string",
							description: "Capability ID",
							required: true,
						},
						confirm: {
							type: "boolean",
							description: "Confirm disabling",
							default: false,
						},
					},
					execute: disableCapability,
				},
			},
		},
	},
};

async function listBundleIds(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const paginate = ctx.args.options.paginate === true;

	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));

	if (ctx.args.options.platform) {
		const platform = (ctx.args.options.platform as string).toUpperCase();
		if (!PLATFORMS.includes(platform)) {
			printError(`Invalid platform. Must be one of: ${PLATFORMS.join(", ")}`);
			process.exit(1);
		}
		params.set("filter[platform]", platform);
	}

	if (ctx.args.options.name) {
		params.set("filter[name]", ctx.args.options.name as string);
	}

	if (ctx.args.options.identifier) {
		params.set("filter[identifier]", ctx.args.options.identifier as string);
	}

	const path = `/v1/bundleIds?${params.toString()}`;

	if (paginate) {
		const bundleIds = await client.paginate(path);
		printOutput({ data: bundleIds }, format);
	} else {
		const response = await client.get<BundleIdsResponse>(path);
		printOutput(response, format);
	}
}

async function getBundleId(ctx: CommandContext): Promise<void> {
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

	let path = `/v1/bundleIds/${id}`;
	if (ctx.args.options.include) {
		path += `?include=${encodeURIComponent(ctx.args.options.include as string)}`;
	}

	const response = await client.get<BundleIdResponse>(path);
	printOutput(response, format);
}

async function createBundleId(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const identifier = ctx.args.options.identifier as string;
	const name = ctx.args.options.name as string;
	const platform = (
		(ctx.args.options.platform as string) || "IOS"
	).toUpperCase();

	if (!identifier) {
		printError("--identifier is required");
		process.exit(1);
	}
	if (!name) {
		printError("--name is required");
		process.exit(1);
	}
	if (!PLATFORMS.includes(platform)) {
		printError(`Invalid platform. Must be one of: ${PLATFORMS.join(", ")}`);
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.post<BundleIdResponse>("/v1/bundleIds", {
		data: {
			type: "bundleIds",
			attributes: {
				identifier,
				name,
				platform,
			},
		},
	});

	printSuccess(`Created bundle ID: ${response.data.attributes.identifier}`);
	printOutput(response, format);
}

async function updateBundleId(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;
	const name = ctx.args.options.name as string;

	if (!id) {
		printError("--id is required");
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

	const response = await client.patch<BundleIdResponse>(`/v1/bundleIds/${id}`, {
		data: {
			type: "bundleIds",
			id,
			attributes: {
				name,
			},
		},
	});

	printSuccess(`Updated bundle ID: ${response.data.attributes.identifier}`);
	printOutput(response, format);
}

async function deleteBundleId(ctx: CommandContext): Promise<void> {
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

	await client.delete(`/v1/bundleIds/${id}`);
	printSuccess(`Deleted bundle ID ${id}`);
}

async function listCapabilities(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const bundleId = ctx.args.options.bundle as string;

	if (!bundleId) {
		printError("--bundle is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.get<BundleIdCapabilitiesResponse>(
		`/v1/bundleIds/${bundleId}/bundleIdCapabilities`,
	);
	printOutput(response, format);
}

async function enableCapability(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const bundleId = ctx.args.options.bundle as string;
	const capabilityType = (ctx.args.options.type as string)?.toUpperCase();

	if (!bundleId) {
		printError("--bundle is required");
		process.exit(1);
	}
	if (!capabilityType) {
		printError("--type is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.post<BundleIdCapabilityResponse>(
		"/v1/bundleIdCapabilities",
		{
			data: {
				type: "bundleIdCapabilities",
				attributes: {
					capabilityType,
				},
				relationships: {
					bundleId: {
						data: { type: "bundleIds", id: bundleId },
					},
				},
			},
		},
	);

	printSuccess(`Enabled capability: ${capabilityType}`);
	printOutput(response, format);
}

async function disableCapability(ctx: CommandContext): Promise<void> {
	const id = ctx.args.options.id as string;
	const confirm = ctx.args.options.confirm === true;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!confirm) {
		printError("Use --confirm to disable. This action cannot be undone.");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	await client.delete(`/v1/bundleIdCapabilities/${id}`);
	printSuccess(`Disabled capability ${id}`);
}

export function registerBundleIdsCommands(): void {
	registry.register(bundleIdsCommand);
}
