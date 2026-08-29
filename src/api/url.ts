const APPLE_HOSTS = new Set([
	"api.appstoreconnect.apple.com",
	"is1-ssl.mzstatic.com",
	"is2-ssl.mzstatic.com",
	"is3-ssl.mzstatic.com",
	"is4-ssl.mzstatic.com",
	"is5-ssl.mzstatic.com",
]);

export function isAppleHostedUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:") {
			return false;
		}

		return (
			APPLE_HOSTS.has(parsed.hostname) ||
			parsed.hostname.endsWith(".apple.com") ||
			parsed.hostname.endsWith(".mzstatic.com")
		);
	} catch {
		return false;
	}
}

/**
 * Signed upload URLs are returned by App Store Connect and may use a
 * dedicated Apple delivery host. They are never sent JWT credentials, so the
 * client only permits HTTPS here and does not expose this as a general URL
 * request primitive.
 */
export function isSecureUploadUrl(url: string): boolean {
	try {
		return new URL(url).protocol === "https:";
	} catch {
		return false;
	}
}
