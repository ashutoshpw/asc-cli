import { Client } from "../../../api/client";
import {
	addReviewSubmissionItem,
	createReviewSubmission,
	getReviewSubmission,
	listReviewSubmissionItems,
	listReviewSubmissions,
	removeReviewSubmissionItem,
	setReviewSubmissionState,
	updateReviewSubmission,
	updateReviewSubmissionItem,
} from "../../../api/review-submissions";
import type { AppStorePlatform } from "../../../api/types/commerce-versions";
import type { ReviewSubmissionItemTarget } from "../../../api/types/review-submissions";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
import { type Command, type CommandContext, registry } from "../../router";

const PLATFORMS: AppStorePlatform[] = ["IOS", "MAC_OS", "TV_OS", "VISION_OS"];

function required(ctx: CommandContext, name: string): string {
	const value = ctx.args.options[name] as string | undefined;
	if (!value) {
		printError(`--${name} is required`);
		process.exit(1);
	}
	return value;
}

function optionalPlatform(ctx: CommandContext): AppStorePlatform | undefined {
	const value = ctx.args.options.platform as string | undefined;
	if (!value) return undefined;
	const platform = value.toUpperCase() as AppStorePlatform;
	if (!PLATFORMS.includes(platform)) {
		printError(`Invalid platform. Must be one of: ${PLATFORMS.join(", ")}`);
		process.exit(1);
	}
	return platform;
}

async function getClient(ctx: CommandContext): Promise<Client> {
	const creds = await requireCredentials({ profile: ctx.global.profile });
	return Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});
}

function paginationPath(appId: string, limit: number): string {
	return `/v1/apps/${appId}/reviewSubmissions?limit=${Math.min(limit, 200)}`;
}

async function listSubmissions(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = required(ctx, "app");
	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const client = await getClient(ctx);
	if (ctx.args.options.paginate === true) {
		printOutput(
			{ data: await client.paginate(paginationPath(appId, limit)) },
			format,
		);
		return;
	}
	printOutput(
		{ data: await listReviewSubmissions(client, appId, limit) },
		format,
	);
}

async function getSubmission(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const submission = await getReviewSubmission(
		await getClient(ctx),
		required(ctx, "id"),
	);
	printOutput({ data: submission }, format);
}

async function createSubmission(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const submission = await createReviewSubmission(await getClient(ctx), {
		appId: required(ctx, "app"),
		platform: optionalPlatform(ctx),
	});
	printSuccess(`Created review submission ${submission.id}`);
	printOutput({ data: submission }, format);
}

async function updateSubmission(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const platform = optionalPlatform(ctx);
	if (!platform) {
		printError("--platform is required for update");
		process.exit(1);
	}
	const submission = await updateReviewSubmission(
		await getClient(ctx),
		required(ctx, "id"),
		{ platform },
	);
	printSuccess(`Updated review submission ${submission.id}`);
	printOutput({ data: submission }, format);
}

async function submitSubmission(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = required(ctx, "id");
	const submission = await setReviewSubmissionState(
		await getClient(ctx),
		id,
		"submitted",
	);
	printSuccess(`Submitted review submission ${id}`);
	printOutput({ data: submission }, format);
}

async function cancelSubmission(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = required(ctx, "id");
	if (ctx.args.options.confirm !== true) {
		printError("Use --confirm to cancel the review submission");
		process.exit(1);
	}
	const submission = await setReviewSubmissionState(
		await getClient(ctx),
		id,
		"canceled",
	);
	printSuccess(`Canceled review submission ${id}`);
	printOutput({ data: submission }, format);
}

async function listItems(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const submissionId = required(ctx, "submission-id");
	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const path = `/v1/reviewSubmissions/${submissionId}/items?limit=${Math.min(limit, 200)}`;
	const client = await getClient(ctx);
	if (ctx.args.options.paginate === true) {
		printOutput({ data: await client.paginate(path) }, format);
		return;
	}
	const items = await listReviewSubmissionItems(client, submissionId, limit);
	printOutput({ data: items.slice(0, Math.min(limit, 200)) }, format);
}

