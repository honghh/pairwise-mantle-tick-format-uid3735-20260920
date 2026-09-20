"@ngrok/mantle": patch
---

`BarChart`, `LineChart`, `AreaChart`, and `ScatterPlot` axis `tickFormat` callbacks now receive a second argument with the tick context. `context.defaultLabel` is the exact label the axis paints without a formatter, with the tick step's decimal precision, thousands grouping, and the calendar-aware date or category treatment. A currency prefix or a unit suffix now decorates that label instead of guessing precision or re-implementing date formatting:

```tsx
<BarChart.YAxis tickFormat={(value, { defaultLabel }) => `$${defaultLabel}`} />
```

`context.step` reports the interval between the ticks the engine generated this round. It carries value units on a linear axis and milliseconds on a time axis. A categorical x axis reports `context.scale` of `"band"` or `"point"` with `step: null`, and a single-tick continuous axis also reports `step: null`. The x-axis context reports the scale as `context.scale` (`"band"`, `"point"`, `"linear"`, or `"time"`).

The returned string stays the final label, and the axis gutter and collision thinning now measure it. Callbacks that declare only the first argument still compile and behave the same.
