import { Client } from "../../../api/client";
import {
	SUBSCRIPTION_PERIODS,
	type SubscriptionAvailabilityResponse,
	type SubscriptionGroupLocalizationResponse,
	type SubscriptionGroupLocalizationsResponse,
	type SubscriptionGroupResponse,
	type SubscriptionGroupsResponse,
	type SubscriptionLocalizationResponse,
	type SubscriptionLocalizationsResponse,
	type SubscriptionPeriod,
	type SubscriptionPricePointsResponse,
	type SubscriptionPriceResponse,
	type SubscriptionPricesResponse,
	type SubscriptionResponse,
	type SubscriptionsResponse,
	type TerritoriesResponse,
} from "../../../api/types/subscriptions";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * Subscriptions commands
 * asc subscriptions groups/list/get/create/update/delete/prices/availability/localizations
 */
import { type Command, type CommandContext, registry } from "../../router";

function getAppId(ctx: CommandContext): string {
	const appId = (ctx.args.options.app as string) || process.env.ASC_APP_ID;
	if (!appId) {
		printError("--app is required (or set ASC_APP_ID)");
		process.exit(1);
	}
	return appId;
}

function validateSubscriptionPeriod(
	value: string | undefined,
): SubscriptionPeriod | undefined {
	if (!value) return undefined;
	const upper = value.toUpperCase() as SubscriptionPeriod;
	if (!SUBSCRIPTION_PERIODS.includes(upper)) {
		printError(
			`Invalid subscription period. Must be one of: ${SUBSCRIPTION_PERIODS.join(", ")}`,
		);
		process.exit(1);
	}
	return upper;
}

// ============================================================================
// Groups subcommands
// ============================================================================

async function listGroups(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = getAppId(ctx);

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const paginate = ctx.args.options.paginate === true;

	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));

	const path = `/v1/apps/${appId}/subscriptionGroups?${params.toString()}`;

	if (paginate) {
		const groups = await client.paginate(path);
		printOutput({ data: groups }, format);
	} else {
		const response = await client.get<SubscriptionGroupsResponse>(path);
		printOutput(response, format);
	}
}

async function getGroup(ctx: CommandContext): Promise<void> {
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

	const response = await client.get<SubscriptionGroupResponse>(
		`/v1/subscriptionGroups/${id}`,
	);
	printOutput(response, format);
}

