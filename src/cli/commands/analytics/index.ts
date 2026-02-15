import { type Command, registry } from "../../router";
import { calculateProceeds } from "./proceeds";
/**
 * Analytics commands
 * asc analytics sales/proceeds/request/requests/reports/instances/download
 */
import {
	createAnalyticsRequest,
	downloadAnalyticsReport,
	listAnalyticsInstances,
	listAnalyticsReports,
	listAnalyticsRequests,
} from "./reports";
import { downloadSalesReport } from "./sales";

const analyticsCommand: Command = {
	name: "analytics",
	description: "Request and download analytics and sales reports",
	subcommands: {
		sales: {
			name: "sales",
			description: "Download sales and trends reports",
			options: {
				vendor: {
					type: "string",
					short: "v",
					description:
						"Vendor number (or ASC_VENDOR_NUMBER/ASC_ANALYTICS_VENDOR_NUMBER env)",
					required: true,
				},
				type: {
					type: "string",
					short: "t",
					description:
						"Report type: SALES, PRE_ORDER, NEWSSTAND, SUBSCRIPTION, SUBSCRIPTION_EVENT",
					required: true,
				},
				subtype: {
					type: "string",
					short: "s",
					description: "Report subtype: SUMMARY, DETAILED",
					required: true,
				},
				frequency: {
					type: "string",
					short: "f",
					description: "Frequency: DAILY, WEEKLY, MONTHLY, YEARLY",
					required: true,
				},
				date: {
					type: "string",
					short: "d",
					description:
						"Report date: daily/weekly YYYY-MM-DD, monthly YYYY-MM, yearly YYYY",
					required: true,
				},
				version: {
					type: "string",
					description: "Report format version: 1_0 (default), 1_1",
					default: "1_0",
				},
				output: {
					type: "string",
					short: "o",
					description:
						"Output file path (default: sales_report_{date}_{type}.tsv.gz)",
				},
				decompress: {
					type: "boolean",
					description: "Decompress gzip output to .tsv",
					default: false,
				},
				parse: {
					type: "boolean",
					description: "Parse TSV and show summary statistics",
					default: false,
				},
			},
			execute: downloadSalesReport,
		},
		proceeds: {
			name: "proceeds",
			description: "Calculate proceeds with cache-aware report downloads",
			options: {
				vendor: {
					type: "string",
					short: "v",
					description:
						"Vendor number (or ASC_VENDOR_NUMBER/ASC_ANALYTICS_VENDOR_NUMBER env)",
				},
				month: {
					type: "string",
					description: "Month in YYYY-MM format",
				},
				from: {
					type: "string",
					description: "Start date in YYYY-MM-DD format",
				},
				to: {
					type: "string",
					description: "End date in YYYY-MM-DD format",
				},
				refresh: {
					type: "boolean",
					description: "Ignore cached files and re-download reports",
					default: false,
				},
				"group-by": {
					type: "string",
					description: "Group proceeds by: bundle-id, sku",
				},
			},
			execute: calculateProceeds,
		},
		request: {
			name: "request",
			description: "Create an analytics report request",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
				"access-type": {
					type: "string",
					description: "Access type: ONGOING, ONE_TIME_SNAPSHOT",
					default: "ONGOING",
				},
			},
			execute: createAnalyticsRequest,
		},
		requests: {
			name: "requests",
			description: "List analytics report requests for an app",
			options: {
				app: {
					type: "string",
					short: "a",
					description: "App ID",
					required: true,
				},
			},
			execute: listAnalyticsRequests,
		},
		reports: {
			name: "reports",
			description: "List analytics reports for a request",
			options: {
				"request-id": {
					type: "string",
					short: "r",
					description: "Analytics report request ID",
					required: true,
				},
			},
			execute: listAnalyticsReports,
		},
		instances: {
			name: "instances",
			description: "List analytics report instances",
			options: {
				"report-id": {
					type: "string",
					short: "r",
					description: "Analytics report ID",
					required: true,
				},
			},
			execute: listAnalyticsInstances,
		},
		download: {
			name: "download",
			description: "Download analytics report data",
			options: {
				"instance-id": {
					type: "string",
					short: "i",
					description: "Analytics report instance ID",
					required: true,
				},
				output: {
					type: "string",
					short: "o",
					description: "Output file path",
				},
			},
			execute: downloadAnalyticsReport,
		},
	},
};

export function registerAnalyticsCommands(): void {
	registry.register(analyticsCommand);
}
