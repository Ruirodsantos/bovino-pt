import * as echarts from "echarts/core";
import { LineChart, BarChart, MapChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, GeoComponent, AriaComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, BarChart, MapChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, GeoComponent, AriaComponent, CanvasRenderer]);

const BASE = (import.meta as any).env.BASE_URL as string;
type Row = { geo: string; geo_label: string; partner_geo: string | null; flow: string; product_code: string | null; product_label: string | null; series: string; period: string; value: number; unit: string };
type DS = { meta: Record<string, any>; rows: Row[] };

const cache = new Map<string, Promise<DS | null>>();
function load(id: string): Promise<DS | null> {
  if (!cache.has(id)) cache.set(id, fetch(`${BASE}data/${id}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(id)!;
}
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const nf = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 });
const nfc = new Intl.NumberFormat("pt-PT", { notation: "compact", maximumFractionDigits: 1 });
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function theme() {
  return { ink: css("--ink"), muted: css("--muted"), line: css("--line"), pasture: css("--pasture"), schist: css("--schist"), accent: css("--accent"), cork: css("--cork"), surface: css("--surface") };
}
function axisStyle(t: ReturnType<typeof theme>) {
  return {
    axisLine: { lineStyle: { color: t.line } }, axisTick: { show: false },
    axisLabel: { color: t.muted, fontFamily: "Public Sans" }, splitLine: { lineStyle: { color: t.line, type: "dashed" as const } },
  };
}
function baseOpt(t: ReturnType<typeof theme>) {
  return {
    textStyle: { fontFamily: "Public Sans", color: t.ink },
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" as const, backgroundColor: t.surface, borderColor: t.line, textStyle: { color: t.ink } },
    legend: { top: 0, left: 0, textStyle: { color: t.muted }, icon: "roundRect" },
    aria: { enabled: true },
  };
}

/** Annual totals; a year is "complete" only with 12 months. Partial years are labelled. */
function annual(rows: Row[]): { years: string[]; label: (y: string) => string; sum: (filter: (r: Row) => boolean) => number[] } {
  const monthsByYear = new Map<string, Set<string>>();
  rows.forEach((r) => { const y = r.period.slice(0, 4); if (!monthsByYear.has(y)) monthsByYear.set(y, new Set()); monthsByYear.get(y)!.add(r.period); });
  const years = [...monthsByYear.keys()].sort();
  const label = (y: string) => { const n = monthsByYear.get(y)!.size; return n >= 12 ? y : `${y} (jan–${MONTHS[n - 1]})`; };
  const sum = (f: (r: Row) => boolean) => years.map((y) => rows.filter((r) => r.period.startsWith(y) && f(r)).reduce((a, r) => a + r.value, 0));
  return { years, label, sum };
}

// CN 0102 groups (Combined Nomenclature). Official labels are shown in the data table.
export function cnGroup(code: string): string | null {
  if (code === "0102") return null; // aggregate
  if (code.startsWith("010221") || code === "01029020" || code.startsWith("0102 21")) return "Reprodutores de raça pura";
  if (code === "01022910") return "Vitelos até 80 kg";
  if (["01022921", "01022941", "01022951", "01022961", "01022991"].includes(code)) return "Para abate";
  if (["01022929", "01022949", "01022959", "01022969", "01022999"].includes(code)) return "Outros (recria / engorda)";
  return "Outras categorias";
}
const GROUP_COLORS = ["--pasture", "--cork", "--accent", "--schist", "--muted"];

const renderers: Record<string, (el: HTMLElement, ds: DS, mode: string) => any> = {
  population(el, ds, mode) {
    const t = theme();
    const geos = ["PT", "ES"];
    const periods = [...new Set(ds.rows.map((r) => r.period))].sort();
    const series = geos.map((g, i) => {
      const s = new Map(ds.rows.filter((r) => r.geo === g).map((r) => [r.period, r.value]));
      const first = periods.map((p) => s.get(p)).find((v) => v != null) ?? 1;
      return {
        name: g === "PT" ? "Portugal" : "Espanha", type: "line", smooth: true, showSymbol: false, lineStyle: { width: 3 },
        color: i === 0 ? t.pasture : t.schist,
        data: periods.map((p) => { const v = s.get(p); return v == null ? null : mode === "index" ? +(100 * v / first).toFixed(1) : v; }),
      };
    });
    return {
      ...baseOpt(t),
      tooltip: { ...baseOpt(t).tooltip, valueFormatter: (v: number) => (v == null ? "—" : mode === "index" ? `${v.toLocaleString("pt-PT")}` : `${nf.format(v)} cabeças`) },
      xAxis: { type: "category", data: periods, ...axisStyle(t) },
      yAxis: { type: "value", scale: mode === "index", ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, formatter: (v: number) => (mode === "index" ? `${v}` : nfc.format(v)) } },
      series,
    };
  },

  "live-trade"(el, ds, mode) {
    const t = theme();
    const ind = mode === "eur" ? "VALUE_IN_EUROS" : "SUPPLEMENTARY_QUANTITY";
    const rows = ds.rows.filter((r) => r.series.endsWith(ind) && r.product_code && r.product_code !== "0102");
    const a = annual(mode === "eur" ? ds.rows.filter((r) => r.series.endsWith(ind)) : rows);
    const groups = [...new Set(rows.map((r) => cnGroup(r.product_code!)).filter(Boolean))] as string[];
    const series: any[] = groups.map((g, i) => ({ name: g, type: "bar", stack: "t", barMaxWidth: 34, color: css(GROUP_COLORS[i % GROUP_COLORS.length]),
      data: a.sum((r) => cnGroup(r.product_code!) === g) }));
    if (mode === "eur") {
      // Official total (code 0102) minus detailed categories = not broken down here.
      const totals = ds.rows.filter((r) => r.product_code === "0102" && r.series.endsWith(ind));
      const tot = a.years.map((y) => totals.filter((r) => r.period.startsWith(y)).reduce((s, r) => s + r.value, 0));
      const parts = a.years.map((_, i) => series.reduce((s, x) => s + x.data[i], 0));
      series.push({ name: "Não discriminado / anterior a 2012", type: "bar", stack: "t", barMaxWidth: 34, color: t.line,
        data: tot.map((v, i) => Math.max(0, v - parts[i])) });
    }
    series[series.length - 1].itemStyle = { borderRadius: [4, 4, 0, 0] };
    return {
      ...baseOpt(t),
      tooltip: { ...baseOpt(t).tooltip, valueFormatter: (v: number) => (mode === "eur" ? `${nfc.format(v)} €` : `${nf.format(v)} cabeças`) },
      xAxis: { type: "category", data: a.years.map(a.label), ...axisStyle(t) },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, formatter: (v: number) => nfc.format(v) } },
      series,
    };
  },

  "beef-balance"(el, ds) {
    const t = theme();
    const rows = ds.rows.filter((r) => r.series.endsWith("QUANTITY_IN_100KG"));
    const a = annual(rows);
    const tonnes = (f: string) => a.sum((r) => r.flow === f).map((v) => +(v / 1000).toFixed(0));
    return {
      ...baseOpt(t),
      tooltip: { ...baseOpt(t).tooltip, valueFormatter: (v: number) => `${nf.format(v)} t` },
      xAxis: { type: "category", data: a.years.map(a.label), ...axisStyle(t) },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, formatter: (v: number) => `${nfc.format(v)} t` } },
      series: [
        { name: "Portugal compra a Espanha", type: "bar", color: t.schist, barMaxWidth: 22, itemStyle: { borderRadius: [4, 4, 0, 0] }, data: tonnes("import") },
        { name: "Portugal vende a Espanha", type: "bar", color: t.pasture, barMaxWidth: 22, itemStyle: { borderRadius: [4, 4, 0, 0] }, data: tonnes("export") },
      ],
    };
  },

  "live-exports-world"(el, ds) {
    const t = theme();
    const rows = ds.rows.filter((r) => r.geo === "PT");
    const a = annual(rows);
    return {
      ...baseOpt(t), legend: { show: false },
      tooltip: { ...baseOpt(t).tooltip, valueFormatter: (v: number) => `${nf.format(v)} cabeças` },
      xAxis: { type: "category", data: a.years.map(a.label), ...axisStyle(t) },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, formatter: (v: number) => nfc.format(v) } },
      series: [{ name: "Portugal — exportações de bovinos vivos (todos os destinos)", type: "bar", color: t.accent, barMaxWidth: 26, itemStyle: { borderRadius: [4, 4, 0, 0] }, data: a.sum(() => true) }],
    };
  },
};

async function mapChart(el: HTMLElement) {
  const t = theme();
  const [ds, geo] = await Promise.all([load("bovine_population_regions"), fetch(`${BASE}geo/nuts2.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
  if (!ds || !geo) return empty(el);
  echarts.registerMap("iberia", geo);
  const year = [...new Set(ds.rows.map((r) => r.period))].sort().pop()!;
  const latest = new Map<string, number>();
  // latest available year per region (regions report in different years)
  [...ds.rows].sort((a, b) => a.period.localeCompare(b.period)).forEach((r) => latest.set(r.geo, r.value));
  const yearOf = new Map<string, string>();
  [...ds.rows].sort((a, b) => a.period.localeCompare(b.period)).forEach((r) => yearOf.set(r.geo, r.period));
  const labels = new Map<string, string>(geo.features.map((f: any) => [f.properties.name, f.properties.label]));
  const data = [...latest].map(([name, value]) => ({ name, value }));
  const max = Math.max(...data.map((d) => d.value));
  const chart = echarts.init(el, null, { renderer: "canvas" });
  chart.setOption({
    tooltip: { trigger: "item", backgroundColor: t.surface, borderColor: t.line, textStyle: { color: t.ink },
      formatter: (p: any) => `<strong>${labels.get(p.name) ?? p.name}</strong><br>${p.value ? nf.format(p.value) + " bovinos" : "sem dados"}<br><span style="color:${t.muted}">ref. ${yearOf.get(p.name) ?? "—"}</span>` },
    visualMap: { min: 0, max, left: 0, bottom: 0, calculable: false, orient: "horizontal", itemWidth: 12, itemHeight: 140,
      text: [nfc.format(max), "0"], textStyle: { color: t.muted }, inRange: { color: [css("--cork-soft"), t.cork, t.accent] } },
    series: [{ type: "map", map: "iberia", roam: false, aspectScale: 0.85, data, nameProperty: "name",
      itemStyle: { borderColor: t.surface, borderWidth: 0.8, areaColor: css("--cork-soft") },
      emphasis: { label: { show: false }, itemStyle: { areaColor: t.pasture } }, select: { disabled: true } }],
    aria: { enabled: true, description: `Mapa do efetivo bovino por região NUTS 2 de Portugal e Espanha, último ano disponível até ${year}.` },
  });
  new ResizeObserver(() => chart.resize()).observe(el);
}

function empty(el: HTMLElement) {
  el.classList.remove("chart");
  el.innerHTML = `<div class="empty">Os dados deste gráfico chegam na próxima atualização automática. Nenhum valor é mostrado antes de ser verificado.</div>`;
}

async function mount(el: HTMLElement) {
  const kind = el.dataset.chart!;
  if (kind === "map") return mapChart(el);
  const ds = await load(el.dataset.dataset!);
  if (!ds || !ds.rows.length) return empty(el);
  const chart = echarts.init(el, null, { renderer: "canvas" });
  const draw = (mode: string) => chart.setOption(renderers[kind](el, ds, mode), true);
  draw(el.dataset.mode ?? "abs");
  const group = el.parentElement?.querySelector<HTMLElement>(".toggle");
  group?.querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
    b.addEventListener("click", () => {
      group.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw(b.dataset.mode!);
    }));
  new ResizeObserver(() => chart.resize()).observe(el);
}

const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); mount(e.target as HTMLElement); } }), { rootMargin: "200px" });
document.querySelectorAll<HTMLElement>("[data-chart]").forEach((el) => io.observe(el));
