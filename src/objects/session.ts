import { DurableObject } from "cloudflare:workers";
import { ResourceTypeId } from "../rbac/rbac";
import { Deletable } from "../durableobjectinventory";

/** A Durable Object's behavior is defined in an exported Javascript class */
export class Session extends DurableObject implements Deletable {

  public static readonly INVENTORY_ID = "sessions";
  public static readonly RESOURCE_TYPE: ResourceTypeId = "session";

  /**
   * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
   * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
   *
   * @param ctx - The interface for interacting with Durable Object state
   * @param env - The interface to reference bindings declared in wrangler.toml
   */
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async delete() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
}