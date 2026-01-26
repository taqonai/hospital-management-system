/**
 * usePermissions hook
 * 
 * Provides access to the current user's RBAC permissions.
 * Must be used within a <PermissionProvider>.
 * 
 * @returns {Object}
 * - permissions: string[] — list of permission codes
 * - hasPermission(permission: string): boolean — check single permission
 * - hasAnyPermission(permissions: string[]): boolean — check if user has any of the permissions
 * - hasAllPermissions(permissions: string[]): boolean — check if user has all permissions
 * - loading: boolean — true while fetching permissions
 * - loaded: boolean — true once permissions have been fetched at least once
 * - refetch(): void — manually re-fetch permissions
 */
export { usePermissions } from '../contexts/PermissionContext';
export default null;
