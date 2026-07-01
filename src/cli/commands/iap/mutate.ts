import { Client } from "../../../api/client";
import type { InAppPurchaseV2Response } from "../../../api/types/iap";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import type { CommandContext } from "../../router";
import { IAP_TYPES, getAppId } from "./shared";

export async function createIAP(ctx: CommandContext): Promise<void> {
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

export async function updateIAP(ctx: CommandContext): Promise<void> {
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

export async function deleteIAP(ctx: CommandContext): Promise<void> {
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

export async function submitIAP(ctx: CommandContext): Promise<void> {
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
