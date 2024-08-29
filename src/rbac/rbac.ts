// File: rbac.ts
import { EventEmitter } from 'node:events';

import * as ipaddr from 'ipaddr.js';

export const DEFAULT = {
  permissions: {
    READ: 'read',
    WRITE: 'write',
    DELETE: 'delete',
    MANAGE: 'manage',
    ADMIN: 'admin',
  },
  roles: Array.from<RoleDefinition>([
    {
      name: 'viewer',
      permissions: new Set<Permission>([
        { action: 'read', tenantId: '*', subscriptionId: '*', namespaceId: '*', resourceTypeId: '*', resourceId: '*', effect: 'allow' }
      ])
    },
    {
      name: 'editor',
      permissions: new Set<Permission>([
        { action: 'read', tenantId: '*', subscriptionId: '*', namespaceId: '*', resourceTypeId: '*', resourceId: '*', effect: 'allow' },
        { action: 'write', tenantId: '*', subscriptionId: '*', namespaceId: '*', resourceTypeId: '*', resourceId: '*', effect: 'allow' }
      ])
    },
    {
      name: 'owner',
      permissions: new Set<Permission>([
        { action: 'delete', tenantId: '*', subscriptionId: '*', namespaceId: '*', resourceTypeId: '*', resourceId: '*', effect: 'allow' }
      ]),
      inherits: [ 'editor' ]
    },
    {
      name: 'manager',
      permissions: new Set<Permission>([
        { action: 'manage', tenantId: '*', subscriptionId: '*', namespaceId: '*', resourceTypeId: '*', resourceId: '*', effect: 'allow' }
      ]),
      inherits: [ 'viewer' ]
    },
    {
      name: 'admin',
      permissions: new Set<Permission>([
        { action: '*', tenantId: '*', subscriptionId: '*', namespaceId: '*', resourceTypeId: '*', resourceId: '*', effect: 'allow' }
      ])
    },
  ])
};

export type Role = string;
export type TenantId = string;
export type SubscriptionId = string;
export type NamespaceId = string;
export type ResourceTypeId = string;
export type PrincipalId = string;
export type GroupId = string;

export interface Tenant {
  id: TenantId;
  name: string;
}

export interface Subscription {
  id: SubscriptionId;
  tenantId: TenantId;
  name: string;
}

export interface Namespace {
  id: NamespaceId;
  name: string;
}

export interface Resource {
  id: string;
  tenantId: string;
  subscriptionId: string;
  namespaceId: string;
  typeId: string;
  parentId?: string;
}

export interface ResourceId {
  tenantId: TenantId;
  subscriptionId: SubscriptionId;
  namespaceId: NamespaceId;
  resourceTypeId: ResourceTypeId;
  resourceId: string;
}

export interface Permission {
  action: string;
  tenantId: string | '*';
  subscriptionId: string | '*';
  namespaceId: string | '*';
  resourceTypeId: string | '*';
  resourceId: string | '*';
  effect: 'allow' | 'deny';
  conditions?: ConditionChecker[];
}

export interface Principal {
  id: PrincipalId;
  type: 'user' | 'service' | 'group';
}

export interface User extends Principal {
  type: 'user';
  username: string;
}

export interface Group extends Principal {
  type: 'group';
  name: string;
  members: Set<PrincipalId>;
  subgroups: Set<GroupId>;
}

/**
 * Represents a role in the RBAC system.
 */
export interface RoleDefinition {
  name: Role;
  permissions: Set<Permission>;
  inherits?: Role[];
}

/**
 * Interface for conditional permission checkers.
 */
export interface ConditionChecker {
  check(principalId: PrincipalId, permission: Permission, resourceId: ResourceId, context?: any): boolean;
}

/**
 * Time-based condition checker implementation.
 */
export class TimeBasedChecker implements ConditionChecker {
  private startHour: number;
  private endHour: number;

