import { Client } from "../../../api/client";
import type {
	SubscriptionPricePointsResponse,
	SubscriptionPriceResponse,
	SubscriptionPricesResponse,
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
// Prices subcommands
// ============================================================================

export async function listPrices(ctx: CommandContext): Promise<void> {
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

	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const paginate = ctx.args.options.paginate === true;

	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));

	const path = `/v1/subscriptions/${subId}/prices?${params.toString()}`;

	if (paginate) {
		const prices = await client.paginate(path);
		printOutput({ data: prices }, format);
	} else {
		const response = await client.get<SubscriptionPricesResponse>(path);
		printOutput(response, format);
	}
}

export async function addPrice(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subId = ctx.args.options.id as string;
	const pricePointId = ctx.args.options["price-point"] as string;
	const territory = ctx.args.options.territory as string | undefined;
	const startDate = ctx.args.options["start-date"] as string | undefined;
	const preserved = ctx.args.options.preserved === true;

	if (!subId) {
		printError("--id is required");
		process.exit(1);
	}
	if (!pricePointId) {
		printError("--price-point is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const attributes: Record<string, unknown> = {};
	if (startDate) attributes.startDate = startDate;
	if (preserved) attributes.preserveCurrentPrice = true;

	const relationships: Record<string, unknown> = {
		subscription: {
			data: { type: "subscriptions", id: subId },
		},
		subscriptionPricePoint: {
			data: { type: "subscriptionPricePoints", id: pricePointId },
		},
	};

	if (territory) {
		relationships.territory = {
			data: { type: "territories", id: territory.toUpperCase() },
		};
	}

	const response = await client.post<SubscriptionPriceResponse>(
		"/v1/subscriptionPrices",
		{
			data: {
				type: "subscriptionPrices",
				attributes,
				relationships,
			},
		},
	);

	printSuccess("Added subscription price");
	printOutput(response, format);
}

export async function deletePrice(ctx: CommandContext): Promise<void> {
	const priceId = ctx.args.options["price-id"] as string;
	const confirm = ctx.args.options.confirm === true;

	if (!priceId) {
		printError("--price-id is required");
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

	await client.delete(`/v1/subscriptionPrices/${priceId}`);
	printSuccess(`Deleted subscription price ${priceId}`);
}

// ============================================================================
// Price Points subcommands
// ============================================================================

export async function listPricePoints(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subId = ctx.args.options.id as string;
	const territory = ctx.args.options.territory as string | undefined;

	if (!subId) {
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
	if (territory) {
		params.set("filter[territory]", territory.toUpperCase());
	}

	const path = `/v1/subscriptions/${subId}/pricePoints?${params.toString()}`;

	if (paginate) {
		const points = await client.paginate(path);
		printOutput({ data: points }, format);
	} else {
		const response = await client.get<SubscriptionPricePointsResponse>(path);
		printOutput(response, format);
	}
}

// ============================================================================
// Command definitions
// ============================================================================

export const pricesCommand: Command = {
	name: "prices",
	description: "Manage subscription pricing",
	subcommands: {
		list: {
			name: "list",
			description: "List prices for a subscription",
			options: {
				id: {
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
			execute: listPrices,
		},
		add: {
			name: "add",
			description: "Add a subscription price",
			options: {
				id: {
					type: "string",
					description: "Subscription ID",
					required: true,
				},
				"price-point": {
					type: "string",
					description: "Price point ID",
					required: true,
				},
				territory: {
					type: "string",
					description: "Territory ID (e.g., USA)",
				},
				"start-date": {
					type: "string",
					description: "Start date (YYYY-MM-DD)",
				},
				preserved: {
					type: "boolean",
					description: "Preserve current price",
					default: false,
				},
			},
			execute: addPrice,
		},
		delete: {
			name: "delete",
			description: "Delete a subscription price",
			options: {
				"price-id": {
					type: "string",
					description: "Subscription price ID",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm deletion",
					default: false,
				},
			},
			execute: deletePrice,
		},
	},
};

export const pricePointsCommand: Command = {
	name: "price-points",
	description: "List subscription price points",
	options: {
		id: {
			type: "string",
			description: "Subscription ID",
			required: true,
		},
		territory: {
			type: "string",
			description: "Filter by territory (e.g., USA)",
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
	execute: listPricePoints,
};
