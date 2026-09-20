import type { XAxisTickFormatter, XValue, YAxisTickFormatter } from "./types.js";
import { formatNumber, formatXValue, tickFractionDigits } from "./format.js";

/**
 * Pure label resolution for axis ticks. The engine generates the raw tick
 * values; this module pairs each one with the label it actually paints and
 * the context a custom `tickFormat` reads.
 *
 * This module is internal shared implementation, not exported from the
 * package. The public types are {@link XAxisTickFormatter} and
 * {@link YAxisTickFormatter}.
 */

/**
 * The fraction digits the default labels need for this round's tick step.
 * Returns `undefined` for one tick, where the engine falls back to the
 * adaptive formatter instead of assuming a precision.
 */
const tickFractionDigitsForStep = (ticks: readonly number[]): number | undefined => {
	if (ticks.length < 2) {
		return undefined;
	}
	const step = Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0));
	return tickFractionDigits(step);
};

/**
 * Resolve every value-axis tick to its final label. With no formatter, the
 * label is the thousands-separated value at the tick step's precision. With
 * one, the formatter receives that exact default label and the step between
 * this round's ticks (`null` for a single tick).
 *
 * @example
 * ```ts
 * resolveValueTickLabels([0, 0.1, 0.2], (value, { defaultLabel }) => `$${defaultLabel}`);
 * // ["$0", "$0.1", "$0.2"]
 * ```
 */
const resolveValueTickLabels = (
	ticks: readonly number[],
	format: YAxisTickFormatter | undefined,
): Array<{ value: number; text: string }> => {
	const digits = tickFractionDigitsForStep(ticks);
	const step = ticks.length > 1 ? Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0)) : null;
	return ticks.map((value) => {
		const defaultLabel = formatNumber(
			value,
			digits == null ? undefined : { maximumFractionDigits: digits },
		);
		return {
			value,
			text: format == null ? defaultLabel : format(value, { defaultLabel, step }),
	};
	});
};

/**
 * Resolve one categorical x tick. The engine pre-thins dense category axes
 * before formatting, so it resolves labels one surviving slot at a time.
 *
 * @example
 * ```ts
 * resolveCategoryTickLabel("Jan", "band", format);
 * ```
 */
const resolveCategoryTickLabel = (
	value: XValue,
	scale: "band" | "point",
	format: XAxisTickFormatter | undefined,
	options?: { datasetHasTimeOfDay?: boolean },
): string => {
	const defaultLabel = formatXValue(value, { datasetHasTimeOfDay: options?.datasetHasTimeOfDay });
	if (format == null) {
		return defaultLabel;
	}
	return format(value, { defaultLabel, scale, step: null });
};

/**
 * Resolve every linear x tick to its final label. The default label carries
 * the tick step's fraction digits; the context reports the step between this
 * round's ticks (`null` for a single tick).
 *
 * @example
 * ```ts
 * resolveLinearTickLabels([0, 0.5, 1], (value, { defaultLabel }) => `${defaultLabel} ms`);
 * // ["0 ms", "0.5 ms", "1 ms"]
 * ```
 */
const resolveLinearTickLabels = (
	ticks: readonly number[],
	format: XAxisTickFormatter | undefined,
): Array<{ value: number; text: string }> => {
	const digits = tickFractionDigitsForStep(ticks);
	const step = ticks.length > 1 ? Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0)) : null;
	return ticks.map((value) => {
		const defaultLabel = formatNumber(
			value,
			digits == null ? undefined : { maximumFractionDigits: digits },
		);
		return {
			value,
			text: format == null ? defaultLabel : format(value, { defaultLabel, scale: "linear", step }),
		};
	});
};

/**
 * Resolve every time-axis tick to its final label. `defaultLabelFor` maps an
 * epoch to the calendar-aware label the engine paints without a formatter.
 * The context step is the interval between this round's ticks in
 * milliseconds (`null` for a single tick).
 *
 * @example
 * ```ts
 * resolveTimeTickLabels(epochs, defaultFormat, (value, { defaultLabel }) => defaultLabel);
 * ```
 */
const resolveTimeTickLabels = (
	epochs: readonly number[],
	defaultLabelFor: (epochMs: number) => string,
	format: XAxisTickFormatter | undefined,
): Array<{ value: number; text: string }> => {
	const step = epochs.length > 1 ? Math.abs((epochs[1] ?? 0) - (epochs[0] ?? 0)) : null;
	return epochs.map((epoch) => {
		const defaultLabel = defaultLabelFor(epoch);
		return {
			value: epoch,
			text:
				format == null
					? defaultLabel
					: format(new Date(epoch), { defaultLabel, scale: "time", step }),
		};
	});
};

export {
	//,
	resolveCategoryTickLabel,
	resolveLinearTickLabels,
	resolveTimeTickLabels,
	resolveValueTickLabels,
};