  constructor(startHour: number, endHour: number) {
    if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
      throw new Error("Hours must be between 0 and 23");
    }
    this.startHour = startHour;
    this.endHour = endHour;
  }

  check(principalId: PrincipalId, permission: Permission, resourceId: ResourceId, context?: { currentTime?: Date }): boolean {
    const currentTime = context?.currentTime || new Date();
    const currentHour = currentTime.getHours();

    if (this.startHour <= this.endHour) {
      return currentHour >= this.startHour && currentHour < this.endHour;
    } else {
      return currentHour >= this.startHour || currentHour < this.endHour;
    }
  }
}

/**
 * IP-based condition checker implementation.
 */
export class IPBasedChecker implements ConditionChecker {
  private allowedIPs: Set<string>;

  constructor(allowedIPs: string[]) {
    this.allowedIPs = new Set(allowedIPs);
  }

  check(principalId: PrincipalId, permission: Permission, resourceId: ResourceId, context?: { ip: string }): boolean {
    if (!context || !context.ip) {
      return false; // If no IP is provided in the context, deny access
    }
    return this.allowedIPs.has(context.ip);
  }
}

/**
 * Advanced IP-based condition checker implementation.
 */
export class AdvancedIPChecker implements ConditionChecker {
  private allowedIPs: Set<string>;
  private allowedSubnets: Array<[ipaddr.IPv4 | ipaddr.IPv6, number]>;
  private blockedIPs: Set<string>;
  private blockedSubnets: Array<[ipaddr.IPv4 | ipaddr.IPv6, number]>;

  constructor(
    allowedIPs: string[] = [],
    allowedSubnets: string[] = [],
    blockedIPs: string[] = [],
    blockedSubnets: string[] = []
  ) {
    this.allowedIPs = new Set(allowedIPs);
    this.allowedSubnets = this.parseSubnets(allowedSubnets);
    this.blockedIPs = new Set(blockedIPs);
    this.blockedSubnets = this.parseSubnets(blockedSubnets);
  }

  private parseSubnets(subnets: string[]): Array<[ipaddr.IPv4 | ipaddr.IPv6, number]> {
    return subnets.map(subnet => {
      const [ip, mask] = subnet.split('/');
      return [ipaddr.parse(ip), parseInt(mask, 10)];
    });
  }

  private isIPInSubnet(ip: ipaddr.IPv4 | ipaddr.IPv6, subnet: [ipaddr.IPv4 | ipaddr.IPv6, number]): boolean {
    return ip.kind() === subnet[0].kind() && ip.match(subnet[0], subnet[1]);
  }

  check(principalId: PrincipalId, permission: Permission, resourceId: ResourceId, context?: { ip: string }): boolean {
    if (!context || !context.ip) {
      return false;
    }

    const ip = ipaddr.parse(context.ip);

    if (this.blockedIPs.has(context.ip)) {
      return false;
    }

    if (this.blockedSubnets.some(subnet => this.isIPInSubnet(ip, subnet))) {
      return false;
    }

    if (this.allowedIPs.size === 0 && this.allowedSubnets.length === 0) {
      return true;
    }

    if (this.allowedIPs.has(context.ip)) {
      return true;
    }

    return this.allowedSubnets.some(subnet => this.isIPInSubnet(ip, subnet));
  }
}

/**
 * Represents an entry in the audit log.
 */
interface AuditLogEntry {
  timestamp: Date;
  principalId: PrincipalId;
  action: string;
  resourceId?: ResourceId;
  granted: boolean;
  reason: string;
  context?: any;
}

/**
 * Interface for audit loggers.
 */
export interface AuditLogger {
  log(entry: AuditLogEntry): void;
}

/**
 * A simple console-based audit logger implementation.
 */
export class ConsoleAuditLogger implements AuditLogger {
  log(entry: AuditLogEntry): void {
    console.log(JSON.stringify(entry, null, 2));
  }
}

/**
 * Audit event emitter for RBAC system.
 */
export class AuditEventEmitter extends EventEmitter {
  emitPermissionCheck(entry: AuditLogEntry) {
    this.emit('permissionCheck', entry);
  }

  emitRoleAssignment(principalId: PrincipalId, role: Role) {
    this.emit('roleAssignment', { principalId, role, timestamp: new Date() });
  }

