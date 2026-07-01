import { Client } from "../../../api/client";
import type {
	InAppPurchaseLocalizationResponse,
	InAppPurchaseLocalizationsResponse,
} from "../../../api/types/iap";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import type { CommandContext } from "../../router";

export async function listLocalizations(ctx: CommandContext): Promise<void> {
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

export async function createLocalization(ctx: CommandContext): Promise<void> {
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

export async function updateLocalization(ctx: CommandContext): Promise<void> {
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

export async function deleteLocalization(ctx: CommandContext): Promise<void> {
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
