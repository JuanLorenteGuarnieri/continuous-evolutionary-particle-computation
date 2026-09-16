export class MetricsCollector {
  private data: Record<string, number[]> = {};
  record(name: string, value: number) {
    if (!this.data[name]) this.data[name] = [];
    this.data[name].push(value);
  }
  getMetrics() { return this.data; }
  exportJSON() { return JSON.stringify(this.data); }
}
