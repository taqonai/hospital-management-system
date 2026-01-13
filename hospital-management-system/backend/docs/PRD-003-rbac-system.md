# Role-Based Access Control (RBAC) System - Product Requirements Document

## Document Info
- **Version**: 1.0
- **Last Updated**: 2026-01-12
- **Status**: Current Implementation
- **Module**: Authorization & Access Control

---

## 1. Overview

### 1.1 Purpose
The RBAC system provides granular permission management beyond basic role-based authorization. It allows hospitals to create custom roles with specific permissions, assign multiple roles to users, and audit permission changes for compliance.

### 1.2 Scope
This PRD covers:
- Default role-based authorization (17 system roles)
- Custom role creation and management
- Granular permission assignment (module:action format)
- User permission assignment and checking
- Permission audit logging
- SUPER_ADMIN bypass logic

### 1.3 Background
Healthcare organizations require fine-grained access control for HIPAA compliance. While system roles (DOCTOR, NURSE, etc.) provide baseline permissions, hospitals need flexibility to create custom roles (e.g., "Senior Nurse" with additional lab access) and assign specific permissions to individual users.

---

## 2. User Stories

### 2.1 Primary User Stories

**US-001: View User Permissions**
> As an administrator, I want to see all permissions assigned to a user so I can audit their access level.

**Acceptance Criteria:**
- Display all permissions (from default role + custom roles + individual)
- Show source of each permission (role name or individual)
- Include effective vs. denied permissions

**US-002: Create Custom Role**
> As an administrator, I want to create custom roles with specific permissions so I can tailor access to hospital needs.

**Acceptance Criteria:**
- Specify role name and description
- Select permissions from available modules
- Role scoped to hospital (multi-tenant)
- Role immediately available for assignment

**US-003: Assign Custom Role**
> As an administrator, I want to assign custom roles to users so they inherit the role's permissions.

**Acceptance Criteria:**
- User can have multiple custom roles
- Combined permissions from all roles
- Role removal revokes associated permissions

**US-004: Grant Individual Permission**
> As an administrator, I want to grant specific permissions to a user without changing their role.

**Acceptance Criteria:**
- Permission added to user's effective permissions
- Does not affect other users with same role
- Can be revoked independently

**US-005: View Audit Log**
> As an administrator, I want to see permission change history for compliance auditing.

**Acceptance Criteria:**
- Log captures who, what, when for all permission changes
- Searchable by user, permission, or date
- Includes role assignments and individual grants

### 2.2 Edge Cases

**EC-001: Permission Conflicts**
- Explicit deny takes precedence over allow
- Most specific permission wins

**EC-002: Role Deletion**
- Cannot delete role if users are assigned
- Must reassign or remove users first

**EC-003: Self-Modification Prevention**
- Users cannot modify their own permissions
- SUPER_ADMIN can modify anyone

---

## 3. Acceptance Criteria

### 3.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | System shall enforce 17 default user roles | Must |
| FR-002 | System shall support custom role creation | Must |
| FR-003 | System shall support granular permission assignment | Must |
| FR-004 | System shall combine permissions from multiple sources | Must |
| FR-005 | SUPER_ADMIN shall bypass all permission checks | Must |
| FR-006 | System shall log all permission changes | Must |
| FR-007 | System shall support permission revocation | Must |
| FR-008 | System shall validate permission format (module:action) | Should |

### 3.2 Non-Functional Requirements

**Performance:**
- Permission check < 100ms (cached)
- Permission list retrieval < 500ms

**Security:**
- Audit logs immutable (append-only)
- Permission changes require admin role

**Compliance:**
- HIPAA audit trail requirements
- SOC 2 access control documentation

---

## 4. Technical Specifications

### 4.1 Backend Layer

**API Endpoints:**

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/rbac/roles` | List all custom roles | Admin |
| POST | `/api/v1/rbac/roles` | Create custom role | Admin |
| GET | `/api/v1/rbac/roles/:id` | Get role details | Admin |
| PUT | `/api/v1/rbac/roles/:id` | Update role | Admin |
| DELETE | `/api/v1/rbac/roles/:id` | Delete role | Admin |
| GET | `/api/v1/rbac/permissions` | List all available permissions | Admin |
| GET | `/api/v1/rbac/users/:userId/permissions` | Get user's effective permissions | Admin |
| POST | `/api/v1/rbac/users/:userId/roles` | Assign role to user | Admin |
| DELETE | `/api/v1/rbac/users/:userId/roles/:roleId` | Remove role from user | Admin |
| POST | `/api/v1/rbac/users/:userId/permissions` | Grant individual permission | Admin |
| DELETE | `/api/v1/rbac/users/:userId/permissions/:permission` | Revoke permission | Admin |
| GET | `/api/v1/rbac/audit-log` | View permission change log | Admin |

**Permission Format:**
```
{module}:{action}

Examples:
- patients:read
- patients:write
- patients:delete
- appointments:manage
- laboratory:results
- laboratory:orders
- pharmacy:dispense
- billing:read
- billing:refund
- reports:generate
- admin:users
- admin:settings
```

**Available Modules:**
```typescript
const MODULES = [
  'patients',
  'appointments',
  'doctors',
  'departments',
  'laboratory',
  'radiology',
  'pharmacy',
  'billing',
  'hr',
  'reports',
  'admin',
  'ai',
  'emergency',
  'ipd',
  'opd',
  'surgery',
  'blood-bank',
  'dietary',
  'housekeeping',
  'assets',
  'quality',
];

