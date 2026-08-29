import { AppStoreConnectError } from "./client-types";
import type {
	AnalyticsReportInstancesResponse,
	AnalyticsReportRequestResponse,
	AnalyticsReportRequestsResponse,
	AnalyticsReportSegmentsResponse,
	AnalyticsReportsResponse,
} from "./types/analytics";
import { isAppleHostedUrl } from "./url";

interface AnalyticsTransport {
	get<T>(path: string): Promise<T>;
	post<T>(path: string, body?: unknown): Promise<T>;
}

export function createAnalyticsReportRequest(
	client: AnalyticsTransport,
	appId: string,
	accessType: "ONGOING" | "ONE_TIME_SNAPSHOT",
): Promise<AnalyticsReportRequestResponse> {
	const body = {
		data: {
			type: "analyticsReportRequests",
			attributes: { accessType },
			relationships: {
				app: { data: { type: "apps", id: appId } },
			},
		},
	};

	return client.post<AnalyticsReportRequestResponse>(
		"/v1/analyticsReportRequests",
		body,
	);
}

export function getAnalyticsReportRequests(
	client: AnalyticsTransport,
	appId: string,
): Promise<AnalyticsReportRequestsResponse> {
	return client.get<AnalyticsReportRequestsResponse>(
		`/v1/apps/${appId}/analyticsReportRequests`,
	);
}

export function getAnalyticsReportRequest(
	client: AnalyticsTransport,
	requestId: string,
): Promise<AnalyticsReportRequestResponse> {
	return client.get<AnalyticsReportRequestResponse>(
		`/v1/analyticsReportRequests/${requestId}`,
	);
}

export function getAnalyticsReports(
	client: AnalyticsTransport,
	requestId: string,
): Promise<AnalyticsReportsResponse> {
	return client.get<AnalyticsReportsResponse>(
		`/v1/analyticsReportRequests/${requestId}/reports`,
	);
}

export function getAnalyticsReportInstances(
	client: AnalyticsTransport,
	reportId: string,
): Promise<AnalyticsReportInstancesResponse> {
	return client.get<AnalyticsReportInstancesResponse>(
		`/v1/analyticsReports/${reportId}/instances`,
	);
}

export function getAnalyticsReportSegments(
	client: AnalyticsTransport,
	instanceId: string,
): Promise<AnalyticsReportSegmentsResponse> {
	return client.get<AnalyticsReportSegmentsResponse>(
		`/v1/analyticsReportInstances/${instanceId}/segments`,
	);
}

export async function downloadAnalyticsReport(
	fetchImpl: typeof fetch,
	downloadUrl: string,
): Promise<ReadableStream> {
	if (!isAppleHostedUrl(downloadUrl)) {
		throw new AppStoreConnectError(400, [
			{
				status: "400",
				code: "INVALID_URL",
				title: "Invalid download URL",
			},
		]);
	}

	const response = await fetchImpl(downloadUrl);
	if (!response.ok) {
		throw new AppStoreConnectError(response.status, [
			{
				status: String(response.status),
				code: "DOWNLOAD_ERROR",
				title: `Failed to download report: ${response.statusText}`,
			},
		]);
	}

	if (!response.body) {
		throw new AppStoreConnectError(500, [
			{
				status: "500",
				code: "NO_RESPONSE_BODY",
				title: "No response body received",
			},
		]);
	}

	return response.body;
}
