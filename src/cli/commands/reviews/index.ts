import { Client } from "../../../api/client";
import type {
	CustomerReviewResponse,
	CustomerReviewResponseResponse,
	CustomerReviewsResponse,
} from "../../../api/types/reviews";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * Reviews commands
 * asc reviews list/get/respond
 */
import { type Command, type CommandContext, registry } from "../../router";

const reviewsCommand: Command = {
	name: "reviews",
	description: "Manage customer reviews",
	subcommands: {
		list: {
			name: "list",
			description: "List customer reviews for an app",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
				rating: {
					type: "string",
					short: "r",
					description: "Filter by rating (1-5), comma-separated for multiple",
				},
				territory: {
					type: "string",
					short: "t",
					description: "Filter by territory (e.g., USA, GBR)",
				},
				sort: {
					type: "string",
					short: "s",
					description:
						"Sort by: createdDate, -createdDate, rating, -rating (default: -createdDate)",
					default: "-createdDate",
				},
				limit: {
					type: "string",
					short: "l",
					description: "Maximum number of reviews to return",
					default: "50",
				},
				paginate: {
					type: "boolean",
					description: "Fetch all pages automatically",
					default: false,
				},
			},
			execute: listReviews,
		},
		get: {
			name: "get",
			description: "Get a specific review by ID",
			options: {
				id: {
					type: "string",
					description: "Review ID",
					required: true,
				},
				include: {
					type: "string",
					description: "Include related resources: response",
				},
			},
			execute: getReview,
		},
		respond: {
			name: "respond",
			description: "Respond to a customer review",
			options: {
				id: {
					type: "string",
					description: "Review ID to respond to",
					required: true,
				},
				body: {
					type: "string",
					short: "b",
					description: "Response text",
					required: true,
				},
			},
			execute: respondToReview,
		},
	},
};

async function listReviews(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const appId = ctx.args.options.app as string;

	if (!appId) {
		printError("--app is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const rating = ctx.args.options.rating as string | undefined;
	const territory = ctx.args.options.territory as string | undefined;
	const sort = (ctx.args.options.sort as string) || "-createdDate";
	const paginate = ctx.args.options.paginate === true;

	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));
	params.set("sort", sort);

	if (rating) {
		params.set("filter[rating]", rating);
	}

	if (territory) {
		params.set("filter[territory]", territory);
	}

	const path = `/v1/apps/${appId}/customerReviews?${params.toString()}`;

	if (paginate) {
		const reviews = await client.paginate(path);
		printOutput({ data: reviews }, format);
	} else {
		const response = await client.get<CustomerReviewsResponse>(path);
		printOutput(response, format);
	}
}

async function getReview(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const reviewId = ctx.args.options.id as string;

	if (!reviewId) {
		printError("--id is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	let path = `/v1/customerReviews/${reviewId}`;

	const include = ctx.args.options.include as string | undefined;
	if (include) {
		path += `?include=${include}`;
	}

	const response = await client.get<CustomerReviewResponse>(path);
	printOutput(response, format);
}

async function respondToReview(ctx: CommandContext): Promise<void> {
	const reviewId = ctx.args.options.id as string;
	const responseBody = ctx.args.options.body as string;

	if (!reviewId) {
		printError("--id is required");
		process.exit(1);
	}

	if (!responseBody) {
		printError("--body is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });

	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const body = {
		data: {
			type: "customerReviewResponses",
			attributes: {
				responseBody,
			},
			relationships: {
				review: {
					data: {
						type: "customerReviews",
						id: reviewId,
					},
				},
			},
		},
	};

	const response = await client.post<CustomerReviewResponseResponse>(
		"/v1/customerReviewResponses",
		body,
	);

	printSuccess(`Response submitted for review ${reviewId}`);
	printOutput(response, getOutputFormat(ctx.global));
}

export function registerReviewsCommands(): void {
	registry.register(reviewsCommand);
}