  emitRoleRevocation(principalId: PrincipalId, role: Role) {
    this.emit('roleRevocation', { principalId, role, timestamp: new Date() });
  }

  emitResourcePermissionAssignment(resourceId: ResourceId, role: Role, permission: Permission) {
    this.emit('resourcePermissionAssignment', { resourceId, role, permission, timestamp: new Date() });
  }

  emitPrincipalAddition(principal: Principal) {
    this.emit('principalAddition', { principal, timestamp: new Date() });
  }

  emitPrincipalRemoval(principalId: PrincipalId) {
    this.emit('principalRemoval', { principalId, timestamp: new Date() });
  }

  emitRoleCreation(role: Role, permissions: Permission[]) {
    this.emit('roleCreation', { role, permissions, timestamp: new Date() });
  }

  /**
   * Emits an event when a role is removed from the system.
   * @param role - The role that was removed.
   */
  emitRoleRemoval(role: Role) {
    this.emit('roleRemoval', { role, timestamp: new Date() });
  }

  emitGroupCreation(groupId: GroupId, name: string) {
    this.emit('groupCreation', { groupId, name, timestamp: new Date() });
  }

  emitGroupAddition(groupId: GroupId, principalId: PrincipalId) {
    this.emit('groupAddition', { groupId, principalId, timestamp: new Date() });
  }

  emitGroupRemoval(groupId: GroupId, principalId: PrincipalId) {
    this.emit('groupRemoval', { groupId, principalId, timestamp: new Date() });
  }

  emitPermissionDenial(principalId: PrincipalId, permission: Permission) {
    this.emit('permissionDenial', { principalId, permission, timestamp: new Date() });
  }

  emitPermissionDenialRemoval(principalId: PrincipalId, permission: Permission) {
    this.emit('permissionDenialRemoval', { principalId, permission, timestamp: new Date() });
  }

  emitConditionAddition(principalId: PrincipalId, permission: Permission, conditionType: string) {
    this.emit('conditionAddition', { principalId, permission, conditionType, timestamp: new Date() });
  }
}

/**
 * Options for configuring the RBAC system.
 */
export interface RBACOptions {
  auditLogger?: AuditLogger;
  logLevel?: 'none' | 'basic' | 'detailed';
}

/**
 * Role-Based Access Control (RBAC) system with support for negative and conditional permissions, and auditing.
 * Manages roles, permissions, principals (users, services, groups), and their relationships.
 */
export class RBAC {
  private roles: Map<Role, RoleDefinition>;
  private principalRoles: Map<PrincipalId, Set<Role>>;
  private principals: Map<PrincipalId, Principal>;
  private groups: Map<GroupId, Group>;
  private negativePermissions: Map<PrincipalId, Set<Permission>>;
  private resourcePermissions: Map<string, Map<string, Set<Permission>>>;
  private conditionCheckers: Map<PrincipalId, Map<Permission, ConditionChecker[]>>;
  private logLevel: 'none' | 'basic' | 'detailed';
  public auditEmitter: AuditEventEmitter;

  /**
   * Initializes a new instance of the RBAC class.
   */
  constructor(options?: RBACOptions) {
    this.roles = new Map();
    this.principalRoles = new Map();
    this.principals = new Map();
    this.groups = new Map();
    this.negativePermissions = new Map();
    this.resourcePermissions = new Map();
    this.conditionCheckers = new Map();
    this.logLevel = options?.logLevel ?? 'none';
    this.auditEmitter = new AuditEventEmitter();
  }

  /**
   * Sets or updates RBAC options.
   * @param options - The options to set or update.
   */
  setOptions(options: RBACOptions): void {
    if (options.logLevel !== undefined) {
      this.logLevel = options.logLevel;
    }
  }

  assignResourcePermission(resourceId: ResourceId, role: Role, permission: Permission): void {
    const key = this.getResourceKey(resourceId);
    if (!this.resourcePermissions.has(key)) {
      this.resourcePermissions.set(key, new Map());
    }
    const rolePerms = this.resourcePermissions.get(key)!;
    if (!rolePerms.has(role)) {
      rolePerms.set(role, new Set());
    }
    rolePerms.get(role)!.add(permission);
    this.auditEmitter.emitResourcePermissionAssignment(resourceId, role, permission);
  }

