import { Client } from "../../../api/client";
import {
	IAP_STATES,
	type InAppPurchaseState,
	type InAppPurchaseV2Response,
	type InAppPurchasesV2Response,
} from "../../../api/types/iap";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
} from "../../../output/formatter";
import type { CommandContext } from "../../router";
import { getAppId } from "./shared";

/**
 * Parse and validate a comma-separated --state flag value.
 * Normalizes to uppercase and validates against IAP_STATES.
 * Returns undefined if no value was provided.
 * Prints an error and exits with code 1 on invalid states.
 */
export function parseStateFilter(
	value: string | undefined,
): InAppPurchaseState[] | undefined {
	if (!value) return undefined;

	const states = value
		.split(",")
		.map((s) => s.trim().toUpperCase())
		.filter((s) => s.length > 0);

	if (states.length === 0) return undefined;

	const invalid = states.filter(
		(s) => !IAP_STATES.includes(s as InAppPurchaseState),
	);
	if (invalid.length > 0) {
		printError(
			`Invalid state(s): ${invalid.join(", ")}. Must be one of: ${IAP_STATES.join(", ")}`,
		);
		process.exit(1);
	}

	return states as InAppPurchaseState[];
}

export async function listIAPs(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = getAppId(ctx);
	const states = parseStateFilter(ctx.args.options.state as string | undefined);

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const paginate = ctx.args.options.paginate === true;

	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));
	if (states) {
		params.set("filter[state]", states.join(","));
	}

	const path = `/v2/apps/${appId}/inAppPurchasesV2?${params.toString()}`;

	if (paginate) {
		const iaps = await client.paginate(path);
		printOutput({ data: iaps }, format);
	} else {
		const response = await client.get<InAppPurchasesV2Response>(path);
		printOutput(response, format);
	}
}

export async function getIAP(ctx: CommandContext): Promise<void> {
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

	let path = `/v2/inAppPurchases/${id}`;
	if (ctx.args.options.include) {
		path += `?include=${encodeURIComponent(ctx.args.options.include as string)}`;
	}

	const response = await client.get<InAppPurchaseV2Response>(path);
	printOutput(response, format);
}
