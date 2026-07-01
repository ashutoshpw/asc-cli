import { Client } from "../../../api/client";
import type {
	SubscriptionGroupsResponse,
	SubscriptionResponse,
	SubscriptionState,
	SubscriptionsResponse,
} from "../../../api/types/subscriptions";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import type { CommandContext } from "../../router";
import { parseStateFilter, validateSubscriptionPeriod } from "./shared";
import { mergeGroupSubscriptions } from "./shared";

// ============================================================================
// Subscription CRUD commands
// ============================================================================

function buildSubscriptionsPath(
	groupId: string,
	limit: number,
	states: SubscriptionState[] | undefined,
): string {
	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));
	if (states) {
		params.set("filter[state]", states.join(","));
	}
	return `/v1/subscriptionGroups/${groupId}/subscriptions?${params.toString()}`;
}

export async function listSubscriptions(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const groupId = ctx.args.options.group as string | undefined;
	const appId =
		(ctx.args.options.app as string | undefined) || process.env.ASC_APP_ID;
	const explicitApp = Boolean(ctx.args.options.app);

	if (groupId && explicitApp) {
		printError("--group and --app are mutually exclusive");
		process.exit(1);
	}
	if (!groupId && !appId) {
		printError("Either --group or --app is required (or set ASC_APP_ID)");
		process.exit(1);
	}

	const states = parseStateFilter(ctx.args.options.state as string | undefined);
	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const paginate = ctx.args.options.paginate === true;

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	if (groupId) {
		const path = buildSubscriptionsPath(groupId, limit, states);

		if (paginate) {
			const subscriptions = await client.paginate(path);
			printOutput({ data: subscriptions }, format);
		} else {
			const response = await client.get<SubscriptionsResponse>(path);
			printOutput(response, format);
		}
		return;
	}

	// --app shortcut: fetch all subscription groups for the app, then merge
	// subscriptions from each group into a single combined response.
	const groupsParams = new URLSearchParams();
	groupsParams.set("limit", String(Math.min(limit, 200)));
	const groupsPath = `/v1/apps/${appId}/subscriptionGroups?${groupsParams.toString()}`;

	let groups: Array<{ id: string }>;
	if (paginate) {
		groups = await client.paginate(groupsPath);
	} else {
		const groupsResponse =
			await client.get<SubscriptionGroupsResponse>(groupsPath);
		groups = groupsResponse.data;
	}

	const perGroup: unknown[][] = [];
	for (const group of groups) {
		const path = buildSubscriptionsPath(group.id, limit, states);
		if (paginate) {
			perGroup.push(await client.paginate(path));
		} else {
			const response = await client.get<SubscriptionsResponse>(path);
			perGroup.push(response.data);
		}
	}

	const subscriptions = mergeGroupSubscriptions(perGroup);
	printOutput({ data: subscriptions }, format);
}

export async function getSubscription(ctx: CommandContext): Promise<void> {
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

export async function createSubscription(ctx: CommandContext): Promise<void> {
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

export async function updateSubscription(ctx: CommandContext): Promise<void> {
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

export async function deleteSubscription(ctx: CommandContext): Promise<void> {
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
// Submit command
// ============================================================================

export async function submitSubscription(ctx: CommandContext): Promise<void> {
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