  /**
   * Adds a new role with associated permissions and optional inheritance.
   * @param role - The name of the role to add.
   * @param permissions - An array of permissions to associate with the role.
   * @param inherits - An optional array of roles that this role inherits from.
   */
  addRole(role: Role, permissions: Permission[], inherits?: Role[]): void {
    this.roles.set(role, {
      name: role,
      permissions: new Set(permissions),
      inherits: inherits
    });
    this.auditEmitter.emitRoleCreation(role, permissions);
  }

  /**
   * Removes a role from the system.
   * @param role - The name of the role to remove.
   * @returns True if the role was removed, false if it didn't exist.
   */
  removeRole(role: Role): boolean {
    if (this.roles.delete(role)) {
      // Remove the role from all principals
      for (const [principalId, roles] of this.principalRoles) {
        if (roles.delete(role)) {
          this.auditEmitter.emitRoleRevocation(principalId, role);
        }
      }
      // Remove the role from inheritance of other roles
      for (const roleDefinition of this.roles.values()) {
        if (roleDefinition.inherits) {
          const index = roleDefinition.inherits.indexOf(role);
          if (index > -1) {
            roleDefinition.inherits.splice(index, 1);
          }
        }
      }
      this.auditEmitter.emitRoleRemoval(role);
      return true;
    }
    return false;
  }

  /**
   * Adds a new principal (user, service, or group) to the system.
   * @param principal - The principal object to add.
   */
  addPrincipal(principal: Principal): void {
    this.principals.set(principal.id, principal);
    this.auditEmitter.emitPrincipalAddition(principal);
  }

  /**
   * Removes a principal from the system.
   * @param principalId - The ID of the principal to remove.
   * @returns True if the principal was removed, false if it didn't exist.
   */
  removePrincipal(principalId: PrincipalId): boolean {
    if (this.principals.delete(principalId)) {
      this.auditEmitter.emitPrincipalRemoval(principalId);
      return true;
    }
    return false;
  }

  /**
   * Assigns a role to a principal.
   * @param principalId - The ID of the principal.
   * @param role - The role to assign.
   * @throws Error if the principal does not exist.
   */
  assignRole(principalId: PrincipalId, role: Role): void {
    if (!this.principals.has(principalId)) {
      throw new Error(`Principal with id ${principalId} does not exist`);
    }
    if (!this.principalRoles.has(principalId)) {
      this.principalRoles.set(principalId, new Set());
    }
    this.principalRoles.get(principalId)!.add(role);
    this.auditEmitter.emitRoleAssignment(principalId, role);
  }

  /**
   * Revokes a role from a principal.
   * @param principalId - The ID of the principal.
   * @param role - The role to revoke.
   * @returns True if the role was revoked, false if the principal didn't have the role.
   */
  revokeRole(principalId: PrincipalId, role: Role): boolean {
    const roles = this.principalRoles.get(principalId);
    if (roles && roles.delete(role)) {
      this.auditEmitter.emitRoleRevocation(principalId, role);
      return true;
    }
    return false;
  }

  /**
   * Gets all roles associated with a principal, including inherited roles from groups.
   * @param principalId - The ID of the principal to get roles for.
   * @returns A set of all roles associated with the principal.
   */
  getPrincipalRoles(principalId: PrincipalId): Set<Role> {
    const roles = new Set<Role>();
    const directRoles = this.principalRoles.get(principalId);
    if (directRoles) {
      directRoles.forEach(role => {
        // roles.add(role)
        this.addRoleAndAncestors(role, roles);
      });
    }
    const principal = this.principals.get(principalId);
    if (principal && principal.type === 'group') {
      this.getGroupRoles(principal as Group, roles);
    } else {
      this.getMemberOfGroupsRoles(principalId, roles);
    }

    return roles;
  }