const ACTIONS = ['read', 'write', 'delete', 'manage', 'approve', 'dispense', 'results'];
```

**Service Layer:**
- **File:** `backend/src/services/rbacService.ts`
- **Methods:**
  - `hasPermission(userId, permission)` - Check single permission
  - `getUserPermissions(userId)` - Get all effective permissions
  - `createRole(data)` - Create custom role
  - `assignRoleToUser(userId, roleId)` - Assign role
  - `grantPermission(userId, permission)` - Grant individual permission
  - `getAuditLog(filters)` - Query audit log

**Middleware:**
```typescript
// backend/src/middleware/rbac.ts

// Single permission check
export const requirePermission = (permission: string) => { ... }

// Any of multiple permissions
export const requireAnyPermission = (...permissions: string[]) => { ... }

// All permissions required
export const requireAllPermissions = (...permissions: string[]) => { ... }

// Attach permissions to request
export const attachPermissions = async (req, res, next) => { ... }
```

### 4.2 Data Models

```prisma
model CustomRole {
  id          String   @id @default(uuid())
  name        String
  description String?
  hospitalId  String
  hospital    Hospital @relation(fields: [hospitalId], references: [id])
  permissions RolePermission[]
  users       UserCustomRole[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([hospitalId, name])
}

model RolePermission {
  id         String     @id @default(uuid())
  roleId     String
  role       CustomRole @relation(fields: [roleId], references: [id])
  permission String     // Format: "module:action"
  createdAt  DateTime   @default(now())

  @@unique([roleId, permission])
}

model UserCustomRole {
  id        String     @id @default(uuid())
  userId    String
  user      User       @relation(fields: [userId], references: [id])
  roleId    String
  role      CustomRole @relation(fields: [roleId], references: [id])
  grantedBy String
  grantedAt DateTime   @default(now())

  @@unique([userId, roleId])
}

model UserPermission {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  permission String   // Format: "module:action"
  grantedBy  String
  grantedAt  DateTime @default(now())

  @@unique([userId, permission])
}

model RBACAuditLog {
  id          String   @id @default(uuid())
  hospitalId  String
  userId      String   // User affected
  action      String   // GRANT_PERMISSION, REVOKE_PERMISSION, ASSIGN_ROLE, etc.
  permission  String?
  roleId      String?
  performedBy String   // Admin who made change
  details     Json?
  createdAt   DateTime @default(now())
}
```

### 4.3 Frontend Layer

**Pages:**
- `frontend/src/pages/RBAC/index.tsx` - RBAC management dashboard
- Role list, user permissions view, audit log

**Components:**
- `frontend/src/components/rbac/RoleCard.tsx` - Role display card
- `frontend/src/components/rbac/PermissionGrid.tsx` - Permission matrix
- `frontend/src/components/rbac/UserRoleManager.tsx` - User role assignment
- `frontend/src/components/rbac/AuditLogTable.tsx` - Audit log display

### 4.4 Permission Calculation

```typescript
async getUserPermissions(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customRoles: { include: { role: { include: { permissions: true } } } },
      permissions: true,
    },
  });

  const permissions = new Set<string>();

  // 1. Default permissions from system role
  const defaultPerms = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  defaultPerms.forEach(p => permissions.add(p));

  // 2. Permissions from custom roles
  user.customRoles.forEach(ucr => {
    ucr.role.permissions.forEach(rp => permissions.add(rp.permission));
  });

  // 3. Individual user permissions
  user.permissions.forEach(up => permissions.add(up.permission));

  return Array.from(permissions);
}
```

---

## 5. Dependencies

### 5.1 Internal Dependencies
- User entity and roles
- Hospital entity for scoping
- Authentication middleware

### 5.2 External Dependencies
None - pure application logic

---

## 6. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Over-permissioning | Medium | High | Regular access reviews, principle of least privilege |
| Permission sprawl | Medium | Medium | Clear permission naming, documentation |
| Audit log tampering | Low | Critical | Append-only log, database triggers |

---

## 7. Testing Strategy

### 7.1 Unit Tests
- Permission format validation
- Permission combination logic
- SUPER_ADMIN bypass

### 7.2 Integration Tests
```typescript
describe('RBAC', () => {
  it('should check permission correctly', async () => {
    const hasAccess = await rbacService.hasPermission(userId, 'patients:read');
    expect(hasAccess).toBe(true);
  });

  it('should combine permissions from multiple roles', async () => {
    const permissions = await rbacService.getUserPermissions(userId);
    expect(permissions).toContain('patients:read');
    expect(permissions).toContain('laboratory:orders');
  });

  it('SUPER_ADMIN should bypass checks', async () => {
    // ... implementation
  });
});
```

---

## 8. File References

### Backend
- `backend/src/routes/rbacRoutes.ts` - Route definitions
- `backend/src/services/rbacService.ts` - Business logic
- `backend/src/middleware/rbac.ts` - Permission middleware

### Frontend
- `frontend/src/pages/RBAC/index.tsx` - RBAC management
- `frontend/src/components/rbac/*` - RBAC components

### Database
- `backend/prisma/schema.prisma` - CustomRole, RolePermission, UserPermission, RBACAuditLog models
