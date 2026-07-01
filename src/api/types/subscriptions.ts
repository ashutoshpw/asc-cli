/**
 * Subscription types for App Store Connect API
 */

// Subscription periods
export type SubscriptionPeriod =
	| "ONE_WEEK"
	| "ONE_MONTH"
	| "TWO_MONTHS"
	| "THREE_MONTHS"
	| "SIX_MONTHS"
	| "ONE_YEAR";

export const SUBSCRIPTION_PERIODS: SubscriptionPeriod[] = [
	"ONE_WEEK",
	"ONE_MONTH",
	"TWO_MONTHS",
	"THREE_MONTHS",
	"SIX_MONTHS",
	"ONE_YEAR",
];

// Subscription states
export type SubscriptionState =
	| "MISSING_METADATA"
	| "READY_TO_SUBMIT"
	| "WAITING_FOR_REVIEW"
	| "IN_REVIEW"
	| "DEVELOPER_ACTION_NEEDED"
	| "PENDING_BINARY_APPROVAL"
	| "APPROVED"
	| "DEVELOPER_REMOVED_FROM_SALE"
	| "REMOVED_FROM_SALE"
	| "REJECTED";

export const SUBSCRIPTION_STATES: SubscriptionState[] = [
	"MISSING_METADATA",
	"READY_TO_SUBMIT",
	"WAITING_FOR_REVIEW",
	"IN_REVIEW",
	"DEVELOPER_ACTION_NEEDED",
	"PENDING_BINARY_APPROVAL",
	"APPROVED",
	"DEVELOPER_REMOVED_FROM_SALE",
	"REMOVED_FROM_SALE",
	"REJECTED",
];

// Offer durations
export type SubscriptionOfferDuration =
	| "THREE_DAYS"
	| "ONE_WEEK"
	| "TWO_WEEKS"
	| "ONE_MONTH"
	| "TWO_MONTHS"
	| "THREE_MONTHS"
	| "SIX_MONTHS"
	| "ONE_YEAR";

export const SUBSCRIPTION_OFFER_DURATIONS: SubscriptionOfferDuration[] = [
	"THREE_DAYS",
	"ONE_WEEK",
	"TWO_WEEKS",
	"ONE_MONTH",
	"TWO_MONTHS",
	"THREE_MONTHS",
	"SIX_MONTHS",
	"ONE_YEAR",
];

// Offer modes
export type SubscriptionOfferMode =
	| "PAY_AS_YOU_GO"
	| "PAY_UP_FRONT"
	| "FREE_TRIAL";

export const SUBSCRIPTION_OFFER_MODES: SubscriptionOfferMode[] = [
	"PAY_AS_YOU_GO",
	"PAY_UP_FRONT",
	"FREE_TRIAL",
];

// Customer eligibility
export type SubscriptionCustomerEligibility = "NEW" | "EXISTING" | "EXPIRED";

export const SUBSCRIPTION_CUSTOMER_ELIGIBILITIES: SubscriptionCustomerEligibility[] =
	["NEW", "EXISTING", "EXPIRED"];

// Grace period durations
export type SubscriptionGracePeriodDuration =
	| "THREE_DAYS"
	| "SIXTEEN_DAYS"
	| "TWENTY_EIGHT_DAYS";

// Grace period renewal types
export type SubscriptionGracePeriodRenewalType =
	| "ALL_RENEWALS"
	| "PAID_TO_PAID_ONLY";

// Subscription Group
export interface SubscriptionGroup {
	type: "subscriptionGroups";
	id: string;
	attributes: {
		referenceName: string;
	};
	relationships?: {
		subscriptions?: {
			data?: Array<{ type: "subscriptions"; id: string }>;
			links?: { related?: string; self?: string };
		};
		subscriptionGroupLocalizations?: {
			data?: Array<{ type: "subscriptionGroupLocalizations"; id: string }>;
			links?: { related?: string; self?: string };
		};
	};
	links?: { self?: string };
}

export interface SubscriptionGroupResponse {
	data: SubscriptionGroup;
	links: { self: string };
	included?: unknown[];
}

export interface SubscriptionGroupsResponse {
	data: SubscriptionGroup[];
	links: { self: string; next?: string };
	meta?: { paging?: { total?: number; limit?: number } };
	included?: unknown[];
}

