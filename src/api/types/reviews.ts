/**
 * Customer Reviews API types
 * https://developer.apple.com/documentation/appstoreconnectapi/customer_reviews
 */

import type { ListResponse, Resource, SingleResponse } from "./base";

/**
 * Customer review attributes
 */
export interface CustomerReviewAttributes {
	rating: number; // 1-5
	title?: string;
	body?: string;
	reviewerNickname?: string;
	createdDate: string;
	territory: string;
}

/**
 * Customer review relationships
 */
export interface CustomerReviewRelationships {
	response?: {
		data?: { type: "customerReviewResponses"; id: string } | null;
		links?: { self?: string; related?: string };
	};
}

/**
 * Customer review resource
 */
export type CustomerReview = Resource<CustomerReviewAttributes> & {
	type: "customerReviews";
	relationships?: CustomerReviewRelationships;
};

/**
 * Customer reviews response (list)
 */
export interface CustomerReviewsResponse {
	data: CustomerReview[];
	included?: Resource<unknown>[];
	links?: {
		self?: string;
		first?: string;
		next?: string;
	};
	meta?: {
		paging?: {
			total?: number;
			limit?: number;
		};
	};
}

/**
 * Customer review response (single)
 */
export interface CustomerReviewResponse {
	data: CustomerReview;
	included?: Resource<unknown>[];
}

/**
 * Customer review response attributes
 */
export interface CustomerReviewResponseAttributes {
	responseBody: string;
	lastModifiedDate: string;
	state: "PENDING_PUBLISH" | "PUBLISHED";
}

/**
 * Customer review response resource
 */
export type CustomerReviewResponseResource =
	Resource<CustomerReviewResponseAttributes> & {
		type: "customerReviewResponses";
	};

/**
 * Response for creating/getting review responses
 */
export interface CustomerReviewResponseResponse {
	data: CustomerReviewResponseResource;
}
