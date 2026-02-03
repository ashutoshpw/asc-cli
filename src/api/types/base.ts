/**
 * Base types for JSON:API responses from App Store Connect
 */

/**
 * JSON:API resource object
 */
export interface Resource<T> {
	type: string;
	id: string;
	attributes?: T;
	relationships?: Record<string, Relationship>;
	links?: ResourceLinks;
}

/**
 * JSON:API relationship
 */
export interface Relationship {
	data?: ResourceIdentifier | ResourceIdentifier[] | null;
	links?: RelationshipLinks;
	meta?: Record<string, unknown>;
}

/**
 * Resource identifier (type + id only)
 */
export interface ResourceIdentifier {
	type: string;
	id: string;
}

/**
 * Links for a resource
 */
export interface ResourceLinks {
	self?: string;
}

/**
 * Links for a relationship
 */
export interface RelationshipLinks {
	self?: string;
	related?: string;
}

/**
 * Pagination links
 */
export interface PagedLinks {
	self?: string;
	first?: string;
	next?: string;
}

/**
 * Pagination metadata
 */
export interface PagedMeta {
	paging?: {
		total?: number;
		limit?: number;
	};
}

/**
 * List response (multiple resources)
 */
export interface ListResponse<T> {
	data: Resource<T>[];
	included?: Resource<unknown>[];
	links?: PagedLinks;
	meta?: PagedMeta;
}

/**
 * Single resource response
 */
export interface SingleResponse<T> {
	data: Resource<T>;
	included?: Resource<unknown>[];
	links?: ResourceLinks;
}

/**
 * Error response from API
 */
export interface ErrorResponse {
	errors: APIError[];
}

/**
 * Individual API error
 */
export interface APIError {
	id?: string;
	status: string;
	code: string;
	title: string;
	detail?: string;
	source?: {
		pointer?: string;
		parameter?: string;
	};
}

/**
 * Request body for creating/updating resources
 */
export interface CreateRequest<T> {
	data: {
		type: string;
		attributes?: T;
		relationships?: Record<
			string,
			{ data: ResourceIdentifier | ResourceIdentifier[] }
		>;
	};
}

/**
 * Request body for updating resources
 */
export interface UpdateRequest<T> {
	data: {
		type: string;
		id: string;
		attributes?: Partial<T>;
		relationships?: Record<
			string,
			{ data: ResourceIdentifier | ResourceIdentifier[] | null }
		>;
	};
}