// Subscription
export interface Subscription {
	type: "subscriptions";
	id: string;
	attributes: {
		name: string;
		productId: string;
		familySharable?: boolean;
		subscriptionPeriod?: SubscriptionPeriod;
		reviewNote?: string;
		groupLevel?: number;
		state?: SubscriptionState;
	};
	relationships?: {
		subscriptionGroup?: {
			data?: { type: "subscriptionGroups"; id: string };
			links?: { related?: string; self?: string };
		};
		subscriptionLocalizations?: {
			data?: Array<{ type: "subscriptionLocalizations"; id: string }>;
			links?: { related?: string; self?: string };
		};
		introductoryOffers?: {
			data?: Array<{ type: "subscriptionIntroductoryOffers"; id: string }>;
			links?: { related?: string; self?: string };
		};
		promotionalOffers?: {
			data?: Array<{ type: "subscriptionPromotionalOffers"; id: string }>;
			links?: { related?: string; self?: string };
		};
		prices?: {
			data?: Array<{ type: "subscriptionPrices"; id: string }>;
			links?: { related?: string; self?: string };
		};
	};
	links?: { self?: string };
}

export interface SubscriptionResponse {
	data: Subscription;
	links: { self: string };
	included?: unknown[];
}

export interface SubscriptionsResponse {
	data: Subscription[];
	links: { self: string; next?: string };
	meta?: { paging?: { total?: number; limit?: number } };
	included?: unknown[];
}

// Subscription Price
export interface SubscriptionPrice {
	type: "subscriptionPrices";
	id: string;
	attributes: {
		startDate?: string;
		preserved?: boolean;
	};
	relationships?: {
		subscription?: {
			data?: { type: "subscriptions"; id: string };
		};
		subscriptionPricePoint?: {
			data?: { type: "subscriptionPricePoints"; id: string };
		};
		territory?: {
			data?: { type: "territories"; id: string };
		};
	};
	links?: { self?: string };
}

export interface SubscriptionPriceResponse {
	data: SubscriptionPrice;
	links: { self: string };
	included?: unknown[];
}

export interface SubscriptionPricesResponse {
	data: SubscriptionPrice[];
	links: { self: string; next?: string };
	meta?: { paging?: { total?: number; limit?: number } };
	included?: unknown[];
}

// Subscription Price Point
export interface SubscriptionPricePoint {
	type: "subscriptionPricePoints";
	id: string;
	attributes: {
		customerPrice?: string;
		proceeds?: string;
		proceedsYear2?: string;
	};
	relationships?: {
		territory?: {
			data?: { type: "territories"; id: string };
		};
	};
	links?: { self?: string };
}

export interface SubscriptionPricePointsResponse {
	data: SubscriptionPricePoint[];
	links: { self: string; next?: string };
	meta?: { paging?: { total?: number; limit?: number } };
	included?: unknown[];
}

// Subscription Localization
export interface SubscriptionLocalization {
	type: "subscriptionLocalizations";
	id: string;
	attributes: {
		name: string;
		locale: string;
		description?: string;
		state?: string;
	};
	relationships?: {
		subscription?: {
			data?: { type: "subscriptions"; id: string };
		};
	};
	links?: { self?: string };
}

export interface SubscriptionLocalizationResponse {
	data: SubscriptionLocalization;
	links: { self: string };
	included?: unknown[];
}

export interface SubscriptionLocalizationsResponse {
	data: SubscriptionLocalization[];
	links: { self: string; next?: string };
	meta?: { paging?: { total?: number; limit?: number } };
	included?: unknown[];
}

// Subscription Group Localization
export interface SubscriptionGroupLocalization {
	type: "subscriptionGroupLocalizations";
	id: string;
	attributes: {
		name: string;
		locale: string;
		customAppName?: string;
		state?: string;
	};
	relationships?: {
		subscriptionGroup?: {
			data?: { type: "subscriptionGroups"; id: string };
		};
	};
	links?: { self?: string };
}

export interface SubscriptionGroupLocalizationResponse {
	data: SubscriptionGroupLocalization;
	links: { self: string };
	included?: unknown[];
}

export interface SubscriptionGroupLocalizationsResponse {
	data: SubscriptionGroupLocalization[];
	links: { self: string; next?: string };
	meta?: { paging?: { total?: number; limit?: number } };
	included?: unknown[];
}

// Subscription Availability
export interface SubscriptionAvailability {
	type: "subscriptionAvailabilities";
	id: string;
	attributes: {
		availableInNewTerritories?: boolean;
	};
	relationships?: {
		subscription?: {
			data?: { type: "subscriptions"; id: string };
		};
		availableTerritories?: {
			data?: Array<{ type: "territories"; id: string }>;
			links?: { related?: string; self?: string };
		};
	};
	links?: { self?: string };
}

export interface SubscriptionAvailabilityResponse {
	data: SubscriptionAvailability;
	links: { self: string };
	included?: unknown[];
}

