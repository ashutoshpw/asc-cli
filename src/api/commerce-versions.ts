import type { Client } from "./client";
import type {
	InAppPurchaseVersion,
	InAppPurchaseVersionResponse,
	InAppPurchaseVersionsResponse,
	SubscriptionGroupVersion,
	SubscriptionGroupVersionResponse,
	SubscriptionGroupVersionsResponse,
	SubscriptionVersion,
	SubscriptionVersionResponse,
	SubscriptionVersionsResponse,
} from "./types/commerce-versions";
import { EDITABLE_COMMERCE_VERSION_STATES } from "./types/commerce-versions";

export type CommerceVersionKind = "iap" | "subscription" | "subscription-group";
export type CommerceVersion =
	| InAppPurchaseVersion
	| SubscriptionVersion
	| SubscriptionGroupVersion;

interface VersionConfig {
	ownerApiVersion: "v1" | "v2";
	ownerPath: string;
	resourcePath: string;
	resourceType: string;
	ownerType: string;
}

const VERSION_CONFIG: Record<CommerceVersionKind, VersionConfig> = {
	iap: {
		ownerApiVersion: "v2",
		ownerPath: "inAppPurchases",
		resourcePath: "inAppPurchaseVersions",
		resourceType: "inAppPurchaseVersions",
		ownerType: "inAppPurchases",
	},
	subscription: {
		ownerApiVersion: "v1",
		ownerPath: "subscriptions",
		resourcePath: "subscriptionVersions",
		resourceType: "subscriptionVersions",
		ownerType: "subscriptions",
	},
	"subscription-group": {
		ownerApiVersion: "v1",
		ownerPath: "subscriptionGroups",
		resourcePath: "subscriptionGroupVersions",
		resourceType: "subscriptionGroupVersions",
		ownerType: "subscriptionGroups",
	},
};

export function versionConfig(kind: CommerceVersionKind): VersionConfig {
	return VERSION_CONFIG[kind];
}

export function ownerVersionsPath(
	kind: CommerceVersionKind,
	ownerId: string,
	limit = 200,
): string {
	const config = versionConfig(kind);
	return `/${config.ownerApiVersion}/${config.ownerPath}/${ownerId}/versions?limit=${Math.min(limit, 200)}`;
}

export function versionPath(
	kind: CommerceVersionKind,
	versionId: string,
): string {
	return `/v1/${versionConfig(kind).resourcePath}/${versionId}`;
}

export async function listCommerceVersions(
	client: Client,
	kind: CommerceVersionKind,
	ownerId: string,
	limit = 200,
): Promise<CommerceVersion[]> {
	if (kind === "iap") {
		const response = await client.get<InAppPurchaseVersionsResponse>(
			ownerVersionsPath(kind, ownerId, limit),
		);
		return response.data;
	}

	if (kind === "subscription") {
		const response = await client.get<SubscriptionVersionsResponse>(
			ownerVersionsPath(kind, ownerId, limit),
		);
		return response.data;
	}

	const response = await client.get<SubscriptionGroupVersionsResponse>(
		ownerVersionsPath(kind, ownerId, limit),
	);
	return response.data;
}

export async function getCommerceVersion(
	client: Client,
	kind: CommerceVersionKind,
	versionId: string,
): Promise<CommerceVersion> {
	if (kind === "iap") {
		const response = await client.get<InAppPurchaseVersionResponse>(
			versionPath(kind, versionId),
		);
		return response.data;
	}

	if (kind === "subscription") {
		const response = await client.get<SubscriptionVersionResponse>(
			versionPath(kind, versionId),
		);
		return response.data;
	}

	const response = await client.get<SubscriptionGroupVersionResponse>(
		versionPath(kind, versionId),
	);
	return response.data;
}

export async function createCommerceVersion(
	client: Client,
	kind: CommerceVersionKind,
	ownerId: string,
): Promise<CommerceVersion> {
	const config = versionConfig(kind);
	const body = {
		data: {
			type: config.resourceType,
			relationships: {
				[kind === "iap"
					? "inAppPurchase"
					: kind === "subscription"
						? "subscription"
						: "subscriptionGroup"]: {
					data: { type: config.ownerType, id: ownerId },
				},
			},
		},
	};

	if (kind === "iap") {
		const response = await client.post<InAppPurchaseVersionResponse>(
			"/v1/inAppPurchaseVersions",
			body,
		);
		return response.data;
	}

	if (kind === "subscription") {
		const response = await client.post<SubscriptionVersionResponse>(
			"/v1/subscriptionVersions",
			body,
		);
		return response.data;
	}

	const response = await client.post<SubscriptionGroupVersionResponse>(
		"/v1/subscriptionGroupVersions",
		body,
	);
	return response.data;
}

export async function resolveCommerceVersion(
	client: Client,
	kind: CommerceVersionKind,
	ownerId: string,
	requestedVersionId?: string,
	forMutation = false,
): Promise<CommerceVersion> {
	if (requestedVersionId) {
		return getCommerceVersion(client, kind, requestedVersionId);
	}

	const versions = await listCommerceVersions(client, kind, ownerId);
	const sorted = [...versions].sort(
		(a, b) => (b.attributes?.version ?? 0) - (a.attributes?.version ?? 0),
	);
	const editable = sorted.filter((version) =>
		EDITABLE_COMMERCE_VERSION_STATES.includes(
			version.attributes
				?.state as (typeof EDITABLE_COMMERCE_VERSION_STATES)[number],
		),
	);

	if (editable[0]) return editable[0];
	if (!forMutation && sorted[0]) return sorted[0];

	const operation = forMutation ? "edit" : "read";
	throw new Error(
		`No editable ${kind} version found for ${ownerId}; pass --version-id to ${operation} a specific version`,
	);
}
