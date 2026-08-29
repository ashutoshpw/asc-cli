import type { Client } from "./client";
import type {
	InAppPurchaseVersionLocalization,
	InAppPurchaseVersionLocalizationResponse,
	InAppPurchaseVersionLocalizationsResponse,
	SubscriptionGroupVersionLocalization,
	SubscriptionGroupVersionLocalizationResponse,
	SubscriptionGroupVersionLocalizationsResponse,
	SubscriptionVersionLocalization,
	SubscriptionVersionLocalizationResponse,
	SubscriptionVersionLocalizationsResponse,
} from "./types/commerce-versions";

export type VersionLocalizationKind =
	| "iap"
	| "subscription"
	| "subscription-group";
export type VersionLocalization =
	| InAppPurchaseVersionLocalization
	| SubscriptionVersionLocalization
	| SubscriptionGroupVersionLocalization;

interface LocalizationConfig {
	collectionPath: string;
	resourcePath: string;
	versionPath: string;
	resourceType: string;
}

const CONFIG: Record<VersionLocalizationKind, LocalizationConfig> = {
	iap: {
		collectionPath: "/v2/inAppPurchaseLocalizations",
		resourcePath: "/v2/inAppPurchaseLocalizations",
		versionPath: "/v1/inAppPurchaseVersions",
		resourceType: "inAppPurchaseLocalizations",
	},
	subscription: {
		collectionPath: "/v2/subscriptionLocalizations",
		resourcePath: "/v2/subscriptionLocalizations",
		versionPath: "/v1/subscriptionVersions",
		resourceType: "subscriptionLocalizations",
	},
	"subscription-group": {
		collectionPath: "/v2/subscriptionGroupLocalizations",
		resourcePath: "/v2/subscriptionGroupLocalizations",
		versionPath: "/v1/subscriptionGroupVersions",
		resourceType: "subscriptionGroupLocalizations",
	},
};

export function localizationConfig(
	kind: VersionLocalizationKind,
): LocalizationConfig {
	return CONFIG[kind];
}

export function versionLocalizationsPath(
	kind: VersionLocalizationKind,
	versionId: string,
	limit = 50,
): string {
	return `${CONFIG[kind].versionPath}/${versionId}/localizations?limit=${Math.min(limit, 200)}`;
}

export async function listVersionLocalizations(
	client: Client,
	kind: VersionLocalizationKind,
	versionId: string,
): Promise<VersionLocalization[]> {
	if (kind === "iap") {
		const response =
			await client.get<InAppPurchaseVersionLocalizationsResponse>(
				versionLocalizationsPath(kind, versionId),
			);
		return response.data;
	}

	if (kind === "subscription") {
		const response = await client.get<SubscriptionVersionLocalizationsResponse>(
			versionLocalizationsPath(kind, versionId),
		);
		return response.data;
	}

	const response =
		await client.get<SubscriptionGroupVersionLocalizationsResponse>(
			versionLocalizationsPath(kind, versionId),
		);
	return response.data;
}

export async function createVersionLocalization(
	client: Client,
	kind: VersionLocalizationKind,
	versionId: string,
	attributes: Record<string, string>,
): Promise<VersionLocalization> {
	const config = CONFIG[kind];
	const responseBody = {
		data: {
			type: config.resourceType,
			attributes,
			relationships: {
				version: {
					data: {
						type:
							kind === "iap"
								? "inAppPurchaseVersions"
								: kind === "subscription"
									? "subscriptionVersions"
									: "subscriptionGroupVersions",
						id: versionId,
					},
				},
			},
		},
	};

	if (kind === "iap") {
		const response =
			await client.post<InAppPurchaseVersionLocalizationResponse>(
				config.collectionPath,
				responseBody,
			);
		return response.data;
	}

	if (kind === "subscription") {
		const response = await client.post<SubscriptionVersionLocalizationResponse>(
			config.collectionPath,
			responseBody,
		);
		return response.data;
	}

	const response =
		await client.post<SubscriptionGroupVersionLocalizationResponse>(
			config.collectionPath,
			responseBody,
		);
	return response.data;
}

export async function getVersionLocalization(
	client: Client,
	kind: VersionLocalizationKind,
	localizationId: string,
): Promise<VersionLocalization> {
	const path = `${CONFIG[kind].resourcePath}/${localizationId}`;
	if (kind === "iap") {
		const response =
			await client.get<InAppPurchaseVersionLocalizationResponse>(path);
		return response.data;
	}
	if (kind === "subscription") {
		const response =
			await client.get<SubscriptionVersionLocalizationResponse>(path);
		return response.data;
	}
	const response =
		await client.get<SubscriptionGroupVersionLocalizationResponse>(path);
	return response.data;
}

export async function updateVersionLocalization(
	client: Client,
	kind: VersionLocalizationKind,
	localizationId: string,
	attributes: Record<string, string>,
): Promise<VersionLocalization> {
	const config = CONFIG[kind];
	const body = {
		data: {
			type: config.resourceType,
			id: localizationId,
			attributes,
		},
	};

	if (kind === "iap") {
		const response =
			await client.patch<InAppPurchaseVersionLocalizationResponse>(
				`${config.resourcePath}/${localizationId}`,
				body,
			);
		return response.data;
	}
	if (kind === "subscription") {
		const response =
			await client.patch<SubscriptionVersionLocalizationResponse>(
				`${config.resourcePath}/${localizationId}`,
				body,
			);
		return response.data;
	}
	const response =
		await client.patch<SubscriptionGroupVersionLocalizationResponse>(
			`${config.resourcePath}/${localizationId}`,
			body,
		);
	return response.data;
}

export async function deleteVersionLocalization(
	client: Client,
	kind: VersionLocalizationKind,
	localizationId: string,
): Promise<void> {
	await client.delete(`${CONFIG[kind].resourcePath}/${localizationId}`);
}
