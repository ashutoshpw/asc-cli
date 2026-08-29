import type {
	JSONAPICollectionResponse,
	JSONAPIResource,
	JSONAPIResponse,
	ResourceIdentifier,
} from "./base";

export type AppStorePlatform = "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS";

export type CommerceVersionState =
	| "PREPARE_FOR_SUBMISSION"
	| "READY_FOR_REVIEW"
	| "WAITING_FOR_REVIEW"
	| "IN_REVIEW"
	| "ACCEPTED"
	| "APPROVED"
	| "REPLACED_WITH_NEW_VERSION"
	| "REJECTED"
	| "DEVELOPER_REJECTED";

export const EDITABLE_COMMERCE_VERSION_STATES: CommerceVersionState[] = [
	"PREPARE_FOR_SUBMISSION",
	"READY_FOR_REVIEW",
];

export interface CommerceVersionAttributes {
	version?: number;
	state?: CommerceVersionState;
}

export interface InAppPurchaseVersionRelationships {
	inAppPurchase?: { data?: ResourceIdentifier };
	localizations?: {
		data?: ResourceIdentifier[];
		links?: { related?: string; self?: string };
	};
	images?: {
		data?: ResourceIdentifier[];
		links?: { related?: string; self?: string };
	};
}

export type InAppPurchaseVersion = JSONAPIResource<
	"inAppPurchaseVersions",
	CommerceVersionAttributes,
	InAppPurchaseVersionRelationships
>;
export type InAppPurchaseVersionResponse =
	JSONAPIResponse<InAppPurchaseVersion>;
export type InAppPurchaseVersionsResponse =
	JSONAPICollectionResponse<InAppPurchaseVersion>;

export interface SubscriptionVersionRelationships {
	subscription?: { data?: ResourceIdentifier };
	localizations?: {
		data?: ResourceIdentifier[];
		links?: { related?: string; self?: string };
	};
	images?: {
		data?: ResourceIdentifier[];
		links?: { related?: string; self?: string };
	};
}

export type SubscriptionVersion = JSONAPIResource<
	"subscriptionVersions",
	CommerceVersionAttributes,
	SubscriptionVersionRelationships
>;
export type SubscriptionVersionResponse = JSONAPIResponse<SubscriptionVersion>;
export type SubscriptionVersionsResponse =
	JSONAPICollectionResponse<SubscriptionVersion>;

export interface SubscriptionGroupVersionRelationships {
	subscriptionGroup?: { data?: ResourceIdentifier };
	localizations?: {
		data?: ResourceIdentifier[];
		links?: { related?: string; self?: string };
	};
}

export type SubscriptionGroupVersion = JSONAPIResource<
	"subscriptionGroupVersions",
	CommerceVersionAttributes,
	SubscriptionGroupVersionRelationships
>;
export type SubscriptionGroupVersionResponse =
	JSONAPIResponse<SubscriptionGroupVersion>;
export type SubscriptionGroupVersionsResponse =
	JSONAPICollectionResponse<SubscriptionGroupVersion>;

export interface VersionLocalizationAttributes {
	name: string;
	locale: string;
	description?: string;
	state?: string;
}

export interface VersionLocalizationRelationships {
	version?: { data?: ResourceIdentifier };
}

export type InAppPurchaseVersionLocalization = JSONAPIResource<
	"inAppPurchaseLocalizations",
	VersionLocalizationAttributes,
	VersionLocalizationRelationships
>;
export type InAppPurchaseVersionLocalizationResponse =
	JSONAPIResponse<InAppPurchaseVersionLocalization>;
export type InAppPurchaseVersionLocalizationsResponse =
	JSONAPICollectionResponse<InAppPurchaseVersionLocalization>;

export type SubscriptionVersionLocalization = JSONAPIResource<
	"subscriptionLocalizations",
	VersionLocalizationAttributes,
	VersionLocalizationRelationships
>;
export type SubscriptionVersionLocalizationResponse =
	JSONAPIResponse<SubscriptionVersionLocalization>;
export type SubscriptionVersionLocalizationsResponse =
	JSONAPICollectionResponse<SubscriptionVersionLocalization>;

export interface SubscriptionGroupLocalizationAttributes
	extends VersionLocalizationAttributes {
	customAppName?: string;
}

export type SubscriptionGroupVersionLocalization = JSONAPIResource<
	"subscriptionGroupLocalizations",
	SubscriptionGroupLocalizationAttributes,
	VersionLocalizationRelationships
>;
export type SubscriptionGroupVersionLocalizationResponse =
	JSONAPIResponse<SubscriptionGroupVersionLocalization>;
export type SubscriptionGroupVersionLocalizationsResponse =
	JSONAPICollectionResponse<SubscriptionGroupVersionLocalization>;

export type SubscriptionPlanType = "MONTHLY" | "UPFRONT";

export interface SubscriptionPlanAvailabilityAttributes {
	availableInNewTerritories?: boolean;
	planType?: SubscriptionPlanType;
}

export interface SubscriptionPlanAvailabilityRelationships {
	subscription?: { data?: ResourceIdentifier };
	availableTerritories?: {
		data?: ResourceIdentifier[];
		links?: { related?: string; self?: string };
	};
}

export type SubscriptionPlanAvailability = JSONAPIResource<
	"subscriptionPlanAvailabilities",
	SubscriptionPlanAvailabilityAttributes,
	SubscriptionPlanAvailabilityRelationships
>;
export type SubscriptionPlanAvailabilityResponse =
	JSONAPIResponse<SubscriptionPlanAvailability>;
export type SubscriptionPlanAvailabilitiesResponse =
	JSONAPICollectionResponse<SubscriptionPlanAvailability>;
