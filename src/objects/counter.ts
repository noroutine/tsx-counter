import { Deletable } from './../durableobjectinventory';
import { DurableObject } from "cloudflare:workers";
import { ResourceTypeId } from "../rbac/rbac";

// Durable Counter Object
export class Counter extends DurableObject implements Deletable {
  
  // historically it is "value", do not change for now
  public static readonly INVENTORY_ID = "counters";
  public static readonly RESOURCE_TYPE: ResourceTypeId = "counter";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async trace() {
    const res = await fetch("https://www.cloudflare.com/cdn-cgi/trace");
    return await res.text();
  }

  async setCounterValue(value: number): Promise<void> {
    await this.ctx.storage.put("value", value);
  }

  async getCounterValue(): Promise<number> {
    return Number.parseInt(await this.ctx.storage.get("value") || "0");
  }

  async getDataUrl(): Promise<string> {
    let data: any = (await this.ctx.storage.get("data")) || {};
    return data.url || "/";
  }

  async increment(amount: number = 1): Promise<number> {
    let value: number = (await this.ctx.storage.get("value")) || 0;
    value += amount;
    // You do not have to worry about a concurrent request having modified the value in storage.
    // "input gates" will automatically protect against unwanted concurrency.
    // Read-modify-write is safe.
    await this.ctx.storage.put("value", value);
    return value;
  }

  async decrement(amount: number = 1): Promise<number> {
    let value: number = (await this.ctx.storage.get("value")) || 0;
    value -= amount;
    await this.ctx.storage.put("value", value);
    return value;
  }

  async updateData(url: string = "/"): Promise<string> {
    let data: any = await this.ctx.storage.get("data") || {};
    data.url = url
    await this.ctx.storage.put("data", data);
    console.log(`saved ${url}`)
    return url;
  }

  async delete() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
}