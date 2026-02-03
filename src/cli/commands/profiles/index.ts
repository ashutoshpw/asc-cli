import { Client } from "../../../api/client";
import type {
	ProfileResponse,
	ProfilesResponse,
} from "../../../api/types/profiles";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * Profiles commands
 * asc profiles list/get/create/delete/download
 */
import { type Command, type CommandContext, registry } from "../../router";

const profilesCommand: Command = {
	name: "profiles",
	description: "Manage provisioning profiles",
	subcommands: {
		list: {
			name: "list",
			description: "List provisioning profiles",
			options: {
				type: {
					type: "string",
					short: "t",
					description: "Filter by profile type(s), comma-separated",
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
			execute: listProfiles,
		},
		get: {
			name: "get",
			description: "Get profile by ID",
			options: {
				id: {
					type: "string",
					description: "Profile ID",
					required: true,
				},
				include: {
					type: "string",
					description:
						"Include related resources: bundleId, certificates, devices",
				},
			},
			execute: getProfile,
		},
		create: {
			name: "create",
			description: "Create a provisioning profile",
			options: {
				name: {
					type: "string",
					short: "n",
					description: "Profile name",
					required: true,
				},
				type: {
					type: "string",
					short: "t",
					description: "Profile type (e.g., IOS_APP_DEVELOPMENT)",
					required: true,
				},
				bundle: {
					type: "string",
					short: "b",
					description: "Bundle ID",
					required: true,
				},
				certificate: {
					type: "string",
					short: "c",
					description: "Certificate ID(s), comma-separated",
					required: true,
				},
				device: {
					type: "string",
					short: "d",
					description:
						"Device ID(s), comma-separated (optional for some profile types)",
				},
			},
			execute: createProfile,
		},
		delete: {
			name: "delete",
			description: "Delete a provisioning profile",
			options: {
				id: {
					type: "string",
					description: "Profile ID",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm deletion",
					default: false,
				},
			},
			execute: deleteProfile,
		},
		download: {
			name: "download",
			description: "Download provisioning profile",
			options: {
				id: {
					type: "string",
					description: "Profile ID",
					required: true,
				},
				output: {
					type: "string",
					short: "o",
					description: "Output file path (.mobileprovision)",
					required: true,
				},
			},
			execute: downloadProfile,
		},
	},
};

async function listProfiles(ctx: CommandContext): Promise<void> {
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

	if (ctx.args.options.type) {
		const types = (ctx.args.options.type as string)
			.split(",")
			.map((t) => t.trim().toUpperCase())
			.filter(Boolean);
		if (types.length > 0) {
			params.set("filter[profileType]", types.join(","));
		}
	}

	const path = `/v1/profiles?${params.toString()}`;

	if (paginate) {
		const profiles = await client.paginate(path);
		printOutput({ data: profiles }, format);
	} else {
		const response = await client.get<ProfilesResponse>(path);
		printOutput(response, format);
	}
}

async function getProfile(ctx: CommandContext): Promise<void> {
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

	let path = `/v1/profiles/${id}`;
	if (ctx.args.options.include) {
		path += `?include=${encodeURIComponent(ctx.args.options.include as string)}`;
	}

	const response = await client.get<ProfileResponse>(path);
	printOutput(response, format);
}

async function createProfile(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const name = ctx.args.options.name as string;
	const profileType = (ctx.args.options.type as string)?.toUpperCase();
	const bundleId = ctx.args.options.bundle as string;
	const certificates = ctx.args.options.certificate as string;
	const devices = ctx.args.options.device as string | undefined;

	if (!name) {
		printError("--name is required");
		process.exit(1);
	}
	if (!profileType) {
		printError("--type is required");
		process.exit(1);
	}
	if (!bundleId) {
		printError("--bundle is required");
		process.exit(1);
	}
	if (!certificates) {
		printError("--certificate is required");
		process.exit(1);
	}

	const certificateIds = certificates
		.split(",")
		.map((c) => c.trim())
		.filter(Boolean);
	const deviceIds = devices
		? devices
				.split(",")
				.map((d) => d.trim())
				.filter(Boolean)
		: [];

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const body = {
		data: {
			type: "profiles",
			attributes: {
				name,
				profileType,
			},
			relationships: {
				bundleId: {
					data: { type: "bundleIds", id: bundleId },
				},
				certificates: {
					data: certificateIds.map((id) => ({ type: "certificates", id })),
				},
				...(deviceIds.length > 0 && {
					devices: {
						data: deviceIds.map((id) => ({ type: "devices", id })),
					},
				}),
			},
		},
	};

	const response = await client.post<ProfileResponse>("/v1/profiles", body);
	printSuccess(`Created profile: ${response.data.attributes.name}`);
	printOutput(response, format);
}

async function deleteProfile(ctx: CommandContext): Promise<void> {
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

	await client.delete(`/v1/profiles/${id}`);
	printSuccess(`Deleted profile ${id}`);
}

async function downloadProfile(ctx: CommandContext): Promise<void> {
	const id = ctx.args.options.id as string;
	const outputPath = ctx.args.options.output as string;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!outputPath) {
		printError("--output is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.get<ProfileResponse>(`/v1/profiles/${id}`);
	const profileContent = response.data.attributes.profileContent;

	if (!profileContent) {
		printError("Profile has no content");
		process.exit(1);
	}

	// Decode base64 content
	const decoded = Buffer.from(profileContent, "base64");
	await Bun.write(outputPath, decoded);
	printSuccess(`Profile saved to ${outputPath}`);
}

export function registerProfilesCommands(): void {
	registry.register(profilesCommand);
}
