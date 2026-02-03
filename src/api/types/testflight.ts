/**
 * TestFlight API types
 */
import type {
	JSONAPICollectionResponse,
	JSONAPIResource,
	JSONAPIResponse,
} from "./base";

// Beta Group types
export interface BetaGroupAttributes {
	name: string;
	createdDate: string;
	isInternalGroup: boolean;
	hasAccessToAllBuilds: boolean;
	publicLinkEnabled: boolean;
	publicLinkId: string | null;
	publicLinkLimitEnabled: boolean;
	publicLinkLimit: number | null;
	publicLink: string | null;
	feedbackEnabled: boolean;
	iosBuildsAvailableForAppleSiliconMac: boolean;
}

export interface BetaGroupRelationships {
	app: {
		data: { type: "apps"; id: string };
	};
	builds: {
		data: { type: "builds"; id: string }[];
	};
	betaTesters: {
		data: { type: "betaTesters"; id: string }[];
	};
}

export type BetaGroup = JSONAPIResource<
	"betaGroups",
	BetaGroupAttributes,
	BetaGroupRelationships
>;
export type BetaGroupResponse = JSONAPIResponse<BetaGroup>;
export type BetaGroupsResponse = JSONAPICollectionResponse<BetaGroup>;

// Beta Tester types
export interface BetaTesterAttributes {
	firstName: string | null;
	lastName: string | null;
	email: string;
	inviteType: "EMAIL" | "PUBLIC_LINK";
	state: "NOT_INVITED" | "INVITED" | "ACCEPTED" | "INSTALLED";
}

export interface BetaTesterRelationships {
	apps: {
		data: { type: "apps"; id: string }[];
	};
	betaGroups: {
		data: { type: "betaGroups"; id: string }[];
	};
	builds: {
		data: { type: "builds"; id: string }[];
	};
}

export type BetaTester = JSONAPIResource<
	"betaTesters",
	BetaTesterAttributes,
	BetaTesterRelationships
>;
export type BetaTesterResponse = JSONAPIResponse<BetaTester>;
export type BetaTestersResponse = JSONAPICollectionResponse<BetaTester>;

// Beta App Localization types
export interface BetaAppLocalizationAttributes {
	locale: string;
	description: string | null;
	feedbackEmail: string | null;
	marketingUrl: string | null;
	privacyPolicyUrl: string | null;
	tvOsPrivacyPolicy: string | null;
}

export type BetaAppLocalization = JSONAPIResource<
	"betaAppLocalizations",
	BetaAppLocalizationAttributes
>;
export type BetaAppLocalizationResponse = JSONAPIResponse<BetaAppLocalization>;
export type BetaAppLocalizationsResponse =
	JSONAPICollectionResponse<BetaAppLocalization>;

// Beta Build Localization types
export interface BetaBuildLocalizationAttributes {
	locale: string;
	whatsNew: string | null;
}

export type BetaBuildLocalization = JSONAPIResource<
	"betaBuildLocalizations",
	BetaBuildLocalizationAttributes
>;
export type BetaBuildLocalizationResponse =
	JSONAPIResponse<BetaBuildLocalization>;
export type BetaBuildLocalizationsResponse =
	JSONAPICollectionResponse<BetaBuildLocalization>;

// Beta App Review Detail types
export interface BetaAppReviewDetailAttributes {
	contactFirstName: string | null;
	contactLastName: string | null;
	contactPhone: string | null;
	contactEmail: string | null;
	demoAccountName: string | null;
	demoAccountPassword: string | null;
	demoAccountRequired: boolean;
	notes: string | null;
}

export type BetaAppReviewDetail = JSONAPIResource<
	"betaAppReviewDetails",
	BetaAppReviewDetailAttributes
>;
export type BetaAppReviewDetailResponse = JSONAPIResponse<BetaAppReviewDetail>;
