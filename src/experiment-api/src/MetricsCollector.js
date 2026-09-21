// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export class MetricsCollector {
    data = {};
    record(name, value) {
        if (!this.data[name])
            this.data[name] = [];
        this.data[name].push(value);
    }
    getMetrics() { return this.data; }
    exportJSON() { return JSON.stringify(this.data); }
}