function getTarget(ctx: CommandContext): ReviewSubmissionItemTarget {
	const candidates: Array<{
		flag: string;
		target: (id: string) => ReviewSubmissionItemTarget;
	}> = [
		{
			flag: "app-store-version-id",
			target: (id) => ({
				relationship: "appStoreVersion",
				type: "appStoreVersions",
				id,
			}),
		},
		{
			flag: "iap-version-id",
			target: (id) => ({
				relationship: "inAppPurchaseVersion",
				type: "inAppPurchaseVersions",
				id,
			}),
		},
		{
			flag: "subscription-version-id",
			target: (id) => ({
				relationship: "subscriptionVersion",
				type: "subscriptionVersions",
				id,
			}),
		},
		{
			flag: "subscription-group-version-id",
			target: (id) => ({
				relationship: "subscriptionGroupVersion",
				type: "subscriptionGroupVersions",
				id,
			}),
		},
	];
	const supplied = candidates.filter(({ flag }) => ctx.args.options[flag]);
	if (supplied.length !== 1) {
		printError(
			"Exactly one item target is required: --app-store-version-id, --iap-version-id, --subscription-version-id, or --subscription-group-version-id",
		);
		process.exit(1);
	}
	const candidate = supplied[0];
	return candidate.target(ctx.args.options[candidate.flag] as string);
}

async function addItem(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const item = await addReviewSubmissionItem(
		await getClient(ctx),
		required(ctx, "submission-id"),
		getTarget(ctx),
	);
	printSuccess(`Added review submission item ${item.id}`);
	printOutput({ data: item }, format);
}

async function resolveItem(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const item = await updateReviewSubmissionItem(
		await getClient(ctx),
		required(ctx, "id"),
		{ resolved: true },
	);
	printSuccess(`Resolved review submission item ${item.id}`);
	printOutput({ data: item }, format);
}

async function removeItem(ctx: CommandContext): Promise<void> {
	const id = required(ctx, "id");
	if (ctx.args.options.confirm !== true) {
		printError("Use --confirm to remove the review submission item");
		process.exit(1);
	}
	await removeReviewSubmissionItem(await getClient(ctx), id);
	printSuccess(`Removed review submission item ${id}`);
}

const reviewSubmissionsCommand: Command = {
	name: "review-submissions",
	description: "Manage App Store review submissions",
	subcommands: {
		list: {
			name: "list",
			description: "List review submissions for an app",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
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
					description: "Fetch all pages automatically",
					default: false,
				},
			},
			execute: listSubmissions,
		},
		get: {
			name: "get",
			description: "Get a review submission",
			options: {
				id: { type: "string", description: "Submission ID", required: true },
			},
			execute: getSubmission,
		},
		create: {
			name: "create",
			description: "Create a review submission",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
				platform: { type: "string", description: "Platform" },
			},
			execute: createSubmission,
		},
		update: {
			name: "update",
			description: "Update a review submission platform",
			options: {
				id: { type: "string", description: "Submission ID", required: true },
				platform: { type: "string", description: "Platform", required: true },
			},
			execute: updateSubmission,
		},
		submit: {
			name: "submit",
			description: "Submit a review submission",
			options: {
				id: { type: "string", description: "Submission ID", required: true },
			},
			execute: submitSubmission,
		},
		cancel: {
			name: "cancel",
			description: "Cancel a review submission",
			options: {
				id: { type: "string", description: "Submission ID", required: true },
				confirm: {
					type: "boolean",
					description: "Confirm cancellation",
					default: false,
				},
			},
			execute: cancelSubmission,
		},
		items: {
			name: "items",
			description: "Manage review submission items",
			subcommands: {
				list: {
					name: "list",
					description: "List submission items",
					options: {
						"submission-id": {
							type: "string",
							description: "Submission ID",
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
							description: "Fetch all pages automatically",
							default: false,
						},
					},
					execute: listItems,
				},
				add: {
					name: "add",
					description: "Add a version to a submission",
					options: {
						"submission-id": {
							type: "string",
							description: "Submission ID",
							required: true,
						},
						"app-store-version-id": {
							type: "string",
							description: "App Store version ID",
						},
						"iap-version-id": { type: "string", description: "IAP version ID" },
						"subscription-version-id": {
							type: "string",
							description: "Subscription version ID",
						},
						"subscription-group-version-id": {
							type: "string",
							description: "Subscription group version ID",
						},
					},
					execute: addItem,
				},
				resolve: {
					name: "resolve",
					description: "Resolve a submission item",
					options: {
						id: { type: "string", description: "Item ID", required: true },
					},
					execute: resolveItem,
				},
				remove: {
					name: "remove",
					description: "Remove a submission item",
					options: {
						id: { type: "string", description: "Item ID", required: true },
						confirm: {
							type: "boolean",
							description: "Confirm removal",
							default: false,
						},
					},
					execute: removeItem,
				},
			},
		},
	},
};

export function registerReviewSubmissionCommands(): void {
	registry.register(reviewSubmissionsCommand);
}

export { reviewSubmissionsCommand };
