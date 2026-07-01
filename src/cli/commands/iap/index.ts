import { IAP_STATES } from "../../../api/types/iap";
/**
 * In-App Purchases commands
 * asc iap list/get/create/update/delete/localizations
 */
import { type Command, registry } from "../../router";
import { getIAP, listIAPs, parseStateFilter } from "./list";
import {
	createLocalization,
	deleteLocalization,
	listLocalizations,
	updateLocalization,
} from "./localizations";
import { createIAP, deleteIAP, submitIAP, updateIAP } from "./mutate";

export { parseStateFilter, listIAPs };

const iapCommand: Command = {
	name: "iap",
	description: "Manage in-app purchases",
	subcommands: {
		list: {
			name: "list",
			description: "List in-app purchases for an app",
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
				state: {
					type: "string",
					description: `Filter by state (comma-separated). One or more of: ${IAP_STATES.join(", ")}`,
				},
			},
			execute: listIAPs,
		},
		get: {
			name: "get",
			description: "Get in-app purchase by ID",
			options: {
				id: {
					type: "string",
					description: "In-app purchase ID",
					required: true,
				},
				include: {
					type: "string",
					description: "Include related resources",
				},
			},
			execute: getIAP,
		},
		create: {
			name: "create",
			description: "Create a new in-app purchase",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID (or set ASC_APP_ID env)",
					required: true,
				},
				type: {
					type: "string",
					short: "t",
					description:
						"IAP type: CONSUMABLE, NON_CONSUMABLE, NON_RENEWING_SUBSCRIPTION",
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
					description: "Product ID (e.g., com.example.product)",
					required: true,
				},
			},
			execute: createIAP,
		},
		update: {
			name: "update",
			description: "Update an in-app purchase",
			options: {
				id: {
					type: "string",
					description: "In-app purchase ID",
					required: true,
				},
				"ref-name": {
					type: "string",
					short: "n",
					description: "Reference name",
				},
			},
			execute: updateIAP,
		},
		delete: {
			name: "delete",
			description: "Delete an in-app purchase",
			options: {
				id: {
					type: "string",
					description: "In-app purchase ID",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm deletion",
					default: false,
				},
			},
			execute: deleteIAP,
		},
		localizations: {
			name: "localizations",
			description: "Manage in-app purchase localizations",
			subcommands: {
				list: {
					name: "list",
					description: "List localizations for an IAP",
					options: {
						"iap-id": {
							type: "string",
							description: "In-app purchase ID",
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
					execute: listLocalizations,
				},
				create: {
					name: "create",
					description: "Create a localization",
					options: {
						"iap-id": {
							type: "string",
							description: "In-app purchase ID",
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
							description: "Display name",
							required: true,
						},
						description: {
							type: "string",
							short: "d",
							description: "Description",
						},
					},
					execute: createLocalization,
				},
				update: {
					name: "update",
					description: "Update a localization",
					options: {
						id: {
							type: "string",
							description: "Localization ID",
							required: true,
						},
						name: {
							type: "string",
							short: "n",
							description: "Display name",
						},
						description: {
							type: "string",
							short: "d",
							description: "Description",
						},
					},
					execute: updateLocalization,
				},
				delete: {
					name: "delete",
					description: "Delete a localization",
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
			description: "Submit an in-app purchase for review",
			options: {
				id: {
					type: "string",
					description: "In-app purchase ID",
					required: true,
				},
			},
			execute: submitIAP,
		},
	},
};

export function registerIapCommands(): void {
	registry.register(iapCommand);
}