async function createGroup(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = getAppId(ctx);
	const referenceName = ctx.args.options["reference-name"] as string;

	if (!referenceName) {
		printError("--reference-name is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.post<SubscriptionGroupResponse>(
		"/v1/subscriptionGroups",
		{
			data: {
				type: "subscriptionGroups",
				attributes: {
					referenceName,
				},
				relationships: {
					app: {
						data: { type: "apps", id: appId },
					},
				},
			},
		},
	);

	printSuccess(`Created subscription group: ${referenceName}`);
	printOutput(response, format);
}

async function updateGroup(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;
	const referenceName = ctx.args.options["reference-name"] as string;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!referenceName) {
		printError("--reference-name is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.patch<SubscriptionGroupResponse>(
		`/v1/subscriptionGroups/${id}`,
		{
			data: {
				type: "subscriptionGroups",
				id,
				attributes: {
					referenceName,
				},
			},
		},
	);

	printSuccess(`Updated subscription group: ${id}`);
	printOutput(response, format);
}

async function deleteGroup(ctx: CommandContext): Promise<void> {
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

	await client.delete(`/v1/subscriptionGroups/${id}`);
	printSuccess(`Deleted subscription group ${id}`);
}

// ============================================================================
// Groups localizations subcommands
// ============================================================================

async function listGroupLocalizations(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const groupId = ctx.args.options["group-id"] as string;

	if (!groupId) {
		printError("--group-id is required");
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

	const path = `/v1/subscriptionGroups/${groupId}/subscriptionGroupLocalizations?${params.toString()}`;

	if (paginate) {
		const localizations = await client.paginate(path);
		printOutput({ data: localizations }, format);
	} else {
		const response =
			await client.get<SubscriptionGroupLocalizationsResponse>(path);
		printOutput(response, format);
	}
}

async function createGroupLocalization(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const groupId = ctx.args.options["group-id"] as string;
	const locale = ctx.args.options.locale as string;
	const name = ctx.args.options.name as string;
	const customAppName = ctx.args.options["custom-app-name"] as
		| string
		| undefined;

	if (!groupId) {
		printError("--group-id is required");
		process.exit(1);
	}
	if (!locale) {
		printError("--locale is required");
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

	const attributes: Record<string, string> = { name, locale };
	if (customAppName) attributes.customAppName = customAppName;

	const response = await client.post<SubscriptionGroupLocalizationResponse>(
		"/v1/subscriptionGroupLocalizations",
		{
			data: {
				type: "subscriptionGroupLocalizations",
				attributes,
				relationships: {
					subscriptionGroup: {
						data: { type: "subscriptionGroups", id: groupId },
					},
				},
			},
		},
	);

	printSuccess(`Created localization for ${locale}`);
	printOutput(response, format);
}

async function updateGroupLocalization(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;
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

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const attributes: Record<string, string> = {};
	if (name) attributes.name = name;
	if (customAppName) attributes.customAppName = customAppName;

	const response = await client.patch<SubscriptionGroupLocalizationResponse>(
		`/v1/subscriptionGroupLocalizations/${id}`,
		{
			data: {
				type: "subscriptionGroupLocalizations",
				id,
				attributes,
			},
		},
	);

	printSuccess(`Updated localization ${id}`);
	printOutput(response, format);
}

async function deleteGroupLocalization(ctx: CommandContext): Promise<void> {
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

	await client.delete(`/v1/subscriptionGroupLocalizations/${id}`);
	printSuccess(`Deleted localization ${id}`);
}

// ============================================================================
// Subscription CRUD commands
// ============================================================================

async function listSubscriptions(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const groupId = ctx.args.options.group as string;

	if (!groupId) {
		printError("--group is required");
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

	const path = `/v1/subscriptionGroups/${groupId}/subscriptions?${params.toString()}`;

	if (paginate) {
		const subscriptions = await client.paginate(path);
		printOutput({ data: subscriptions }, format);
	} else {
		const response = await client.get<SubscriptionsResponse>(path);
		printOutput(response, format);
	}
}

async function getSubscription(ctx: CommandContext): Promise<void> {
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

	let path = `/v1/subscriptions/${id}`;
	if (ctx.args.options.include) {
		path += `?include=${encodeURIComponent(ctx.args.options.include as string)}`;
	}

	const response = await client.get<SubscriptionResponse>(path);
	printOutput(response, format);
}

async function createSubscription(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const groupId = ctx.args.options.group as string;
	const refName = ctx.args.options["ref-name"] as string;
	const productId = ctx.args.options["product-id"] as string;
	const period = validateSubscriptionPeriod(
		ctx.args.options["subscription-period"] as string | undefined,
	);

	if (!groupId) {
		printError("--group is required");
		process.exit(1);
	}
	if (!refName) {
		printError("--ref-name is required");
		process.exit(1);
	}
	if (!productId) {
		printError("--product-id is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const attributes: Record<string, unknown> = {
		name: refName,
		productId,
	};
	if (period) attributes.subscriptionPeriod = period;

	const response = await client.post<SubscriptionResponse>(
		"/v1/subscriptions",
		{
			data: {
				type: "subscriptions",
				attributes,
				relationships: {
					group: {
						data: { type: "subscriptionGroups", id: groupId },
					},
				},
			},
		},
	);

	printSuccess(`Created subscription: ${productId}`);
	printOutput(response, format);
}

async function updateSubscription(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;
	const refName = ctx.args.options["ref-name"] as string | undefined;
	const period = validateSubscriptionPeriod(
		ctx.args.options["subscription-period"] as string | undefined,
	);

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!refName && !period) {
		printError(
			"At least one of --ref-name or --subscription-period is required",
		);
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const attributes: Record<string, unknown> = {};
	if (refName) attributes.name = refName;
	if (period) attributes.subscriptionPeriod = period;

	const response = await client.patch<SubscriptionResponse>(
		`/v1/subscriptions/${id}`,
		{
			data: {
				type: "subscriptions",
				id,
				attributes,
			},
		},
	);

	printSuccess(`Updated subscription ${id}`);
	printOutput(response, format);
}

async function deleteSubscription(ctx: CommandContext): Promise<void> {
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

	await client.delete(`/v1/subscriptions/${id}`);
	printSuccess(`Deleted subscription ${id}`);
}

// ============================================================================
// Prices subcommands
// ============================================================================

async function listPrices(ctx: CommandContext): Promise<void> {
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

async function addPrice(ctx: CommandContext): Promise<void> {
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

async function deletePrice(ctx: CommandContext): Promise<void> {
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

async function listPricePoints(ctx: CommandContext): Promise<void> {
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
// Availability subcommands
// ============================================================================

async function getAvailability(ctx: CommandContext): Promise<void> {
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

async function setAvailability(ctx: CommandContext): Promise<void> {
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

async function listAvailableTerritories(ctx: CommandContext): Promise<void> {
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
// Localizations subcommands
// ============================================================================

async function listLocalizations(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subId = ctx.args.options["subscription-id"] as string;

	if (!subId) {
		printError("--subscription-id is required");
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

	const path = `/v1/subscriptions/${subId}/subscriptionLocalizations?${params.toString()}`;

	if (paginate) {
		const localizations = await client.paginate(path);
		printOutput({ data: localizations }, format);
	} else {
		const response = await client.get<SubscriptionLocalizationsResponse>(path);
		printOutput(response, format);
	}
}

async function getLocalization(ctx: CommandContext): Promise<void> {
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

	const response = await client.get<SubscriptionLocalizationResponse>(
		`/v1/subscriptionLocalizations/${id}`,
	);
	printOutput(response, format);
}

async function createLocalization(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const subId = ctx.args.options["subscription-id"] as string;
	const locale = ctx.args.options.locale as string;
	const name = ctx.args.options.name as string;
	const description = ctx.args.options.description as string | undefined;

	if (!subId) {
		printError("--subscription-id is required");
		process.exit(1);
	}
	if (!locale) {
		printError("--locale is required");
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

	const attributes: Record<string, string> = { name, locale };
	if (description) attributes.description = description;

	const response = await client.post<SubscriptionLocalizationResponse>(
		"/v1/subscriptionLocalizations",
		{
			data: {
				type: "subscriptionLocalizations",
				attributes,
				relationships: {
					subscription: {
						data: { type: "subscriptions", id: subId },
					},
				},
			},
		},
	);

	printSuccess(`Created localization for ${locale}`);
	printOutput(response, format);
}

async function updateLocalization(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;
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

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const attributes: Record<string, string> = {};
	if (name) attributes.name = name;
	if (description) attributes.description = description;

	const response = await client.patch<SubscriptionLocalizationResponse>(
		`/v1/subscriptionLocalizations/${id}`,
		{
			data: {
				type: "subscriptionLocalizations",
				id,
				attributes,
			},
		},
	);

	printSuccess(`Updated localization ${id}`);
	printOutput(response, format);
}

async function deleteLocalization(ctx: CommandContext): Promise<void> {
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

	await client.delete(`/v1/subscriptionLocalizations/${id}`);
	printSuccess(`Deleted localization ${id}`);
}

// ============================================================================
// Submit command
// ============================================================================

async function submitSubscription(ctx: CommandContext): Promise<void> {
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

	const response = await client.post("/v1/subscriptionSubmissions", {
		data: {
			type: "subscriptionSubmissions",
			relationships: {
				subscription: {
					data: { type: "subscriptions", id },
				},
			},
		},
	});

	printSuccess(`Submitted subscription ${id} for review`);
	printOutput(response, format);
}

// ============================================================================
// Command registration
// ============================================================================

const subscriptionsCommand: Command = {
	name: "subscriptions",
	description: "Manage subscription groups and subscriptions",
	subcommands: {
		groups: {
			name: "groups",
			description: "Manage subscription groups",
			subcommands: {
				list: {
					name: "list",
					description: "List subscription groups for an app",
					options: {
						app: {
							type: "string",
							short: "a",
							description: "App ID (or set ASC_APP_ID env)",
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
					execute: listGroups,
				},
				get: {
					name: "get",
					description: "Get subscription group by ID",
					options: {
						id: {
							type: "string",
							description: "Subscription group ID",
							required: true,
						},
					},
					execute: getGroup,
				},
				create: {
					name: "create",
					description: "Create a subscription group",
					options: {
						app: {
							type: "string",
							short: "a",
							description: "App ID (or set ASC_APP_ID env)",
							required: true,
						},
						"reference-name": {
							type: "string",
							short: "n",
							description: "Reference name",
							required: true,
						},
					},
					execute: createGroup,
				},
				update: {
					name: "update",
					description: "Update a subscription group",
					options: {
						id: {
							type: "string",
							description: "Subscription group ID",
							required: true,
						},
						"reference-name": {
							type: "string",
							short: "n",
							description: "Reference name",
							required: true,
						},
					},
					execute: updateGroup,
				},
				delete: {
					name: "delete",
					description: "Delete a subscription group",
					options: {
						id: {
							type: "string",
							description: "Subscription group ID",
							required: true,
						},
						confirm: {
							type: "boolean",
							description: "Confirm deletion",
							default: false,
						},
					},
					execute: deleteGroup,
				},
				localizations: {
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
				},
			},
		},
		list: {
			name: "list",
			description: "List subscriptions in a group",
			options: {
				group: {
					type: "string",
					short: "g",
					description: "Subscription group ID",
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
			execute: listSubscriptions,
		},
		get: {
			name: "get",
			description: "Get subscription by ID",
			options: {
				id: {
					type: "string",
					description: "Subscription ID",
					required: true,
				},
				include: {
					type: "string",
					description: "Include related resources",
				},
			},
			execute: getSubscription,
		},
		create: {
			name: "create",
			description: "Create a subscription",
			options: {
				group: {
					type: "string",
					short: "g",
					description: "Subscription group ID",
					required: true,
				},
				"ref-name": {
					type: "string",
					short: "n",
					description: "Reference name",
					required: true,
				},
				"product-id": {
					type: "string",
					short: "p",
					description: "Product ID (e.g., com.example.sub.monthly)",
					required: true,
				},
				"subscription-period": {
					type: "string",
					description: `Period: ${SUBSCRIPTION_PERIODS.join(", ")}`,
				},
			},
			execute: createSubscription,
		},
		update: {
			name: "update",
			description: "Update a subscription",
			options: {
				id: {
					type: "string",
					description: "Subscription ID",
					required: true,
				},
				"ref-name": {
					type: "string",
					short: "n",
					description: "Reference name",
				},
				"subscription-period": {
					type: "string",
					description: `Period: ${SUBSCRIPTION_PERIODS.join(", ")}`,
				},
			},
			execute: updateSubscription,
		},
		delete: {
			name: "delete",
			description: "Delete a subscription",
			options: {
				id: {
					type: "string",
					description: "Subscription ID",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm deletion",
					default: false,
				},
			},
			execute: deleteSubscription,
		},
		prices: {
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
		},
		"price-points": {
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
		},
		availability: {
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
		},
		localizations: {
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
		},
		submit: {
			name: "submit",
			description: "Submit a subscription for review",
			options: {
				id: {
					type: "string",
					description: "Subscription ID",
					required: true,
				},
			},
			execute: submitSubscription,
		},
	},
};

export function registerSubscriptionsCommands(): void {
	registry.register(subscriptionsCommand);
}
