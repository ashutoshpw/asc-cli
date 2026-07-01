import {
	SUBSCRIPTION_PERIODS,
	SUBSCRIPTION_STATES,
} from "../../../api/types/subscriptions";
/**
 * Subscriptions commands
 * asc subscriptions groups/list/get/create/update/delete/prices/availability/localizations
 */
import { type Command, registry } from "../../router";
import { availabilityCommand } from "./availability";
import { groupsCommand } from "./groups";
import { localizationsCommand } from "./localizations";
import { pricePointsCommand, pricesCommand } from "./prices";
import { mergeGroupSubscriptions, parseStateFilter } from "./shared";
import {
	createSubscription,
	deleteSubscription,
	getSubscription,
	listSubscriptions,
	submitSubscription,
	updateSubscription,
} from "./subscriptions";

export { parseStateFilter, mergeGroupSubscriptions, listSubscriptions };

const subscriptionsCommand: Command = {
	name: "subscriptions",
	description: "Manage subscription groups and subscriptions",
	subcommands: {
		groups: groupsCommand,
		list: {
			name: "list",
			description: "List subscriptions in a group, or all groups for an app",
			options: {
				group: {
					type: "string",
					short: "g",
					description: "Subscription group ID (mutually exclusive with --app)",
				},
				app: {
					type: "string",
					short: "a",
					description:
						"App ID (or set ASC_APP_ID env). Lists subscriptions across " +
						"all subscription groups for the app. Mutually exclusive with --group",
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
				state: {
					type: "string",
					description: `Filter by state (comma-separated). One or more of: ${SUBSCRIPTION_STATES.join(", ")}`,
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
		prices: pricesCommand,
		"price-points": pricePointsCommand,
		availability: availabilityCommand,
		localizations: localizationsCommand,
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
