import { execSync } from "node:child_process";
import { Client } from "../../../api/client";
import type {
	DeviceResponse,
	DevicesResponse,
} from "../../../api/types/devices";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * Devices commands
 * asc devices list/get/register/update/local-udid
 */
import { type Command, type CommandContext, registry } from "../../router";

const PLATFORMS = ["IOS", "MAC_OS", "TV_OS", "VISION_OS"];
const STATUSES = ["ENABLED", "DISABLED"];

const devicesCommand: Command = {
	name: "devices",
	description: "Manage registered devices",
	subcommands: {
		list: {
			name: "list",
			description: "List registered devices",
			options: {
				platform: {
					type: "string",
					short: "p",
					description:
						"Filter by platform(s), comma-separated: IOS, MAC_OS, TV_OS, VISION_OS",
				},
				status: {
					type: "string",
					short: "s",
					description: "Filter by status: ENABLED, DISABLED",
				},
				name: {
					type: "string",
					short: "n",
					description: "Filter by device name",
				},
				udid: {
					type: "string",
					short: "u",
					description: "Filter by UDID(s), comma-separated",
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
			execute: listDevices,
		},
		get: {
			name: "get",
			description: "Get device by ID",
			options: {
				id: {
					type: "string",
					description: "Device ID",
					required: true,
				},
			},
			execute: getDevice,
		},
		register: {
			name: "register",
			description: "Register a new device",
			options: {
				name: {
					type: "string",
					short: "n",
					description: "Device name",
					required: true,
				},
				udid: {
					type: "string",
					short: "u",
					description: "Device UDID",
				},
				"udid-from-system": {
					type: "boolean",
					description: "Use local macOS hardware UUID as UDID (macOS only)",
					default: false,
				},
				platform: {
					type: "string",
					short: "p",
					description: "Platform: IOS, MAC_OS, TV_OS, VISION_OS",
					required: true,
				},
			},
			execute: registerDevice,
		},
		update: {
			name: "update",
			description: "Update a device",
			options: {
				id: {
					type: "string",
					description: "Device ID",
					required: true,
				},
				name: {
					type: "string",
					short: "n",
					description: "New device name",
				},
				status: {
					type: "string",
					short: "s",
					description: "New status: ENABLED, DISABLED",
				},
			},
			execute: updateDevice,
		},
		"local-udid": {
			name: "local-udid",
			description: "Get local macOS hardware UDID",
			execute: localUdid,
		},
	},
};

async function listDevices(ctx: CommandContext): Promise<void> {
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
		const platforms = (ctx.args.options.platform as string)
			.split(",")
			.map((p) => p.trim().toUpperCase())
			.filter(Boolean);
		for (const platform of platforms) {
			if (!PLATFORMS.includes(platform)) {
				printError(
					`Invalid platform: ${platform}. Must be one of: ${PLATFORMS.join(", ")}`,
				);
				process.exit(1);
			}
		}
		params.set("filter[platform]", platforms.join(","));
	}

	if (ctx.args.options.status) {
		const status = (ctx.args.options.status as string).toUpperCase();
		if (!STATUSES.includes(status)) {
			printError(`Invalid status. Must be one of: ${STATUSES.join(", ")}`);
			process.exit(1);
		}
		params.set("filter[status]", status);
	}

	if (ctx.args.options.name) {
		params.set("filter[name]", ctx.args.options.name as string);
	}

	if (ctx.args.options.udid) {
		const udids = (ctx.args.options.udid as string)
			.split(",")
			.map((u) => u.trim())
			.filter(Boolean);
		params.set("filter[udid]", udids.join(","));
	}

	const path = `/v1/devices?${params.toString()}`;

	if (paginate) {
		const devices = await client.paginate(path);
		printOutput({ data: devices }, format);
	} else {
		const response = await client.get<DevicesResponse>(path);
		printOutput(response, format);
	}
}

async function getDevice(ctx: CommandContext): Promise<void> {
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

	const response = await client.get<DeviceResponse>(`/v1/devices/${id}`);
	printOutput(response, format);
}

async function registerDevice(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const name = ctx.args.options.name as string;
	let udid = ctx.args.options.udid as string | undefined;
	const udidFromSystem = ctx.args.options["udid-from-system"] === true;
	let platform = (ctx.args.options.platform as string)?.toUpperCase();

	if (!name) {
		printError("--name is required");
		process.exit(1);
	}

	if (udidFromSystem && udid) {
		printError("--udid and --udid-from-system are mutually exclusive");
		process.exit(1);
	}

	if (udidFromSystem) {
		if (process.platform !== "darwin") {
			printError("--udid-from-system is only supported on macOS");
			process.exit(1);
		}
		udid = getLocalMacUDID();
		platform = platform || "MAC_OS";
	}

	if (!udid) {
		printError("--udid is required (or use --udid-from-system on macOS)");
		process.exit(1);
	}

	if (!platform) {
		printError("--platform is required");
		process.exit(1);
	}

	if (!PLATFORMS.includes(platform)) {
		printError(`Invalid platform. Must be one of: ${PLATFORMS.join(", ")}`);
		process.exit(1);
	}

	if (udidFromSystem && platform !== "MAC_OS") {
		printError("--udid-from-system requires --platform MAC_OS");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.post<DeviceResponse>("/v1/devices", {
		data: {
			type: "devices",
			attributes: {
				name,
				udid,
				platform,
			},
		},
	});

	printSuccess(`Registered device: ${response.data.attributes.name}`);
	printOutput(response, format);
}

async function updateDevice(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;
	const name = ctx.args.options.name as string | undefined;
	const status = (ctx.args.options.status as string)?.toUpperCase();

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}

	if (!name && !status) {
		printError("At least one of --name or --status is required");
		process.exit(1);
	}

	if (status && !STATUSES.includes(status)) {
		printError(`Invalid status. Must be one of: ${STATUSES.join(", ")}`);
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const attributes: Record<string, string> = {};
	if (name) attributes.name = name;
	if (status) attributes.status = status;

	const response = await client.patch<DeviceResponse>(`/v1/devices/${id}`, {
		data: {
			type: "devices",
			id,
			attributes,
		},
	});

	printSuccess(`Updated device: ${response.data.attributes.name}`);
	printOutput(response, format);
}

async function localUdid(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);

	if (process.platform !== "darwin") {
		printError("local-udid is only supported on macOS");
		process.exit(1);
	}

	const udid = getLocalMacUDID();
	printOutput({ udid, platform: "MAC_OS" }, format);
}

function getLocalMacUDID(): string {
	try {
		const output = execSync("ioreg -rd1 -c IOPlatformExpertDevice", {
			encoding: "utf-8",
		});
		const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
		if (match?.[1]) {
			return match[1];
		}
		throw new Error("Unable to locate IOPlatformUUID in ioreg output");
	} catch (error) {
		throw new Error(
			`Failed to read local hardware UUID: ${(error as Error).message}`,
		);
	}
}

export function registerDevicesCommands(): void {
	registry.register(devicesCommand);
}
