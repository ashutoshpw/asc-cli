import type { Client } from "./client";
import {
	type CommerceVersionKind,
	resolveCommerceVersion,
} from "./commerce-versions";
import type { AppStorePlatform } from "./types/commerce-versions";
import type {
	ReviewSubmission,
	ReviewSubmissionItem,
	ReviewSubmissionItemResponse,
	ReviewSubmissionItemsResponse,
	ReviewSubmissionItemTarget,
	ReviewSubmissionResponse,
	ReviewSubmissionsResponse,
} from "./types/review-submissions";

export interface ReviewSubmissionInput {
	appId: string;
	platform?: AppStorePlatform;
}

export async function listReviewSubmissions(
	client: Client,
	appId: string,
	limit = 50,
): Promise<ReviewSubmission[]> {
	const response = await client.get<ReviewSubmissionsResponse>(
		`/v1/apps/${appId}/reviewSubmissions?limit=${Math.min(limit, 200)}`,
	);
	return response.data;
}

export async function getReviewSubmission(
	client: Client,
	submissionId: string,
): Promise<ReviewSubmission> {
	const response = await client.get<ReviewSubmissionResponse>(
		`/v1/reviewSubmissions/${submissionId}`,
	);
	return response.data;
}

export async function createReviewSubmission(
	client: Client,
	input: ReviewSubmissionInput,
): Promise<ReviewSubmission> {
	const attributes = input.platform ? { platform: input.platform } : undefined;
	const response = await client.post<ReviewSubmissionResponse>(
		"/v1/reviewSubmissions",
		{
			data: {
				type: "reviewSubmissions",
				...(attributes ? { attributes } : {}),
				relationships: {
					app: { data: { type: "apps", id: input.appId } },
				},
			},
		},
	);
	return response.data;
}

export async function updateReviewSubmission(
	client: Client,
	submissionId: string,
	attributes: { platform?: AppStorePlatform },
): Promise<ReviewSubmission> {
	const response = await client.patch<ReviewSubmissionResponse>(
		`/v1/reviewSubmissions/${submissionId}`,
		{
			data: {
				type: "reviewSubmissions",
				id: submissionId,
				attributes,
			},
		},
	);
	return response.data;
}

export async function setReviewSubmissionState(
	client: Client,
	submissionId: string,
	state: "submitted" | "canceled",
): Promise<ReviewSubmission> {
	const response = await client.patch<ReviewSubmissionResponse>(
		`/v1/reviewSubmissions/${submissionId}`,
		{
			data: {
				type: "reviewSubmissions",
				id: submissionId,
				attributes:
					state === "submitted" ? { submitted: true } : { canceled: true },
			},
		},
	);
	return response.data;
}

export async function listReviewSubmissionItems(
	client: Client,
	submissionId: string,
	limit = 200,
): Promise<ReviewSubmissionItem[]> {
	const response = await client.get<ReviewSubmissionItemsResponse>(
		`/v1/reviewSubmissions/${submissionId}/items?limit=${Math.min(limit, 200)}`,
	);
	return response.data;
}

export async function addReviewSubmissionItem(
	client: Client,
	submissionId: string,
	target: ReviewSubmissionItemTarget,
): Promise<ReviewSubmissionItem> {
	const response = await client.post<ReviewSubmissionItemResponse>(
		"/v1/reviewSubmissionItems",
		{
			data: {
				type: "reviewSubmissionItems",
				relationships: {
					reviewSubmission: {
						data: { type: "reviewSubmissions", id: submissionId },
					},
					[target.relationship]: {
						data: { type: target.type, id: target.id },
					},
				},
			},
		},
	);
	return response.data;
}

export async function updateReviewSubmissionItem(
	client: Client,
	itemId: string,
	attributes: { resolved?: boolean; removed?: boolean },
): Promise<ReviewSubmissionItem> {
	const response = await client.patch<ReviewSubmissionItemResponse>(
		`/v1/reviewSubmissionItems/${itemId}`,
		{
			data: {
				type: "reviewSubmissionItems",
				id: itemId,
				attributes,
			},
		},
	);
	return response.data;
}

export async function removeReviewSubmissionItem(
	client: Client,
	itemId: string,
): Promise<void> {
	await client.delete(`/v1/reviewSubmissionItems/${itemId}`);
}

function targetFromVersion(
	kind: CommerceVersionKind,
	versionId: string,
): ReviewSubmissionItemTarget {
	if (kind === "iap") {
		return {
			relationship: "inAppPurchaseVersion",
			type: "inAppPurchaseVersions",
			id: versionId,
		};
	}
	if (kind === "subscription") {
		return {
			relationship: "subscriptionVersion",
			type: "subscriptionVersions",
			id: versionId,
		};
	}
	return {
		relationship: "subscriptionGroupVersion",
		type: "subscriptionGroupVersions",
		id: versionId,
	};
}

function itemTargets(item: ReviewSubmissionItem): string[] {
	const relationships = item.relationships ?? {};
	return [
		relationships.appStoreVersion?.data?.id,
		relationships.inAppPurchaseVersion?.data?.id,
		relationships.subscriptionVersion?.data?.id,
		relationships.subscriptionGroupVersion?.data?.id,
	].filter((id): id is string => Boolean(id));
}

export async function submitCommerceVersionForReview(
	client: Client,
	options: {
		kind: CommerceVersionKind;
		ownerId: string;
		appId?: string;
		versionId?: string;
		submissionId?: string;
		platform?: AppStorePlatform;
	},
): Promise<{
	submission: ReviewSubmission;
	item: ReviewSubmissionItem;
	versionId: string;
}> {
	const version = await resolveCommerceVersion(
		client,
		options.kind,
		options.ownerId,
		options.versionId,
		true,
	);
	const target = targetFromVersion(options.kind, version.id);

	let submission: ReviewSubmission;
	if (options.submissionId) {
		submission = await getReviewSubmission(client, options.submissionId);
	} else {
		if (!options.appId) {
			throw new Error(
				`--app is required to find or create a review submission for ${options.kind} ${options.ownerId}; use --submission-id to target an existing submission`,
			);
		}
		const appId = options.appId;
		const ready = (await listReviewSubmissions(client, appId, 200)).filter(
			(candidate) => candidate.attributes?.state === "READY_FOR_REVIEW",
		);
		if (ready.length > 1) {
			throw new Error(
				`Multiple READY_FOR_REVIEW submissions exist for app ${appId}; pass --submission-id`,
			);
		}
		submission =
			ready[0] ??
			(await createReviewSubmission(client, {
				appId,
				platform: options.platform,
			}));
	}

	if (
		submission.attributes?.state &&
		submission.attributes.state !== "READY_FOR_REVIEW"
	) {
		throw new Error(
			`Review submission ${submission.id} is ${submission.attributes.state}; only READY_FOR_REVIEW submissions can be submitted`,
		);
	}

	const items = await listReviewSubmissionItems(client, submission.id);
	const existing = items.find((item) => itemTargets(item).includes(version.id));
	const item =
		existing ?? (await addReviewSubmissionItem(client, submission.id, target));
	const submitted = await setReviewSubmissionState(
		client,
		submission.id,
		"submitted",
	);

	return { submission: submitted, item, versionId: version.id };
}
