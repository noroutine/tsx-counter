import { RBAC, User } from "./rbac";

export function buildRbac(): RBAC {
  // Initialize RBAC with default roles
  const rbac = RBAC.setupDefaultRoles();
  // rbac.setOptions({ logLevel: 'detailed' });


  rbac.addPrincipal({ id: 'anonymous', type: 'user', username: 'anonymous coward' } as User);
  rbac.addPrincipal({ id: 'god', type: 'user', username: 'god mode' } as User);

  // add incrementor role, incrementor can view and increment any counter in any namespace in any tenant
  rbac.addRole('incrementor', [{ action: 'increment', tenantId: '*', subscriptionId: '*', namespaceId: '*', resourceTypeId: 'counter', resourceId: '*', effect: 'allow' }], ['viewer']);

  // anonymous can do anything in transient namespace in any tenant with any resource
  rbac.addRole('transient_namespace_admin', [{ action: '*', tenantId: '*', subscriptionId: '*', namespaceId: 'transient', resourceTypeId: '*', resourceId: '*', effect: 'allow' }]);
  rbac.assignRole('anonymous', 'transient_namespace_admin');
  rbac.assignRole('anonymous', 'incrementor');

  rbac.assignRole('god', 'admin');

  // Set up console logging for audit events
  // rbac.auditEmitter.on('permissionCheck', (logEntry) => {
  //   console.log('Permission Check:', JSON.stringify(logEntry, null, 2));
  // });

  return rbac;
}