  /**
   * Recursively gets all roles associated with a group and its subgroups.
   * @param group - The group to get roles for.
   * @param roles - A set to accumulate roles into.
   */
  private getGroupRoles(group: Group, roles: Set<Role>): void {
    const groupRoles = this.principalRoles.get(group.id);

    if (groupRoles) {
      groupRoles.forEach(role => {
        // roles.add(role)
        this.addRoleAndAncestors(role, roles);
      });
    }

    this.getGroupsMemberOf(group.id).forEach(parentGroup => {
      this.getGroupRoles(parentGroup, roles);
    });
  }

  /**
   * Gets all roles inherited by a principal from the groups it belongs to.
   * @param principalId - The ID of the principal to get inherited roles for.
   * @param roles - A set to accumulate roles into.
   */
  private getMemberOfGroupsRoles(principalId: PrincipalId, roles: Set<Role>): void {
    this.groups.forEach(group => {
      if (group.members.has(principalId) || group.subgroups.has(principalId)) {
        this.getGroupRoles(group, roles);
      }
    });
  }

  /**
   * Retrieves a user by their principal ID.
   * @param principalId - The ID of the principal to retrieve.
   * @returns The User object if found and is a user, null otherwise.
   */
  getUser(principalId: PrincipalId): User | null {
    const principal = this.principals.get(principalId);
    return principal && principal.type === 'user' ? principal as User : null;
  }

  /**
   * Creates a new group.
   * @param groupId - The ID for the new group.
   * @param name - The name of the new group.
   */
  createGroup(groupId: GroupId, name: string): void {
    const group: Group = {
      id: groupId,
      type: 'group',
      name: name,
      members: new Set(),
      subgroups: new Set()
    };
    this.groups.set(groupId, group);
    this.principals.set(groupId, group);
    this.auditEmitter.emitGroupCreation(groupId, name);
  }

