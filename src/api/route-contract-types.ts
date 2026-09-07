export type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiRoute {
	method: ApiMethod;
	path: string;
}
