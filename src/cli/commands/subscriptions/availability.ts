import { Client } from "../../../api/client";
import type {
	SubscriptionPlanAvailabilitiesResponse,
	SubscriptionPlanAvailabilityResponse,
	SubscriptionPlanType,
} from "../../../api/types/commerce-versions";
import type { TerritoriesResponse } from "../../../api/types/subscriptions";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import type { Command, CommandContext } from "../../router";

const PLAN_TYPES: SubscriptionPlanType[] = ["MONTHLY", "UPFRONT"];

function requireId(ctx: CommandContext): string {
	const id = ctx.args.options.id as string | undefined;
	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	return id;
}

function getPlanType(value: string | undefined): SubscriptionPlanType {
	const planType = (value || "MONTHLY").toUpperCase() as SubscriptionPlanType;
	if (!PLAN_TYPES.includes(planType)) {
		printError(`Invalid plan type. Must be one of: ${PLAN_TYPES.join(", ")}`);
		process.exit(1);
	}
	return planType;
}

async function getClient(ctx: CommandContext): Promise<Client> {
	const creds = await requireCredentials({ profile: ctx.global.profile });
	return Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});
}

export async function getAvailability(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subscriptionId = requireId(ctx);
	const client = await getClient(ctx);
	const response = await client.get<SubscriptionPlanAvailabilitiesResponse>(
		`/v1/subscriptions/${subscriptionId}/planAvailabilities?limit=200`,
	);
	printOutput(response, format);
}

export async function setAvailability(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subscriptionId = requireId(ctx);
	const territories = ctx.args.options.territory as string | undefined;
	const availableInNew =
		ctx.args.options["available-in-new-territories"] === true;
	const planType = getPlanType(
		ctx.args.options["plan-type"] as string | undefined,
	);

	if (!territories) {
		printError("--territory is required");
		process.exit(1);
	}

	const territoryIds = territories
		.split(",")
		.map((territory) => territory.trim().toUpperCase())
		.filter(Boolean);
	if (territoryIds.length === 0) {
		printError("--territory must contain at least one territory");
		process.exit(1);
	}

	const response = await (
		await getClient(ctx)
	).post<SubscriptionPlanAvailabilityResponse>(
		"/v1/subscriptionPlanAvailabilities",
		{
			data: {
				type: "subscriptionPlanAvailabilities",
				attributes: {
					availableInNewTerritories: availableInNew,
					planType,
				},
				relationships: {
					subscription: {
						data: { type: "subscriptions", id: subscriptionId },
					},
					availableTerritories: {
						data: territoryIds.map((id) => ({ type: "territories", id })),
					},
				},
			},
		},
	);

	printSuccess(`Set ${planType} subscription plan availability`);
	printOutput(response, format);
}

export async function listAvailableTerritories(
	ctx: CommandContext,
): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const availabilityId = requireId(ctx);
	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const path = `/v1/subscriptionPlanAvailabilities/${availabilityId}/availableTerritories?limit=${Math.min(limit, 200)}`;
	const client = await getClient(ctx);

	if (ctx.args.options.paginate === true) {
		const territories = await client.paginate(path);
		printOutput({ data: territories }, format);
		return;
	}

	const response = await client.get<TerritoriesResponse>(path);
	printOutput(response, format);
}

export const availabilityCommand: Command = {
	name: "availability",
	description: "Manage subscription plan availability",
	subcommands: {
		get: {
			name: "get",
			description: "Get subscription plan availability",
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
			description: "Set subscription plan availability",
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
				"plan-type": {
					type: "string",
					description: "Plan type: MONTHLY or UPFRONT",
					default: "MONTHLY",
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
					description: "Subscription plan availability ID",
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
