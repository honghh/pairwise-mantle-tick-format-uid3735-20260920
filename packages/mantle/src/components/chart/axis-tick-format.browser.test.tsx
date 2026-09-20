"use client";

import { render, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { MockInstance } from "vitest";
import { BarChart } from "../bar-chart/index.js";
import type { BarChartXAxisProps } from "../bar-chart/index.js";

/**
 * Real-browser tests for the `tickFormat` second argument. Pure label and
 * context resolution lives in `tick-format.test.ts`; these pin the two
 * layout effects only a real canvas measures: the returned label sizes the
 * value-axis gutter, and the returned label drives category collision
 * thinning. happy-dom returns a null 2d context, so neither runs there.
 */
const STYLE = `
:root {
	--color-chart-1: #3e6ff4;
	--color-chart-other: #737373;
	--border-color-card-muted: #e5e5e5;
	--border-color-card: #d4d4d;
	--text-color-muted: #717171;
	--color-neutral-500: #737373;
	--background-color-card: #ffffff;
}
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
}
[data-slot="bar-chart"] {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
}
[data-slot="bar-chart-plot"] {
	position: relative;
	flex: 1;
	min-height: 0;
	width: 100%;
}
[data-slot="bar-chart-plot"] > canvas,
[data-slot="bar-chart-plot"] > [tabindex] {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}
`;

let styleElement: HTMLStyleElement;
let fillTextSpy: MockInstance;
let measureTextSpy: MockInstance;

beforeAll(() => {
	styleElement = document.createElement("style");
	styleElement.textContent = STYLE;
	document.head.appendChild(styleElement);
});

// `restoreMocks` tears every spy down between tests, so reinstall each time.
// Both call through to the real implementation: the spies record the strings
// without changing layout or painting.
beforeEach(() => {
	fillTextSpy = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
	measureTextSpy = vi.spyOn(CanvasRenderingContext2D.prototype, "measureText");
});

afterAll(() => {
	styleElement.remove();
});

/** Every label string painted with `textAlign: "right"` (the value axis). */
const paintedValueLabels = (): string[] => {
	const labels: string[] = [];
	fillTextSpy.mock.calls.forEach((call, index) => {
		const context = fillTextSpy.mock.contexts[index];
		if (context instanceof CanvasRenderingContext2D && context.textAlign === "right") {
			labels.push(String(call[0]));
		}
	});
	return labels;
};

/** Every label string painted with `textAlign: "center"` (the category axis). */
const paintedCategoryLabels = (): string[] => {
	const labels: string[] = [];
	fillTextSpy.mock.calls.forEach((call, index) => {
		const context = fillTextSpy.mock.contexts[index];
		if (context instanceof CanvasRenderingContext2D && context.textAlign === "center") {
			labels.push(String(call[0]));
		}
	});
	return labels;
};

/** Every distinct string measured during layout. */
const measuredTexts = (): Set<string> =>
	new Set(measureTextSpy.mock.calls.map((call) => String(call[0])));

const months = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];
const rows = months.map((month) => ({ month, value: 100 }));

describe("tickFormat returned labels drive axis layout", () => {
	test("measures and paints the decorated value labels for the left gutter", async () => {
		render(
			<div style={{ width: 600, height: 300 }}>
				<BarChart.Root data={rows} xKey="month" animate={false} aria-label="Revenue by month">
					<BarChart.XAxis />
					<BarChart.YAxis
						tickFormat={(value, { defaultLabel }) => `USD ${defaultLabel} dollars`}
					/>
					<BarChart.Bar dataKey="value" label="Revenue" color="chart-1" />
				</BarChart.Root>
			</div>,
		);

		await waitFor(() => {
			expect(paintedValueLabels()).toContain("USD 100 dollars");
		});
		// The gutter measures the decorated string, not the bare default label.
		// Wait until a settled layout passes the string to measureText: if layout
		// measured "100" and painted "USD 100 dollars", the decorated string
		// never reaches it and this times out.
		await waitFor(() => {
			expect(measuredTexts().has("USD 100 dollars")).toBe(true);
		});
	});

	test("collision-thins category labels by the decorated string", async () => {
		const renderCategories = (tickFormat: BarChartXAxisProps["tickFormat"]) =>
			render(
				<div style={{ width: 400, height: 300 }}>
					<BarChart.Root data={rows} xKey="month" animate={false} aria-label="Padded months">
						<BarChart.XAxis tickFormat={tickFormat} />
						<BarChart.YAxis />
						<BarChart.Bar dataKey="value" label="Value" color="chart-1" />
					</BarChart.Root>
				</div>,
			);

		// Control: the bare month names survive thinning at this width.
		const control = renderCategories(undefined);
		const barePainted = await waitFor(async () => {
			const labels = paintedCategoryLabels();
			expect(labels).toContain("January");
			return labels;
		});

		const bareCount = new Set(barePainted).size;
		control.unmount();
		fillTextSpy.mockClear();
		measureTextSpy.mockClear();

		// The same twelve categories, every label padded. Real font metrics must
		// thin these harder than the bare names; a measurement pass that read the
		// default label would leave the same count.
		renderCategories((value, { defaultLabel }) => `xx-${defaultLabel}-xx`);
		const paddedPainted = await waitFor(async () => {
			const labels = paintedCategoryLabels();
			expect(labels).toContain("xx-January-xx");
			return labels;
		});

		expect(new Set(paddedPainted).size).toBeLessThan(bareCount);
	});
});
