import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	DEPRECATED_API_ROUTES,
	extractRoutesFromSource,
	routeKey,
	uniqueRoutes,
} from "../src/api/route-contract";
import type { ApiRoute } from "../src/api/route-contract-types";

interface RouteContract {
	apiVersion: string;
	sourceUrl: string;
	sourceSha256: string;
	routes: ApiRoute[];
}

async function loadContract(): Promise<RouteContract> {
	const path = join(import.meta.dir, "..", "spec", "api-4.4.1-routes.json");
	return JSON.parse(await readFile(path, "utf8")) as RouteContract;
}

async function sourceRoutes(): Promise<ApiRoute[]> {
	const routes: ApiRoute[] = [];
	const glob = new Bun.Glob("src/**/*.ts");
	for await (const path of glob.scan(join(import.meta.dir, ".."))) {
		if (path.endsWith(".test.ts")) continue;
		routes.push(
			...extractRoutesFromSource(
				await Bun.file(join(import.meta.dir, "..", path)).text(),
			),
		);
	}
	return uniqueRoutes(routes);
}

function officialRoutes(spec: Record<string, unknown>): Set<string> {
	const paths = spec.paths as
		| Record<string, Record<string, unknown>>
		| undefined;
	const result = new Set<string>();
	for (const [path, operations] of Object.entries(paths ?? {})) {
		for (const method of ["get", "post", "patch", "delete"] as const) {
			if (operations[method]) result.add(`${method.toUpperCase()} ${path}`);
		}
	}
	return result;
}

const contract = await loadContract();
const routes = await sourceRoutes();
const allowed = new Set(contract.routes.map(routeKey));
const missing = routes.map(routeKey).filter((key) => !allowed.has(key));
const deprecated = routes
	.map(routeKey)
	.filter((key) => (DEPRECATED_API_ROUTES as readonly string[]).includes(key));

if (missing.length > 0 || deprecated.length > 0) {
	if (missing.length > 0)
		console.error(`Missing route contract entries:\n${missing.join("\n")}`);
	if (deprecated.length > 0)
		console.error(`Deprecated routes in source:\n${deprecated.join("\n")}`);
	process.exit(1);
}

const specPath = process.argv[2];
if (specPath) {
	const source = await readFile(specPath);
	const spec = JSON.parse(source.toString("utf8")) as Record<string, unknown>;
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(source);
	const sourceSha256 = hasher.digest("hex");
	if (sourceSha256 !== contract.sourceSha256) {
		console.error(
			`Pinned OpenAPI hash mismatch: expected ${contract.sourceSha256}, got ${sourceSha256}`,
		);
		process.exit(1);
	}
	const official = officialRoutes(spec);
	const fixtureMissing = contract.routes
		.map(routeKey)
		.filter((key) => !official.has(key));
	if (fixtureMissing.length > 0) {
		console.error(
			`Fixture routes missing from official OpenAPI document:\n${fixtureMissing.join("\n")}`,
		);
		process.exit(1);
	}
}

console.log(
	`Validated ${routes.length} source route references against App Store Connect API ${contract.apiVersion}`,
);
