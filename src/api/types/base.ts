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
 * Typed JSON:API resource object used by the newer endpoint definitions.
 *
 * Resource<T> is retained for compatibility with the original endpoint
 * types, while this form models Apple's resource type and relationships.
 */
export interface JSONAPIResource<
	TType extends string = string,
	TAttributes = unknown,
	TRelationships = Record<string, Relationship>,
> {
	type: TType;
	id: string;
	attributes: TAttributes;
	relationships?: TRelationships;
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
 * JSON:API response containing one typed resource.
 */
export interface JSONAPIResponse<TResource = JSONAPIResource> {
	data: TResource;
	included?: JSONAPIResource[];
	links?: ResourceLinks;
}

/**
 * JSON:API response containing multiple typed resources.
 */
export interface JSONAPICollectionResponse<TResource = JSONAPIResource> {
	data: TResource[];
	included?: JSONAPIResource[];
	links?: PagedLinks;
	meta?: PagedMeta;
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
