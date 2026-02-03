import { Client } from "../../../api/client";
import type {
	BetaGroupResponse,
	BetaGroupsResponse,
	BetaTesterResponse,
	BetaTestersResponse,
} from "../../../api/types/testflight";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * TestFlight commands
 * asc testflight beta-groups/beta-testers
 */
import { type Command, type CommandContext, registry } from "../../router";

// Beta Groups commands
const betaGroupsCommand: Command = {
	name: "beta-groups",
	description: "Manage TestFlight beta groups",
	subcommands: {
		list: {
			name: "list",
			description: "List beta groups for an app",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID (or set ASC_APP_ID)",
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
			execute: listBetaGroups,
		},
		get: {
			name: "get",
			description: "Get beta group by ID",
			options: {
				id: {
					type: "string",
					description: "Beta group ID",
					required: true,
				},
			},
			execute: getBetaGroup,
		},
		create: {
			name: "create",
			description: "Create a beta group",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
				name: {
					type: "string",
					short: "n",
					description: "Beta group name",
					required: true,
				},
				"public-link": {
					type: "boolean",
					description: "Enable public link",
					default: false,
				},
				"feedback-enabled": {
					type: "boolean",
					description: "Enable feedback",
					default: false,
				},
			},
			execute: createBetaGroup,
		},
		update: {
			name: "update",
			description: "Update a beta group",
			options: {
				id: {
					type: "string",
					description: "Beta group ID",
					required: true,
				},
				name: {
					type: "string",
					short: "n",
					description: "New name",
				},
				"public-link": {
					type: "boolean",
					description: "Enable/disable public link",
				},
				"public-link-limit": {
					type: "string",
					description: "Public link limit (1-10000)",
				},
				"feedback-enabled": {
					type: "boolean",
					description: "Enable/disable feedback",
				},
			},
			execute: updateBetaGroup,
		},
		delete: {
			name: "delete",
			description: "Delete a beta group",
			options: {
				id: {
					type: "string",
					description: "Beta group ID",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm deletion",
					default: false,
				},
			},
			execute: deleteBetaGroup,
		},
		"add-testers": {
			name: "add-testers",
			description: "Add testers to a beta group",
			options: {
				group: {
					type: "string",
					short: "g",
					description: "Beta group ID",
					required: true,
				},
				tester: {
					type: "string",
					short: "t",
					description: "Tester ID(s), comma-separated",
					required: true,
				},
			},
			execute: addTestersToGroup,
		},
		"remove-testers": {
			name: "remove-testers",
			description: "Remove testers from a beta group",
			options: {
				group: {
					type: "string",
					short: "g",
					description: "Beta group ID",
					required: true,
				},
				tester: {
					type: "string",
					short: "t",
					description: "Tester ID(s), comma-separated",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm removal",
					default: false,
				},
			},
			execute: removeTestersFromGroup,
		},
	},
};

// Beta Testers commands
const betaTestersCommand: Command = {
	name: "beta-testers",
	description: "Manage TestFlight beta testers",
	subcommands: {
		list: {
			name: "list",
			description: "List beta testers",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "Filter by App ID",
				},
				group: {
					type: "string",
					short: "g",
					description: "Filter by beta group ID",
				},
				email: {
					type: "string",
					short: "e",
					description: "Filter by email",
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
			execute: listBetaTesters,
		},
		get: {
			name: "get",
			description: "Get beta tester by ID",
			options: {
				id: {
					type: "string",
					description: "Beta tester ID",
					required: true,
				},
				include: {
					type: "string",
					description: "Include related resources (apps, betaGroups, builds)",
				},
			},
			execute: getBetaTester,
		},
		invite: {
			name: "invite",
			description: "Invite a beta tester",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
				email: {
					type: "string",
					short: "e",
					description: "Tester email",
					required: true,
				},
				"first-name": {
					type: "string",
					description: "First name",
				},
				"last-name": {
					type: "string",
					description: "Last name",
				},
				group: {
					type: "string",
					short: "g",
					description: "Beta group ID to add tester to",
				},
			},
			execute: inviteBetaTester,
		},
		delete: {
			name: "delete",
			description: "Delete a beta tester",
			options: {
				id: {
					type: "string",
					description: "Beta tester ID",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm deletion",
					default: false,
				},
			},
			execute: deleteBetaTester,
		},
	},
};

// Main testflight command
const testflightCommand: Command = {
	name: "testflight",
	description: "Manage TestFlight",
	subcommands: {
		"beta-groups": betaGroupsCommand,
		"beta-testers": betaTestersCommand,
	},
};

// Implementation functions

