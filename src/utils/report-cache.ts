import { homedir } from "node:os";
import { join } from "node:path";

export function getReportsVendorDir(vendorNumber: string): string {
	return join(homedir(), ".config", "asc", "vendors", vendorNumber, "reports");
}

export function getReportsMonthDir(
	vendorNumber: string,
	month: string,
): string {
	return join(getReportsVendorDir(vendorNumber), month);
}

export function getReportsMonthCsvPath(
	vendorNumber: string,
	month: string,
): string {
	return join(getReportsMonthDir(vendorNumber, month), "file.csv");
}

export function getReportsDailyDir(
	vendorNumber: string,
	month: string,
): string {
	return join(getReportsMonthDir(vendorNumber, month), "daily");
}

export function getReportsDailyCsvPath(
	vendorNumber: string,
	date: string,
): string {
	return join(
		getReportsDailyDir(vendorNumber, date.slice(0, 7)),
		`${date}.csv`,
	);
}
