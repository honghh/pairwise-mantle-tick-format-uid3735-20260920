import { describe, expect, test, vi } from "vitest";
import { timeTickFormatter, timeTicks } from "./scales.js";
import {
	resolveCategoryTickLabel,
	resolveLinearTickLabels,
	resolveTimeTickLabels,
	resolveValueTickLabels,
} from "./tick-format.js";
import type {
	XValue,
	XAxisTickFormatContext,
	XAxisTickFormatter,
	YAxisTickFormatContext,
	YAxisTickFormatter,
} from "./types.js";

// Assigning the one-argument callbacks to the two-argument formatter types
// pins backward compatibility at compile time; the test below pins behavior.
const oneArgX: XAxisTickFormatter = (value) => String(value);
const oneArgY: YAxisTickFormatter = (value) => `v${value}`;
const formatters = { oneArgX, oneArgY };

const resolveCategory = (
	values: readonly XValue[],
	scale: "band" | "point",
	format: XAxisTickFormatter,
): string[] => values.map((value) => resolveCategoryTickLabel(value, scale, format));

test("one-argument formatters resolve like declared formatters", () => {
	expect(resolveCategory(["January"], "band", formatters.oneArgX)).toEqual(["January"]);
	expect(resolveValueTickLabels([0, 0.1], formatters.oneArgY).map((tick) => tick.text)).toEqual([
		"v0",
		"v0.1",
	]);
});

/**
 * These tests pin the label/context contract every chart axis shares. The
 * engine generates raw ticks elsewhere; `tick-format` pairs each raw tick
 * with the label it actually paints and the context a custom formatter
 * reads. Time ticks run through the real d3-backed formatter so the default
 * label is the calendar-aware string the engine paints.
 */

describe("resolveValueTickLabels", () => {
	test("decorates the default label at a decimal step's precision", () => {
		const received: YAxisTickFormatContext[] = [];
		const labels = resolveValueTickLabels([0, 0.1, 0.2], (value, context) => {
			received.push(context);
			return `$${context.defaultLabel}`;
		});

		expect(labels.map((tick) => tick.text)).toEqual(["$0", "$0.1", "$0.2"]);
		expect(received.map((context) => context.step)).toEqual([0.1, 0.1, 0.1]);
	});

	test("paints thousands-grouped defaults without a formatter", () => {
		const labels = resolveValueTickLabels([0, 500, 1000], undefined);
		expect(labels.map((tick) => tick.text)).toEqual(["0", "500", "1,000"]);
	});

	test("reports a null step for a single tick and keeps the adaptive label", () => {
		const contexts: YAxisTickFormatContext[] = [];
		const labels = resolveValueTickLabels([0.0004], (value, context) => {
			contexts.push(context);
			return context.defaultLabel;
		});

		expect(labels.map((tick) => tick.text)).toEqual(["0.0004"]);
		expect(contexts[0]?.step).toBeNull();
	});

});

describe("resolveLinearTickLabels", () => {
	test("reports the linear step and the step-derived default label", () => {
		const contexts: XAxisTickFormatContext[] = [];
		const labels = resolveLinearTickLabels([0, 0.5, 1], (value, context) => {
			contexts.push(context);
			return `${context.defaultLabel}ms`;
		});

		expect(labels.map((tick) => tick.text)).toEqual(["0ms", "0.5ms", "1ms"]);
		expect(contexts.every((context) => context.scale === "linear")).toBe(true);
		expect(contexts.map((context) => context.step)).toEqual([0.5, 0.5, 0.5]);
	});

	test("reports a null step for a single linear tick", () => {
		const context = vi.fn<XAxisTickFormatter>((value, tick) => tick.defaultLabel);
		resolveLinearTickLabels([42], context);

		expect(context).toHaveBeenCalledTimes(1);
		expect(context.mock.calls[0]?.[1]).toMatchObject({ scale: "linear", step: null });
	});
});

describe("resolveTimeTickLabels", () => {
	test("passes the painted default label and the generated millisecond step", () => {
		const range: [number, number] = [
			new Date(2026, 0, 1).getTime(),
			new Date(2026, 6, 1).getTime(),
		];
		const epochs = timeTicks(range, 6);
		const defaultFormat = timeTickFormatter(range);

		// The labels the engine paints on the no-formatter path. The custom
		// path must hand the callback exactly these strings.
		const painted = resolveTimeTickLabels(epochs, defaultFormat, undefined).map(
			(tick) => tick.text,
		);
		const contexts: XAxisTickFormatContext[] = [];
		const labels = resolveTimeTickLabels(epochs, defaultFormat, (value, context) => {
			contexts.push(context);
			return `at ${context.defaultLabel}`;
		});

		const expectedStep = epochs.length > 1 ? (epochs[1] ?? 0) - (epochs[0] ?? 0) : null;
		expect(labels.map((tick) => tick.text)).toEqual(painted.map((label) => `at ${label}`));
		expect(contexts.every((context) => context.scale === "time")).toBe(true);
		expect(contexts[0]?.step).toBe(expectedStep);
		expect(expectedStep).toBeGreaterThan(0);
	});

	test("reports a null step for a single time tick", () => {
		const epoch = new Date(2026, 0, 1).getTime();
		const context = vi.fn<XAxisTickFormatter>((value, tick) => tick.defaultLabel);

		resolveTimeTickLabels([epoch], () => "2026", context);

		expect(context).toHaveBeenCalledTimes(1);
		expect(context.mock.calls[0]?.[0]).toBeInstanceOf(Date);
		expect(context.mock.calls[0]?.[1]).toMatchObject({
			defaultLabel: "2026",
			scale: "time",
			step: null,
		});
	});
});

describe("resolveCategoryTickLabel", () => {
	test("passes the category through as the default label with no numeric step", () => {
		const contexts: XAxisTickFormatContext[] = [];
		const format: XAxisTickFormatter = (value, context) => {
			contexts.push(context);
			return context.defaultLabel.slice(0, 3);
		};
		const labels = resolveCategory(["January", "February"], "band", format);

		expect(labels).toEqual(["Jan", "Feb"]);
		expect(contexts).toEqual([
			{ defaultLabel: "January", scale: "band", step: null },
			{ defaultLabel: "February", scale: "band", step: null },
		]);
	});

	test("reports the point scale for line/area categories", () => {
		const context = vi.fn<XAxisTickFormatter>((value, tick) => tick.defaultLabel);
		resolveCategory(["a"], "point", context);

		expect(context.mock.calls[0]?.[1]).toMatchObject({ scale: "point", step: null });
	});
});
