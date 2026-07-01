import { Client } from "../../../api/client";
import type {
	SubscriptionAvailabilityResponse,
	TerritoriesResponse,
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
// Availability subcommands
// ============================================================================

export async function getAvailability(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subId = ctx.args.options.id as string;

	if (!subId) {
		printError("--id is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.get<SubscriptionAvailabilityResponse>(
		`/v1/subscriptions/${subId}/subscriptionAvailability`,
	);
	printOutput(response, format);
}

export async function setAvailability(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subId = ctx.args.options.id as string;
	const territories = ctx.args.options.territory as string;
	const availableInNew =
		ctx.args.options["available-in-new-territories"] === true;

	if (!subId) {
		printError("--id is required");
		process.exit(1);
	}
	if (!territories) {
		printError("--territory is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const territoryIds = territories
		.split(",")
		.map((t) => t.trim().toUpperCase())
		.filter(Boolean);
	if (territoryIds.length === 0) {
		printError("--territory must contain at least one territory");
		process.exit(1);
	}

	const response = await client.post<SubscriptionAvailabilityResponse>(
		"/v1/subscriptionAvailabilities",
		{
			data: {
				type: "subscriptionAvailabilities",
				attributes: {
					availableInNewTerritories: availableInNew,
				},
				relationships: {
					subscription: {
						data: { type: "subscriptions", id: subId },
					},
					availableTerritories: {
						data: territoryIds.map((id) => ({ type: "territories", id })),
					},
				},
			},
		},
	);

	printSuccess("Set subscription availability");
	printOutput(response, format);
}

export async function listAvailableTerritories(
	ctx: CommandContext,
): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const availabilityId = ctx.args.options.id as string;

	if (!availabilityId) {
		printError("--id is required");
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

	const path = `/v1/subscriptionAvailabilities/${availabilityId}/availableTerritories?${params.toString()}`;

	if (paginate) {
		const territories = await client.paginate(path);
		printOutput({ data: territories }, format);
	} else {
		const response = await client.get<TerritoriesResponse>(path);
		printOutput(response, format);
	}
}

// ============================================================================
// Command definition
// ============================================================================

export const availabilityCommand: Command = {
	name: "availability",
	description: "Manage subscription availability",
	subcommands: {
		get: {
			name: "get",
			description: "Get subscription availability",
			options: {
				id: {
					type: "string",
					description: "Subscription ID",
					required: true,
				},
			},
			execute: getAvailability,
		},
		set: {
			name: "set",
			description: "Set subscription availability",
			options: {
				id: {
					type: "string",
					description: "Subscription ID",
					required: true,
				},
				territory: {
					type: "string",
					description: "Territory IDs, comma-separated",
					required: true,
				},
				"available-in-new-territories": {
					type: "boolean",
					description: "Include new territories automatically",
					default: false,
				},
			},
			execute: setAvailability,
		},
		"available-territories": {
			name: "available-territories",
			description: "List available territories",
			options: {
				id: {
					type: "string",
					description: "Subscription availability ID",
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
			execute: listAvailableTerritories,
		},
	},
};
