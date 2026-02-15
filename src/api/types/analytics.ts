/**
 * Analytics and Sales Report types
 */

export type SalesReportType =
	| "SALES"
	| "PRE_ORDER"
	| "NEWSSTAND"
	| "SUBSCRIPTION"
	| "SUBSCRIPTION_EVENT";

export type SalesReportSubType = "SUMMARY" | "DETAILED";

export type SalesReportFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type SalesReportVersion = "1_0" | "1_1";

export type AnalyticsAccessType = "ONGOING" | "ONE_TIME_SNAPSHOT";

export type AnalyticsReportRequestState = "PROCESSING" | "COMPLETED" | "FAILED";

export interface SalesReportParams {
	vendorNumber: string;
	reportType: SalesReportType;
	reportSubType: SalesReportSubType;
	frequency: SalesReportFrequency;
	reportDate: string;
	version: SalesReportVersion;
}

export interface SalesReportResult {
	vendorNumber: string;
	reportType: string;
	reportSubType: string;
	frequency: string;
	reportDate: string;
	version: string;
	filePath: string;
	fileSize: number;
	decompressed: boolean;
	decompressedPath?: string;
	decompressedSize?: number;
}

// Analytics Report Request types
export interface AnalyticsReportRequestAttributes {
	accessType?: AnalyticsAccessType;
	state?: AnalyticsReportRequestState;
	createdDate?: string;
	stoppedDueToInactivity?: boolean;
}

export interface AnalyticsReportRequest {
	type: "analyticsReportRequests";
	id: string;
	attributes: AnalyticsReportRequestAttributes;
	relationships?: {
		app?: {
			data?: { type: string; id: string };
			links?: { self: string; related: string };
		};
		reports?: {
			links?: { self: string; related: string };
		};
	};
}

export interface AnalyticsReportRequestResponse {
	data: AnalyticsReportRequest;
	links?: { self: string };
}

export interface AnalyticsReportRequestsResponse {
	data: AnalyticsReportRequest[];
	links?: {
		self: string;
		next?: string;
	};
	meta?: {
		paging: {
			total: number;
			limit: number;
		};
	};
}

// Analytics Report types
export interface AnalyticsReportAttributes {
	name?: string;
	reportType?: string;
	category?: string;
	subCategory?: string;
	granularity?: string;
}

export interface AnalyticsReport {
	type: "analyticsReports";
	id: string;
	attributes: AnalyticsReportAttributes;
	relationships?: {
		instances?: {
			links?: { self: string; related: string };
		};
	};
}

export interface AnalyticsReportsResponse {
	data: AnalyticsReport[];
	links?: {
		self: string;
		next?: string;
	};
}

// Analytics Report Instance types
export interface AnalyticsReportInstanceAttributes {
	reportDate?: string;
	processingDate?: string;
	granularity?: string;
	version?: string;
}

export interface AnalyticsReportInstance {
	type: "analyticsReportInstances";
	id: string;
	attributes: AnalyticsReportInstanceAttributes;
	relationships?: {
		segments?: {
			links?: { self: string; related: string };
		};
	};
}

export interface AnalyticsReportInstancesResponse {
	data: AnalyticsReportInstance[];
	links?: {
		self: string;
		next?: string;
	};
}

// Analytics Report Segment types
export interface AnalyticsReportSegmentAttributes {
	url?: string;
	checksum?: string;
	sizeInBytes?: number;
	urlExpirationDate?: string;
}

export interface AnalyticsReportSegment {
	type: "analyticsReportSegments";
	id: string;
	attributes: AnalyticsReportSegmentAttributes;
}

export interface AnalyticsReportSegmentsResponse {
	data: AnalyticsReportSegment[];
	links?: {
		self: string;
		next?: string;
	};
}

// Parsed sales data
export interface SalesReportRow {
	provider?: string;
	providerCountry?: string;
	sku?: string;
	developer?: string;
	title?: string;
	version?: string;
	productTypeIdentifier?: string;
	units?: number;
	developerProceeds?: number;
	beginDate?: string;
	endDate?: string;
	customerCurrency?: string;
	countryCode?: string;
	currencyOfProceeds?: string;
	appleIdentifier?: string;
	customerPrice?: number;
	promoCode?: string;
	parentIdentifier?: string;
	subscription?: string;
	period?: string;
	category?: string;
	cmb?: string;
	device?: string;
	supportedPlatforms?: string;
	proceedsReason?: string;
	preservedPricing?: string;
	client?: string;
	orderType?: string;
	[key: string]: string | number | undefined;
}
