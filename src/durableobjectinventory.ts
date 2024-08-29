import { ResourceId, Subscription, ResourceTypeId, Namespace, NamespaceId } from './rbac/rbac';

export interface Deletable {
  delete(): Promise<void>;
}

export class DurableObjectInventory<T extends Rpc.DurableObjectBranded & Deletable> {
  public static readonly RESOURCE_TYPE: ResourceTypeId = "inventory";

  private readonly _inventoryId: string
  private readonly _subscription: Subscription;
  private readonly _namespaceId: NamespaceId;
  private readonly _resourceTypeId: ResourceTypeId;
  private readonly _kv: KVNamespace;
  private readonly _durableObjectNamespace: DurableObjectNamespace<T>

  constructor(inventoryId: string, kv: KVNamespace, durableObjectNamespace: DurableObjectNamespace<T>, subscription: Subscription, namespaceId: NamespaceId, resourceTypeId: ResourceTypeId) {
    this._inventoryId = inventoryId
    this._kv = kv;
    this._durableObjectNamespace = durableObjectNamespace;
    this._subscription = subscription;
    this._namespaceId = namespaceId;
    this._resourceTypeId = resourceTypeId;
  }

  get durableObjectNamespace(): DurableObjectNamespace<T> {
    return this._durableObjectNamespace
  }

  newUniqueId(): string {
    return this._durableObjectNamespace.newUniqueId().toString()
  }

  /**
   * Get object by name or id
   * 
   * @param name name or name-like id starting with #
   * @returns 
   */
  async getObjectFromSimpleName(name: string): Promise<DurableObjectStub<T>> {
    if (! name || name.split(':').length != 1) {
      throw new Error("Simple resource name must not contain semicolons and must not be empty")
    }

    const isIdLikeName = name.startsWith('#')
    const fqrName = this.getResourceKey(this._resourceTypeId, name)
    const objectId = isIdLikeName ? this._durableObjectNamespace.idFromString(name.slice(1)) : this._durableObjectNamespace.idFromName(fqrName);
    const stub = this._durableObjectNamespace.get(objectId)
    // put name into kv if it is not just id with #
    if (! isIdLikeName) {
      let names = await this.getResourceNames();
      if (!names.includes(name)) {
        names.push(name);
        await this.putEntries(names);
      }  
    }
    return stub;
  }

  /**
   * Delete object by name or id
   * 
   * @param name name or name-like id starting with #
   * @returns 
   */
  async deleteObjectBySimpleName(name: string): Promise<void> {
    if (! name || name.split(':').length != 1) {
      throw new Error("Simple resource name must not contain semicolons and must not be empty")
    }

    const isIdLikeName = name.startsWith('#')
    const fqrName = this.getResourceKey(this._resourceTypeId, name)
    const objectId = isIdLikeName ? this._durableObjectNamespace.idFromString(name.slice(1)) : this._durableObjectNamespace.idFromName(fqrName);
    const stub = this._durableObjectNamespace.get(objectId)
    await stub.delete()

    // delete name resource
    if (! isIdLikeName) {
      // delete from inventory list
      // TODO implement soft delete ? for example by copying durable object into KV
      let value: string[] = await this.getResourceNames();
      value = value.filter((n) => n !== name);
      await this.putEntries(value);
    }
  }

  async getResourceNames(): Promise<string[]> {
    try {
      let value = await this._kv.get(this.getResourceKey(DurableObjectInventory.RESOURCE_TYPE, this._inventoryId))
      if (value) {
        return JSON.parse(value) as string[]
      } else {
        return [];
      }
    } catch {
      return [];
    }
  }

  private async putEntries(value: any): Promise<any> {
    try {
      await this._kv.put(this.getResourceKey(DurableObjectInventory.RESOURCE_TYPE, this._inventoryId), JSON.stringify(value));
    } catch (e) {
      console.log(e)
    }

    return value;
  }

  async containsResourceName(entry: ResourceTypeId): Promise<boolean> {
    return (await this.getResourceNames()).includes(entry)
  }

  getResourceKey(resourceType: ResourceTypeId, key: string) {
    const subKeyPrefix = `rid:${this._subscription.tenantId}:${this._subscription.id}:${this._namespaceId}:${resourceType}:`
    if (key.startsWith(subKeyPrefix)) {
      return key
    } else {
      return `${subKeyPrefix}${key}`
    }
  }

  getCounterResourceId(counterId: string): ResourceId {
    return {
      tenantId: this._subscription.tenantId,
      subscriptionId: this._subscription.id,
      namespaceId: 'system',
      resourceTypeId: "counter",
      resourceId: counterId
    }
  }

  getSessionsResourceId(sessionId: string): ResourceId {
    return {
      tenantId: this._subscription.tenantId,
      subscriptionId: this._subscription.id,
      namespaceId: 'system',
      resourceTypeId: "session",
      resourceId: sessionId
    }
  }
}