  /**
   * Adds a principal to a group.
   * @param groupId - The ID of the group to add the principal to.
   * @param principalId - The ID of the principal to add to the group.
   * @throws Error if the group or principal does not exist.
   */
  addToGroup(groupId: GroupId, principalId: PrincipalId): void {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group with id ${groupId} does not exist`);
    }

    const principal = this.principals.get(principalId);

    if (!principal) {
      throw new Error(`Principal with id ${principalId} does not exist`);
    }

    if (principal && principal.type === 'group') {
      this.addSubgroup(groupId, principal.id as GroupId)
    } else {
      group.members.add(principalId);
    }
    this.auditEmitter.emitGroupAddition(groupId, principalId);
  }

  /**
   * Adds a subgroup to a parent group.
   * @param parentGroupId - The ID of the parent group.
   * @param childGroupId - The ID of the child group to add.
   * @throws Error if either the parent or child group does not exist.
   */
  addSubgroup(parentGroupId: GroupId, childGroupId: GroupId): void {
    const parentGroup = this.groups.get(parentGroupId);
    const childGroup = this.groups.get(childGroupId);
    if (!parentGroup || !childGroup) {
      throw new Error('Both parent and child groups must exist');
    }
    parentGroup.subgroups.add(childGroupId);
  }

  /**
   * Gets all roles associated with a principal, including inherited roles from groups.
   * @param principalId - The ID of the principal to get roles for.
   * @returns A set of all roles associated with the principal.
   */
  getGroupsMemberOf(principalId: PrincipalId): Set<Group> {
    const groups = new Set<Group>();
    // const directGroups = new Set<Group>();

    this.groups.forEach(group => {
      if (group.members.has(principalId) || group.subgroups.has(principalId)) {
        this.addGroupAndAncestors(group, groups)
        // directGroups.add(group)
      }
    });

    return groups;
  }

  removeFromGroup(groupId: GroupId, principalId: PrincipalId): void {
    const group = this.groups.get(groupId);
    if (group && group.members.delete(principalId)) {
      this.auditEmitter.emitGroupRemoval(groupId, principalId);
    }
  }

  /**
   * Explicitly denies a specific permission to a principal.
   * @param principalId - The ID of the principal to deny the permission to.
   * @param permission - The permission to deny.
   * @throws Error if the principal does not exist.
   */
  denyPermission(principalId: PrincipalId, permission: Permission): void {
    if (!this.principals.has(principalId)) {
      throw new Error(`Principal with id ${principalId} does not exist`);
    }
    if (!this.negativePermissions.has(principalId)) {
      this.negativePermissions.set(principalId, new Set());
    }
    this.negativePermissions.get(principalId)!.add(permission);
    this.auditEmitter.emitPermissionDenial(principalId, permission);
  }

  /**
   * Removes an explicit permission denial from a principal.
   * @param principalId - The ID of the principal to remove the denial from.
   * @param permission - The permission to remove the denial for.
   */
  removeDeniedPermission(principalId: PrincipalId, permission: Permission): void {
    const deniedPermissions = this.negativePermissions.get(principalId);
    if (deniedPermissions && deniedPermissions.delete(permission)) {
      this.auditEmitter.emitPermissionDenialRemoval(principalId, permission);
    }
  }

  /**
   * Adds a conditional checker for a specific principal and permission.
   * @param principalId - The ID of the principal.
   * @param permission - The permission to apply the condition to.
   * @param checker - The condition checker to add.
   */
  addConditionChecker(principalId: PrincipalId, permission: Permission, checker: ConditionChecker): void {
    if (!this.conditionCheckers.has(principalId)) {
      this.conditionCheckers.set(principalId, new Map());
    }
    const principalCheckers = this.conditionCheckers.get(principalId)!;
    if (!principalCheckers.has(permission)) {
      principalCheckers.set(permission, []);
    }
    principalCheckers.get(permission)!.push(checker);
    this.auditEmitter.emitConditionAddition(principalId, permission, checker.constructor.name);
  }

  /**
   * Gets all permissions for a role, including inherited permissions.
   * @param role - The role to get permissions for.
   * @returns A set of all permissions for the role.
   */
  private getRolePermissions(role: Role): Set<Permission> {
    const roleDefinition = this.roles.get(role);
    if (!roleDefinition) {
      return new Set();
    }

    const permissions = new Set(roleDefinition.permissions);

    if (roleDefinition.inherits) {
      for (const inheritedRole of roleDefinition.inherits) {
        const inheritedPermissions = this.getRolePermissions(inheritedRole);
        inheritedPermissions.forEach(permission => permissions.add(permission));
      }
    }

    return permissions;
  }

  /**
   * Checks if a principal has a specific permission, taking into account role hierarchy, negative permissions, and conditions.
   * @param principalId - The ID of the principal to check.
   * @param permission - The permission to check for.
   * @param context - Additional context for condition checking (e.g., IP address, current time).
   * @returns True if the principal has the permission and all conditions are met, false otherwise.
   */
  hasPermission(principalId: PrincipalId, permission: Permission, resourceId: ResourceId, context?: any): boolean {
    let granted = false;
    let reason = '';

    if (this.isNegativePermission(principalId, permission, resourceId)) {
      reason = 'Explicitly denied';
      granted = false;
    } else {
      granted = this.checkPermissions(principalId, permission, resourceId, context);
      reason = granted ? 'Permission granted' : 'Permission not found';
    }

    if (this.logLevel !== 'none') {
      const logEntry: AuditLogEntry = {
        timestamp: new Date(),
        principalId,
        action: permission.action,
        resourceId,
        granted,
        reason,
        ...(this.logLevel === 'detailed' ? { context } : {})
      };
      this.auditEmitter.emitPermissionCheck(logEntry);
    }

    return granted;
  }

  private checkPermissions(principalId: PrincipalId, permission: Permission, resourceId: ResourceId, context?: any): boolean {
    
    // Check role-based permissions (including role hierarchy)
    const principalRoles = this.getPrincipalRoles(principalId);
    for (const role of principalRoles) {
      if (this.roleHasPermission(principalId, role, permission, resourceId, context)) {
        return true;
      }
    }

    // Check resource-specific permissions
    return this.resourceHasPermission(principalId, permission, resourceId, context);
  }

  private isNegativePermission(principalId: PrincipalId, permission: Permission, resourceId: ResourceId): boolean {
    const negativePerms = this.negativePermissions.get(principalId);
    if (negativePerms) {
      return Array.from(negativePerms).some(negPerm =>
        this.permissionMatches(negPerm, permission, resourceId)
      );
    }
    return false;
  }

  private roleHasPermission(principalId: PrincipalId, role: Role, permission: Permission, resourceId: ResourceId, context?: any): boolean {
    const roleDefinition = this.roles.get(role);
    if (roleDefinition) {
      return Array.from(roleDefinition.permissions).some(rolePerm =>
        this.permissionMatches(rolePerm, permission, resourceId) &&
        this.checkConditions(principalId, rolePerm, permission, resourceId, context)
      );
    }
    return false;
  }

  private resourceHasPermission(principalId: PrincipalId, permission: Permission, resourceId: ResourceId, context?: any): boolean {
    const resourceKey = this.getResourceKey(resourceId);
    const resourcePerms = this.resourcePermissions.get(resourceKey);
    if (resourcePerms) {
      const principalRoles = this.getPrincipalRoles(principalId);
      for (const [role, perms] of resourcePerms) {
        if (principalRoles.has(role)) {
          if (Array.from(perms).some(perm =>
            this.permissionMatches(perm, permission, resourceId) &&
            this.checkConditions(principalId, perm, permission, resourceId, context)
          )) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private permissionMatches(grantedPerm: Permission, requestedPerm: Permission, resourceId: ResourceId): boolean {
    return (grantedPerm.tenantId === '*' || grantedPerm.tenantId === requestedPerm.tenantId) &&
      (grantedPerm.subscriptionId === '*' || grantedPerm.subscriptionId === requestedPerm.subscriptionId) &&
      (grantedPerm.namespaceId === '*' || grantedPerm.namespaceId === requestedPerm.namespaceId) &&
      (grantedPerm.resourceTypeId === '*' || grantedPerm.resourceTypeId === requestedPerm.resourceTypeId) &&
      (grantedPerm.resourceId === '*' || grantedPerm.resourceId === requestedPerm.resourceId) &&
      (grantedPerm.action === '*' || grantedPerm.action === requestedPerm.action);
  }

  private checkConditions(principalId: PrincipalId, grantedPerm: Permission, requestedPerm: Permission, resourceId: ResourceId, context?: any): boolean {
    if (grantedPerm.conditions) {
      return grantedPerm.conditions.every(condition =>
        condition.check(principalId, requestedPerm, resourceId, context)
      );
    }
    return true;
  }

  private addRoleAndAncestors(role: Role, roleSet: Set<Role>) {
    if (!roleSet.has(role)) {
      roleSet.add(role);
      const roleDefinition = this.roles.get(role);
      if (roleDefinition && roleDefinition.inherits) {
        roleDefinition.inherits.forEach(parentRole => this.addRoleAndAncestors(parentRole, roleSet));
      }
    }
  }

  private addGroupAndAncestors(childGroup: Group, groupSet: Set<Group>) {
    if (!groupSet.has(childGroup)) {
      groupSet.add(childGroup);
      this.groups.forEach(group => {
        if (group.subgroups.has(childGroup.id)) {
          this.addGroupAndAncestors(group, groupSet)
        }
      })
    }
  }

  private getResourceKey(resource: Resource | ResourceId): string {
    if ('tenantId' in resource && 'resourceTypeId' in resource && 'resourceId' in resource) {
      return `rid:${resource.tenantId}:${resource.subscriptionId}:${resource.namespaceId}:${resource.resourceTypeId}:${resource.resourceId}`;
    } else {
      return `rid:${resource.tenantId}:${resource.subscriptionId}:${resource.namespaceId}:${resource.typeId}:${resource.id}`;
    }
  }

  /**
   * Creates a new RBAC instance with default roles.
   * @returns A new RBAC instance initialized with default roles.
   */
  static setupDefaultRoles(): RBAC {
    const rbac = new RBAC();
    DEFAULT.roles.forEach(roleDefinition => {
      rbac.addRole(roleDefinition.name, Array.from(roleDefinition.permissions), roleDefinition.inherits);
    });
    return rbac;
  }
}
