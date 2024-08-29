import { Subscription, Tenant } from "./rbac/rbac";

const tNoroutine = {
  id: 'noroutine',
  name: 'Noroutine'
}

const sHelloCounters = {
  id: 'hello.myworkers.cc',
  tenantId: 'noroutine',
  name: 'Hello Counters'
}

const sNoroutineShortener = {
  id: 'nrtn.me',
  tenantId: 'noroutine',
  name: 'Noroutine Counters'
}

const sUnknown = {
  id: 'unknown',
  tenantId: 'noroutine',
  name: 'unknown'
}

export const TENANTS = new Map<string, Tenant>([
  ['nrtn.me', tNoroutine],
  ['hello.myworkers.cc', tNoroutine],
]);

export const SUBSCRIPTIONS = new Map<string, Subscription>([
  ['dash.nrtn.me', sNoroutineShortener],
  ['nrtn.me', sNoroutineShortener],
  ['hello.myworkers.cc', sHelloCounters],
]);

export function getSubscription(domain: string): Subscription {
  return SUBSCRIPTIONS.get(domain) || sUnknown;
}

export function getTenant(domain: string): Tenant {
  return TENANTS.get(getSubscription(domain).id) || tNoroutine;
}