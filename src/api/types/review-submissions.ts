import type {
	JSONAPICollectionResponse,
	JSONAPIResource,
	JSONAPIResponse,
	ResourceIdentifier,
} from "./base";
import type { AppStorePlatform } from "./commerce-versions";

export type ReviewSubmissionState =
	| "READY_FOR_REVIEW"
	| "WAITING_FOR_REVIEW"
	| "IN_REVIEW"
	| "UNRESOLVED_ISSUES"
	| "CANCELING"
	| "COMPLETING"
	| "COMPLETE";

export interface ReviewSubmissionAttributes {
	platform?: AppStorePlatform;
	submittedDate?: string;
	state?: ReviewSubmissionState;
}

export interface ReviewSubmissionRelationships {
	app?: { data?: ResourceIdentifier };
	items?: {
		data?: ResourceIdentifier[];
		links?: { related?: string; self?: string };
	};
}

export type ReviewSubmission = JSONAPIResource<
	"reviewSubmissions",
	ReviewSubmissionAttributes,
	ReviewSubmissionRelationships
>;
export type ReviewSubmissionResponse = JSONAPIResponse<ReviewSubmission>;
export type ReviewSubmissionsResponse =
	JSONAPICollectionResponse<ReviewSubmission>;

export interface ReviewSubmissionItemRelationships {
	reviewSubmission?: { data?: ResourceIdentifier };
	appStoreVersion?: { data?: ResourceIdentifier };
	inAppPurchaseVersion?: { data?: ResourceIdentifier };
	subscriptionVersion?: { data?: ResourceIdentifier };
	subscriptionGroupVersion?: { data?: ResourceIdentifier };
}

export type ReviewSubmissionItemState =
	| "READY_FOR_REVIEW"
	| "ACCEPTED"
	| "APPROVED"
	| "REJECTED"
	| "REMOVED";

export interface ReviewSubmissionItemAttributes {
	state?: ReviewSubmissionItemState;
	resolved?: boolean;
	removed?: boolean;
}

export type ReviewSubmissionItem = JSONAPIResource<
	"reviewSubmissionItems",
	ReviewSubmissionItemAttributes,
	ReviewSubmissionItemRelationships
>;
export type ReviewSubmissionItemResponse =
	JSONAPIResponse<ReviewSubmissionItem>;
export type ReviewSubmissionItemsResponse =
	JSONAPICollectionResponse<ReviewSubmissionItem>;

export type ReviewSubmissionItemTarget =
	| { relationship: "appStoreVersion"; type: "appStoreVersions"; id: string }
	| {
			relationship: "inAppPurchaseVersion";
			type: "inAppPurchaseVersions";
			id: string;
	  }
	| {
			relationship: "subscriptionVersion";
			type: "subscriptionVersions";
			id: string;
	  }
	| {
			relationship: "subscriptionGroupVersion";
			type: "subscriptionGroupVersions";
			id: string;
	  };
