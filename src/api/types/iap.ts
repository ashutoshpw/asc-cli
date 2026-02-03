/**
 * In-App Purchase API types
 */
import type {
	JSONAPICollectionResponse,
	JSONAPIResource,
	JSONAPIResponse,
} from "./base";

export type InAppPurchaseType =
	| "CONSUMABLE"
	| "NON_CONSUMABLE"
	| "NON_RENEWING_SUBSCRIPTION";
export type InAppPurchaseState =
	| "MISSING_METADATA"
	| "WAITING_FOR_UPLOAD"
	| "PROCESSING_CONTENT"
	| "READY_TO_SUBMIT"
	| "WAITING_FOR_REVIEW"
	| "IN_REVIEW"
	| "DEVELOPER_ACTION_NEEDED"
	| "PENDING_BINARY_APPROVAL"
	| "APPROVED"
	| "DEVELOPER_REMOVED_FROM_SALE"
	| "REMOVED_FROM_SALE"
	| "REJECTED";

export interface InAppPurchaseV2Attributes {
	name: string;
	productId: string;
	inAppPurchaseType: InAppPurchaseType;
	state: InAppPurchaseState;
	reviewNote?: string;
	familySharable?: boolean;
	contentHosting?: boolean;
}

export interface InAppPurchaseV2Relationships {
	inAppPurchaseLocalizations?: {
		data: Array<{ type: "inAppPurchaseLocalizations"; id: string }>;
		links?: { related?: string; self?: string };
	};
	pricePoints?: {
		links?: { related?: string };
	};
	content?: {
		links?: { related?: string };
	};
	appStoreReviewScreenshot?: {
		links?: { related?: string };
	};
	promotedPurchase?: {
		links?: { related?: string };
	};
	iapPriceSchedule?: {
		links?: { related?: string };
	};
}

export type InAppPurchaseV2 = JSONAPIResource<
	"inAppPurchases",
	InAppPurchaseV2Attributes,
	InAppPurchaseV2Relationships
>;
export type InAppPurchaseV2Response = JSONAPIResponse<InAppPurchaseV2>;
export type InAppPurchasesV2Response =
	JSONAPICollectionResponse<InAppPurchaseV2>;

// Localization types
export interface InAppPurchaseLocalizationAttributes {
	name: string;
	locale: string;
	description?: string;
	state?: string;
}

export type InAppPurchaseLocalization = JSONAPIResource<
	"inAppPurchaseLocalizations",
	InAppPurchaseLocalizationAttributes
>;
export type InAppPurchaseLocalizationResponse =
	JSONAPIResponse<InAppPurchaseLocalization>;
export type InAppPurchaseLocalizationsResponse =
	JSONAPICollectionResponse<InAppPurchaseLocalization>;

// Price Point types
export interface InAppPurchasePricePointAttributes {
	customerPrice: string;
	proceeds: string;
	priceTier?: string;
}

export type InAppPurchasePricePoint = JSONAPIResource<
	"inAppPurchasePricePoints",
	InAppPurchasePricePointAttributes
>;
export type InAppPurchasePricePointsResponse =
	JSONAPICollectionResponse<InAppPurchasePricePoint>;
