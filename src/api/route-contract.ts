import type { ApiRoute } from "./route-contract-types";

const CLIENT_ROUTE_PATTERN =
	/client\.(get|post|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*(?:"([^"\n]+)"|`([^`\n]+)`)/g;

export function normalizeRoutePath(path: string): string {
	return path.split("?")[0].replace(/\$\{[^}]+\}/g, "{id}");
}

export function extractRoutesFromSource(source: string): ApiRoute[] {
	const routes: ApiRoute[] = [];
	while (true) {
		const match = CLIENT_ROUTE_PATTERN.exec(source);
		if (!match) break;
		const path = match[2] ?? match[3];
		if (!path?.startsWith("/v")) continue;

		routes.push({
			method: match[1].toUpperCase() as ApiRoute["method"],
			path: normalizeRoutePath(path),
		});
	}

	CLIENT_ROUTE_PATTERN.lastIndex = 0;
	return routes;
}

export function uniqueRoutes(routes: ApiRoute[]): ApiRoute[] {
	return [
		...new Map(
			routes.map((route) => [`${route.method} ${route.path}`, route]),
		).values(),
	].sort((a, b) =>
		`${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`),
	);
}

export function routeKey(route: ApiRoute): string {
	return `${route.method} ${route.path}`;
}

export const DEPRECATED_API_ROUTES = [
	"POST /v1/inAppPurchaseLocalizations",
	"PATCH /v1/inAppPurchaseLocalizations/{id}",
	"DELETE /v1/inAppPurchaseLocalizations/{id}",
	"POST /v1/inAppPurchaseSubmissions",
	"POST /v1/subscriptionAvailabilities",
	"POST /v1/subscriptionGroupLocalizations",
	"PATCH /v1/subscriptionGroupLocalizations/{id}",
	"DELETE /v1/subscriptionGroupLocalizations/{id}",
	"POST /v1/subscriptionLocalizations",
	"PATCH /v1/subscriptionLocalizations/{id}",
	"DELETE /v1/subscriptionLocalizations/{id}",
	"POST /v1/subscriptionSubmissions",
] as const;
