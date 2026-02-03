import { Client } from "../../../api/client";
import type {
	InAppPurchaseLocalizationResponse,
	InAppPurchaseLocalizationsResponse,
	InAppPurchaseV2Response,
	InAppPurchasesV2Response,
} from "../../../api/types/iap";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * In-App Purchases commands
 * asc iap list/get/create/update/delete/localizations
 */
import { type Command, type CommandContext, registry } from "../../router";

const IAP_TYPES = ["CONSUMABLE", "NON_CONSUMABLE", "NON_RENEWING_SUBSCRIPTION"];

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

function getAppId(ctx: CommandContext): string {
	const appId = (ctx.args.options.app as string) || process.env.ASC_APP_ID;
	if (!appId) {
		printError("--app is required (or set ASC_APP_ID)");
		process.exit(1);
	}
	return appId;
}

async function listIAPs(ctx: CommandContext): Promise<void> {
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

	const path = `/v2/apps/${appId}/inAppPurchasesV2?${params.toString()}`;

	if (paginate) {
		const iaps = await client.paginate(path);
		printOutput({ data: iaps }, format);
	} else {
		const response = await client.get<InAppPurchasesV2Response>(path);
		printOutput(response, format);
	}
}

async function getIAP(ctx: CommandContext): Promise<void> {
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

async function createIAP(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = getAppId(ctx);
	const iapType = (ctx.args.options.type as string)?.toUpperCase();
	const refName = ctx.args.options["ref-name"] as string;
	const productId = ctx.args.options["product-id"] as string;

	if (!iapType) {
		printError("--type is required");
		process.exit(1);
	}
	if (!IAP_TYPES.includes(iapType)) {
		printError(`Invalid type. Must be one of: ${IAP_TYPES.join(", ")}`);
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

	const response = await client.post<InAppPurchaseV2Response>(
		"/v2/inAppPurchases",
		{
			data: {
				type: "inAppPurchases",
				attributes: {
					name: refName,
					productId,
					inAppPurchaseType: iapType,
				},
				relationships: {
					app: {
						data: { type: "apps", id: appId },
					},
				},
			},
		},
	);

	printSuccess(
		`Created in-app purchase: ${response.data.attributes.productId}`,
	);
	printOutput(response, format);
}

async function updateIAP(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;
	const refName = ctx.args.options["ref-name"] as string;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!refName) {
		printError("--ref-name is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.patch<InAppPurchaseV2Response>(
		`/v2/inAppPurchases/${id}`,
		{
			data: {
				type: "inAppPurchases",
				id,
				attributes: {
					name: refName,
				},
			},
		},
	);

	printSuccess(
		`Updated in-app purchase: ${response.data.attributes.productId}`,
	);
	printOutput(response, format);
}

async function deleteIAP(ctx: CommandContext): Promise<void> {
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

	await client.delete(`/v2/inAppPurchases/${id}`);
	printSuccess(`Deleted in-app purchase ${id}`);
}

async function listLocalizations(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const iapId = ctx.args.options["iap-id"] as string;

	if (!iapId) {
		printError("--iap-id is required");
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

	const path = `/v2/inAppPurchases/${iapId}/inAppPurchaseLocalizations?${params.toString()}`;

	if (paginate) {
		const localizations = await client.paginate(path);
		printOutput({ data: localizations }, format);
	} else {
		const response = await client.get<InAppPurchaseLocalizationsResponse>(path);
		printOutput(response, format);
	}
}

async function createLocalization(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const iapId = ctx.args.options["iap-id"] as string;
	const locale = ctx.args.options.locale as string;
	const name = ctx.args.options.name as string;
	const description = ctx.args.options.description as string | undefined;

	if (!iapId) {
		printError("--iap-id is required");
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

	const response = await client.post<InAppPurchaseLocalizationResponse>(
		"/v1/inAppPurchaseLocalizations",
		{
			data: {
				type: "inAppPurchaseLocalizations",
				attributes,
				relationships: {
					inAppPurchaseV2: {
						data: { type: "inAppPurchases", id: iapId },
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

	const response = await client.patch<InAppPurchaseLocalizationResponse>(
		`/v1/inAppPurchaseLocalizations/${id}`,
		{
			data: {
				type: "inAppPurchaseLocalizations",
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

	await client.delete(`/v1/inAppPurchaseLocalizations/${id}`);
	printSuccess(`Deleted localization ${id}`);
}

async function submitIAP(ctx: CommandContext): Promise<void> {
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

	const response = await client.post("/v1/inAppPurchaseSubmissions", {
		data: {
			type: "inAppPurchaseSubmissions",
			relationships: {
				inAppPurchaseV2: {
					data: { type: "inAppPurchases", id },
				},
			},
		},
	});

	printSuccess(`Submitted in-app purchase ${id} for review`);
	printOutput(response, format);
}

export function registerIapCommands(): void {
	registry.register(iapCommand);
}
