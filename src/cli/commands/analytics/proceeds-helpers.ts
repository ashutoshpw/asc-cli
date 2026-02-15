export type QueryMode = "month" | "range";

export interface RangeSegment {
	month: string;
	from: string;
	to: string;
	fullMonth: boolean;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function resolveQueryMode(
	month: string | undefined,
	from: string | undefined,
	to: string | undefined,
): QueryMode | null {
	if (month && !from && !to) {
		return "month";
	}

	if (!month && from && to) {
		return "range";
	}

	return null;
}

export function isValidMonth(value: string): boolean {
	return MONTH_PATTERN.test(value);
}

export function parseIsoMonthStrict(month: string): Date | null {
	if (!MONTH_PATTERN.test(month)) {
		return null;
	}
	const [year, monthPart] = month
		.split("-")
		.map((item) => Number.parseInt(item, 10));
	const date = new Date(Date.UTC(year, monthPart - 1, 1));
	return formatMonth(date) === month ? date : null;
}

export function parseIsoDateStrict(date: string): Date | null {
	if (!DATE_PATTERN.test(date)) {
		return null;
	}
	const [year, month, day] = date
		.split("-")
		.map((item) => Number.parseInt(item, 10));
	const parsed = new Date(Date.UTC(year, month - 1, day));
	return formatDate(parsed) === date ? parsed : null;
}

export function getMonthEndDate(monthStart: Date): Date {
	return new Date(
		Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
	);
}

export function formatDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function buildRangeSegments(
	startDate: Date,
	endDate: Date,
): RangeSegment[] {
	const segments: RangeSegment[] = [];
	let cursor = new Date(startDate);

	while (cursor <= endDate) {
		const monthStart = new Date(
			Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1),
		);
		const monthEnd = new Date(
			Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
		);
		const segmentStart = cursor;
		const segmentEnd = monthEnd < endDate ? monthEnd : endDate;

		segments.push({
			month: formatMonth(segmentStart),
			from: formatDate(segmentStart),
			to: formatDate(segmentEnd),
			fullMonth:
				formatDate(segmentStart) === formatDate(monthStart) &&
				formatDate(segmentEnd) === formatDate(monthEnd),
		});

		cursor = addDays(segmentEnd, 1);
	}

	return segments;
}

export function getDateStringsInRange(
	startDate: string,
	endDate: string,
): string[] {
	const start = parseIsoDateStrict(startDate);
	const end = parseIsoDateStrict(endDate);
	if (!start || !end) {
		return [];
	}

	const dates: string[] = [];
	for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
		dates.push(formatDate(d));
	}
	return dates;
}

export function round2(value: number): number {
	return Number(value.toFixed(2));
}

export function roundCurrencyMap(
	values: Record<string, number>,
): Record<string, number> {
	const result: Record<string, number> = {};
	for (const [currency, amount] of Object.entries(values)) {
		const rounded = round2(amount);
		if (rounded !== 0) {
			result[currency] = rounded;
		}
	}
	return result;
}

function formatMonth(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

function addDays(date: Date, days: number): Date {
	return new Date(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate() + days,
		),
	);
}
