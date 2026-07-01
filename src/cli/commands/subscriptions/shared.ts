import {
	SUBSCRIPTION_PERIODS,
	SUBSCRIPTION_STATES,
	type SubscriptionPeriod,
	type SubscriptionState,
} from "../../../api/types/subscriptions";
import { printError } from "../../../output/formatter";
import type { CommandContext } from "../../router";

export function getAppId(ctx: CommandContext): string {
	const appId = (ctx.args.options.app as string) || process.env.ASC_APP_ID;
	if (!appId) {
		printError("--app is required (or set ASC_APP_ID)");
		process.exit(1);
	}
	return appId;
}

export function validateSubscriptionPeriod(
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

/**
 * Parse and validate a comma-separated --state flag value.
 * Normalizes to uppercase and validates against SUBSCRIPTION_STATES.
 * Returns undefined if no value was provided.
 * Prints an error and exits with code 1 on invalid states.
 */
export function parseStateFilter(
	value: string | undefined,
): SubscriptionState[] | undefined {
	if (!value) return undefined;

	const states = value
		.split(",")
		.map((s) => s.trim().toUpperCase())
		.filter((s) => s.length > 0);

	if (states.length === 0) return undefined;

	const invalid = states.filter(
		(s) => !SUBSCRIPTION_STATES.includes(s as SubscriptionState),
	);
	if (invalid.length > 0) {
		printError(
			`Invalid state(s): ${invalid.join(", ")}. Must be one of: ${SUBSCRIPTION_STATES.join(", ")}`,
		);
		process.exit(1);
	}

	return states as SubscriptionState[];
}

/**
 * Merge subscriptions fetched from multiple subscription groups into a
 * single combined list, preserving the raw resource shape.
 */
export function mergeGroupSubscriptions<T>(perGroup: T[][]): T[] {
	return perGroup.flat();
}