// Territory
export interface Territory {
	type: "territories";
	id: string;
	attributes: {
		currency?: string;
	};
	links?: { self?: string };
}

export interface TerritoriesResponse {
	data: Territory[];
	links: { self: string; next?: string };
	meta?: { paging?: { total?: number; limit?: number } };
	included?: unknown[];
}

// Introductory Offer
export interface SubscriptionIntroductoryOffer {
	type: "subscriptionIntroductoryOffers";
	id: string;
	attributes: {
		startDate?: string;
		endDate?: string;
		duration?: SubscriptionOfferDuration;
		offerMode?: SubscriptionOfferMode;
		numberOfPeriods?: number;
	};
	relationships?: {
		subscription?: {
			data?: { type: "subscriptions"; id: string };
		};
		subscriptionPricePoint?: {
			data?: { type: "subscriptionPricePoints"; id: string };
		};
		territory?: {
			data?: { type: "territories"; id: string };
		};
	};
	links?: { self?: string };
}

export interface SubscriptionIntroductoryOfferResponse {
	data: SubscriptionIntroductoryOffer;
	links: { self: string };
	included?: unknown[];
}

export interface SubscriptionIntroductoryOffersResponse {
	data: SubscriptionIntroductoryOffer[];
	links: { self: string; next?: string };
	meta?: { paging?: { total?: number; limit?: number } };
	included?: unknown[];
}

// Promotional Offer
export interface SubscriptionPromotionalOffer {
	type: "subscriptionPromotionalOffers";
	id: string;
	attributes: {
		name: string;
		offerCode?: string;
		duration?: SubscriptionOfferDuration;
		offerMode?: SubscriptionOfferMode;
		numberOfPeriods?: number;
	};
	relationships?: {
		subscription?: {
			data?: { type: "subscriptions"; id: string };
		};
		prices?: {
			data?: Array<{ type: "subscriptionPromotionalOfferPrices"; id: string }>;
			links?: { related?: string; self?: string };
		};
	};
	links?: { self?: string };
}

export interface SubscriptionPromotionalOfferResponse {
	data: SubscriptionPromotionalOffer;
	links: { self: string };
	included?: unknown[];
}

export interface SubscriptionPromotionalOffersResponse {
	data: SubscriptionPromotionalOffer[];
	links: { self: string; next?: string };
	meta?: { paging?: { total?: number; limit?: number } };
	included?: unknown[];
}

// Offer Code
export interface SubscriptionOfferCode {
	type: "subscriptionOfferCodes";
	id: string;
	attributes: {
		name: string;
		customerEligibilities?: SubscriptionCustomerEligibility[];
		offerEligibility?: string;
		duration?: SubscriptionOfferDuration;
		offerMode?: SubscriptionOfferMode;
		numberOfPeriods?: number;
		totalNumberOfCodes?: number;
		active?: boolean;
	};
	relationships?: {
		subscription?: {
			data?: { type: "subscriptions"; id: string };
		};
		oneTimeUseCodes?: {
			links?: { related?: string; self?: string };
		};
		customCodes?: {
			links?: { related?: string; self?: string };
		};
		prices?: {
			data?: Array<{ type: "subscriptionOfferCodePrices"; id: string }>;
			links?: { related?: string; self?: string };
		};
	};
	links?: { self?: string };
}

export interface SubscriptionOfferCodeResponse {
	data: SubscriptionOfferCode;
	links: { self: string };
	included?: unknown[];
}

export interface SubscriptionOfferCodesResponse {
	data: SubscriptionOfferCode[];
	links: { self: string; next?: string };
	meta?: { paging?: { total?: number; limit?: number } };
	included?: unknown[];
}

// Subscription Submission
export interface SubscriptionSubmission {
	type: "subscriptionSubmissions";
	id: string;
	relationships?: {
		subscription?: {
			data?: { type: "subscriptions"; id: string };
		};
	};
	links?: { self?: string };
}

export interface SubscriptionSubmissionResponse {
	data: SubscriptionSubmission;
	links: { self: string };
}

// Grace Period
export interface SubscriptionGracePeriod {
	type: "subscriptionGracePeriods";
	id: string;
	attributes: {
		optIn?: boolean;
		sandboxOptIn?: boolean;
		duration?: SubscriptionGracePeriodDuration;
		renewalType?: SubscriptionGracePeriodRenewalType;
	};
	links?: { self?: string };
}

export interface SubscriptionGracePeriodResponse {
	data: SubscriptionGracePeriod;
	links: { self: string };
}