async function listBetaGroups(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = (ctx.args.options.app as string) || process.env.ASC_APP_ID;

	if (!appId) {
		printError("--app is required (or set ASC_APP_ID)");
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
	params.set("filter[app]", appId);
	params.set("limit", String(Math.min(limit, 200)));

	const path = `/v1/betaGroups?${params.toString()}`;

	if (paginate) {
		const groups = await client.paginate(path);
		printOutput({ data: groups }, format);
	} else {
		const response = await client.get<BetaGroupsResponse>(path);
		printOutput(response, format);
	}
}

async function getBetaGroup(ctx: CommandContext): Promise<void> {
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

	const response = await client.get<BetaGroupResponse>(`/v1/betaGroups/${id}`);
	printOutput(response, format);
}

async function createBetaGroup(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = ctx.args.options.app as string;
	const name = ctx.args.options.name as string;

	if (!appId) {
		printError("--app is required");
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

	const response = await client.post<BetaGroupResponse>("/v1/betaGroups", {
		data: {
			type: "betaGroups",
			attributes: {
				name,
				publicLinkEnabled: ctx.args.options["public-link"] === true,
				feedbackEnabled: ctx.args.options["feedback-enabled"] === true,
			},
			relationships: {
				app: {
					data: { type: "apps", id: appId },
				},
			},
		},
	});

	printSuccess(`Created beta group: ${name}`);
	printOutput(response, format);
}

async function updateBetaGroup(ctx: CommandContext): Promise<void> {
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

	const attributes: Record<string, unknown> = {};

	if (ctx.args.options.name) {
		attributes.name = ctx.args.options.name;
	}
	if (ctx.args.options["public-link"] !== undefined) {
		attributes.publicLinkEnabled = ctx.args.options["public-link"];
	}
	if (ctx.args.options["public-link-limit"]) {
		attributes.publicLinkLimitEnabled = true;
		attributes.publicLinkLimit = Number.parseInt(
			ctx.args.options["public-link-limit"] as string,
			10,
		);
	}
	if (ctx.args.options["feedback-enabled"] !== undefined) {
		attributes.feedbackEnabled = ctx.args.options["feedback-enabled"];
	}

	if (Object.keys(attributes).length === 0) {
		printError("At least one attribute to update is required");
		process.exit(1);
	}

	const response = await client.patch<BetaGroupResponse>(
		`/v1/betaGroups/${id}`,
		{
			data: {
				type: "betaGroups",
				id,
				attributes,
			},
		},
	);

	printSuccess(`Updated beta group ${id}`);
	printOutput(response, format);
}

async function deleteBetaGroup(ctx: CommandContext): Promise<void> {
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

	await client.delete(`/v1/betaGroups/${id}`);
	printSuccess(`Deleted beta group ${id}`);
}

async function addTestersToGroup(ctx: CommandContext): Promise<void> {
	const groupId = ctx.args.options.group as string;
	const testerIds = (ctx.args.options.tester as string)
		?.split(",")
		.map((id) => id.trim())
		.filter(Boolean);

	if (!groupId) {
		printError("--group is required");
		process.exit(1);
	}
	if (!testerIds || testerIds.length === 0) {
		printError("--tester is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	await client.post(`/v1/betaGroups/${groupId}/relationships/betaTesters`, {
		data: testerIds.map((id) => ({ type: "betaTesters", id })),
	});

	printSuccess(`Added ${testerIds.length} tester(s) to group ${groupId}`);
}

async function removeTestersFromGroup(ctx: CommandContext): Promise<void> {
	const groupId = ctx.args.options.group as string;
	const testerIds = (ctx.args.options.tester as string)
		?.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
	const confirm = ctx.args.options.confirm === true;

	if (!groupId) {
		printError("--group is required");
		process.exit(1);
	}
	if (!testerIds || testerIds.length === 0) {
		printError("--tester is required");
		process.exit(1);
	}
	if (!confirm) {
		printError("Use --confirm to remove testers.");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	await client.delete(`/v1/betaGroups/${groupId}/relationships/betaTesters`, {
		data: testerIds.map((id) => ({ type: "betaTesters", id })),
	});

	printSuccess(`Removed ${testerIds.length} tester(s) from group ${groupId}`);
}

async function listBetaTesters(ctx: CommandContext): Promise<void> {
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

	if (ctx.args.options.app) {
		params.set("filter[apps]", ctx.args.options.app as string);
	}
	if (ctx.args.options.group) {
		params.set("filter[betaGroups]", ctx.args.options.group as string);
	}
	if (ctx.args.options.email) {
		params.set("filter[email]", ctx.args.options.email as string);
	}

	const path = `/v1/betaTesters?${params.toString()}`;

	if (paginate) {
		const testers = await client.paginate(path);
		printOutput({ data: testers }, format);
	} else {
		const response = await client.get<BetaTestersResponse>(path);
		printOutput(response, format);
	}
}

async function getBetaTester(ctx: CommandContext): Promise<void> {
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

	let path = `/v1/betaTesters/${id}`;
	if (ctx.args.options.include) {
		path += `?include=${encodeURIComponent(ctx.args.options.include as string)}`;
	}

	const response = await client.get<BetaTesterResponse>(path);
	printOutput(response, format);
}

async function inviteBetaTester(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = ctx.args.options.app as string;
	const email = ctx.args.options.email as string;

	if (!appId) {
		printError("--app is required");
		process.exit(1);
	}
	if (!email) {
		printError("--email is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const attributes: Record<string, string> = { email };
	if (ctx.args.options["first-name"]) {
		attributes.firstName = ctx.args.options["first-name"] as string;
	}
	if (ctx.args.options["last-name"]) {
		attributes.lastName = ctx.args.options["last-name"] as string;
	}

	const relationships: Record<string, unknown> = {
		apps: {
			data: [{ type: "apps", id: appId }],
		},
	};

	if (ctx.args.options.group) {
		relationships.betaGroups = {
			data: [{ type: "betaGroups", id: ctx.args.options.group }],
		};
	}

	const response = await client.post<BetaTesterResponse>("/v1/betaTesters", {
		data: {
			type: "betaTesters",
			attributes,
			relationships,
		},
	});

	printSuccess(`Invited ${email}`);
	printOutput(response, format);
}

async function deleteBetaTester(ctx: CommandContext): Promise<void> {
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

	await client.delete(`/v1/betaTesters/${id}`);
	printSuccess(`Deleted beta tester ${id}`);
}

export function registerTestflightCommands(): void {
	registry.register(testflightCommand);
}
