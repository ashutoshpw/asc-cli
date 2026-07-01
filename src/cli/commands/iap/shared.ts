import { printError } from "../../../output/formatter";
import type { CommandContext } from "../../router";

export const IAP_TYPES = [
	"CONSUMABLE",
	"NON_CONSUMABLE",
	"NON_RENEWING_SUBSCRIPTION",
];

export function getAppId(ctx: CommandContext): string {
	const appId = (ctx.args.options.app as string) || process.env.ASC_APP_ID;
	if (!appId) {
		printError("--app is required (or set ASC_APP_ID)");
		process.exit(1);
	}
	return appId;
}
