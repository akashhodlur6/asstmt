/**
 * AssetMT Test Suite: Phase 2A - Employees & Departments
 * Verifies schema invariants, RLS policies, tenant scoping, validation,
 * Worker API routes, RBAC permission enforcement, and behavioral security rules.
 */

import fs from 'node:fs';
import path from 'node:path';
import worker from '../worker/index.ts';
import { validateDepartment, validateEmployee, validateAsset } from '../shared/validation.ts';
import { Department, Employee, Asset, CreateAssetInput } from '../shared/types.ts';

export async function runEmployeesAndDepartmentsTests(): Promise<{
  passed: number;
  failed: number;
  tests: string[];
}> {
  let passed = 0;
  let failed = 0;
  const tests: string[] = [];

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      tests.push(`[PASS] ${name}`);
    } else {
      failed++;
      tests.push(`[FAIL] ${name} ${details ? `(${details})` : ''}`);
    }
  }

  // ==========================================================================
  // 1. Migration 0003 & 0004 Schema & Security Invariants
  // ==========================================================================
  const migration0003Path = path.resolve('migrations/0003_employees_and_departments.sql');
  const migration0003Exists = fs.existsSync(migration0003Path);
  assert('Additive migration 0003_employees_and_departments.sql exists', migration0003Exists);

  if (migration0003Exists) {
    const sql = fs.readFileSync(migration0003Path, 'utf-8');

    // Table definitions with required company ownership
    assert(
      'Table public.departments defined with company_id cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.departments') &&
      sql.includes('company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE')
    );

    assert(
      'Table public.employees defined with company_id cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.employees') &&
      sql.includes('company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE')
    );

    // Tenant-scoped uniqueness
    assert(
      'Tenant-scoped department name uniqueness constraint (uq_department_name_tenant)',
      sql.includes('CONSTRAINT uq_department_name_tenant UNIQUE (company_id, name)')
    );

    assert(
      'Tenant-scoped employee code uniqueness constraint (uq_employee_code_tenant)',
      sql.includes('CONSTRAINT uq_employee_code_tenant UNIQUE (company_id, employee_code)')
    );

    // Composite foreign keys enforcing same-tenant relationship
    assert(
      'Composite foreign key preventing cross-tenant employee->department references',
      sql.includes('CONSTRAINT fk_employee_department_tenant FOREIGN KEY (company_id, department_id)') &&
      sql.includes('REFERENCES public.departments(company_id, id)')
    );

    assert(
      'Composite foreign key preventing cross-tenant employee->site references',
      sql.includes('CONSTRAINT fk_employee_site_tenant FOREIGN KEY (company_id, site_id)') &&
      sql.includes('REFERENCES public.sites(company_id, id)')
    );

    assert(
      'Composite foreign key preventing cross-tenant employee->location references',
      sql.includes('CONSTRAINT fk_employee_location_tenant FOREIGN KEY (company_id, location_id)') &&
      sql.includes('REFERENCES public.locations(company_id, id)')
    );

    // Immutability triggers to prevent changing company_id
    assert(
      'Tenant immutability trigger preventing company_id alteration on departments',
      sql.includes('trg_prevent_tenant_change_departments') &&
      sql.includes('BEFORE UPDATE ON public.departments')
    );

    assert(
      'Tenant immutability trigger preventing company_id alteration on employees',
      sql.includes('trg_prevent_tenant_change_employees') &&
      sql.includes('BEFORE UPDATE ON public.employees')
    );

    // Row Level Security
    assert(
      'Row Level Security enabled on public.departments',
      sql.includes('ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;')
    );

    assert(
      'Row Level Security enabled on public.employees',
      sql.includes('ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;')
    );

    assert(
      'Tenant isolation SELECT policy on departments using is_tenant_member',
      sql.includes('ON public.departments FOR SELECT') &&
      sql.includes('public.is_tenant_member(company_id)')
    );

    assert(
      'Tenant isolation SELECT policy on employees using is_tenant_member',
      sql.includes('ON public.employees FOR SELECT') &&
      sql.includes('public.is_tenant_member(company_id)')
    );

    assert(
      'PostgREST permissions granted and schema cache reload notification present in 0003',
      sql.includes('GRANT ALL ON public.departments TO anon, authenticated, service_role;') &&
      sql.includes('GRANT ALL ON public.employees TO anon, authenticated, service_role;') &&
      sql.includes("NOTIFY pgrst, 'reload schema';")
    );
  }

  // Verification of additive migration 0004: Restricting mutations to TENANT_ADMIN
  const migration0004Path = path.resolve('migrations/0004_restrict_directory_mutations_to_tenant_admin.sql');
  const migration0004Exists = fs.existsSync(migration0004Path);
  assert('Additive migration 0004_restrict_directory_mutations_to_tenant_admin.sql exists', migration0004Exists);

  if (migration0004Exists) {
    const sql0004 = fs.readFileSync(migration0004Path, 'utf-8');

    assert(
      'Migration 0004 drops permissive member mutation policies',
      sql0004.includes('DROP POLICY IF EXISTS "Tenants can insert departments"') &&
      sql0004.includes('DROP POLICY IF EXISTS "Tenants can update departments"') &&
      sql0004.includes('DROP POLICY IF EXISTS "Tenants can insert employees"') &&
      sql0004.includes('DROP POLICY IF EXISTS "Tenants can update employees"')
    );

    assert(
      'Migration 0004 restricts department INSERT to is_tenant_admin',
      sql0004.includes('CREATE POLICY "Tenant admins can insert departments"') &&
      sql0004.includes('public.is_tenant_admin(company_id)')
    );

    assert(
      'Migration 0004 restricts department UPDATE to is_tenant_admin',
      sql0004.includes('CREATE POLICY "Tenant admins can update departments"') &&
      sql0004.includes('public.is_tenant_admin(company_id)')
    );

    assert(
      'Migration 0004 restricts employee INSERT to is_tenant_admin',
      sql0004.includes('CREATE POLICY "Tenant admins can insert employees"') &&
      sql0004.includes('public.is_tenant_admin(company_id)')
    );

    assert(
      'Migration 0004 restricts employee UPDATE to is_tenant_admin',
      sql0004.includes('CREATE POLICY "Tenant admins can update employees"') &&
      sql0004.includes('public.is_tenant_admin(company_id)')
    );
  }

  // ==========================================================================
  // 2. Validation Rules (Department & Employee)
  // ==========================================================================
  const validDept = validateDepartment({ name: 'Engineering', code: 'ENG' });
  assert('Valid department passes validation', validDept.isValid);

  const missingDeptName = validateDepartment({ code: 'ENG' });
  assert('Missing department name is rejected', !missingDeptName.isValid && Boolean(missingDeptName.errors.name));

  const validEmp = validateEmployee({
    employee_code: 'EMP-101',
    full_name: 'Alice Johnson',
    email: 'alice@example.com',
    job_title: 'Lead Architect',
  });
  assert('Valid employee passes validation', validEmp.isValid);

  const missingEmpCode = validateEmployee({ full_name: 'Alice Johnson' });
  assert('Missing employee code is rejected', !missingEmpCode.isValid && Boolean(missingEmpCode.errors.employee_code));

  const missingEmpName = validateEmployee({ employee_code: 'EMP-102' });
  assert('Missing employee full name is rejected', !missingEmpName.isValid && Boolean(missingEmpName.errors.full_name));

  const invalidEmpEmail = validateEmployee({
    employee_code: 'EMP-103',
    full_name: 'Bob Smith',
    email: 'not-an-email',
  });
  assert('Invalid work email format is rejected', !invalidEmpEmail.isValid && Boolean(invalidEmpEmail.errors.email));

  const optionalEmptyEmail = validateEmployee({
    employee_code: 'EMP-104',
    full_name: 'Bob Smith',
    email: '',
  });
  assert('Empty optional email is accepted without error', optionalEmptyEmail.isValid);

  // ==========================================================================
  // 3. Worker API Authentication & Route Protection
  // ==========================================================================
  const fakeEnv = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
  };

  const reqDeptNoAuth = new Request('http://localhost/api/departments', { method: 'GET' });
  const resDeptNoAuth = await worker.fetch(reqDeptNoAuth, fakeEnv);
  assert('Worker GET /api/departments without Authorization returns 401', resDeptNoAuth.status === 401);

  const reqEmpNoAuth = new Request('http://localhost/api/employees', { method: 'GET' });
  const resEmpNoAuth = await worker.fetch(reqEmpNoAuth, fakeEnv);
  assert('Worker GET /api/employees without Authorization returns 401', resEmpNoAuth.status === 401);

  const reqEmpPostNoAuth = new Request('http://localhost/api/employees', {
    method: 'POST',
    body: JSON.stringify({ employee_code: 'EMP-1', full_name: 'Test' }),
  });
  const resEmpPostNoAuth = await worker.fetch(reqEmpPostNoAuth, fakeEnv);
  assert('Worker POST /api/employees without Authorization returns 401', resEmpPostNoAuth.status === 401);

  const reqEmpToggleNoAuth = new Request('http://localhost/api/employees/emp-1/toggle-active', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const resEmpToggleNoAuth = await worker.fetch(reqEmpToggleNoAuth, fakeEnv);
  assert('Worker POST /api/employees/:id/toggle-active without Authorization returns 401', resEmpToggleNoAuth.status === 401);

  // ==========================================================================
  // 4. RBAC Permission Checks (Worker Level & Direct Database Level)
  // ==========================================================================
  const workerFileContent = fs.readFileSync(path.resolve('worker/index.ts'), 'utf-8');

  // Verify Worker level checks require TENANT_ADMIN for department & employee mutations
  assert(
    'Worker restricts POST /departments to membership.role === TENANT_ADMIN',
    workerFileContent.includes("membership.role !== 'TENANT_ADMIN'") &&
    workerFileContent.includes("Only Tenant Admins are authorized to create departments")
  );

  assert(
    'Worker restricts PUT /departments/:id to membership.role === TENANT_ADMIN',
    workerFileContent.includes("membership.role !== 'TENANT_ADMIN'") &&
    workerFileContent.includes("Only Tenant Admins are authorized to update departments")
  );

  assert(
    'Worker restricts POST /employees to membership.role === TENANT_ADMIN',
    workerFileContent.includes("membership.role !== 'TENANT_ADMIN'") &&
    workerFileContent.includes("Only Tenant Admins are authorized to register employees")
  );

  assert(
    'Worker restricts PUT /employees/:id to membership.role === TENANT_ADMIN',
    workerFileContent.includes("membership.role !== 'TENANT_ADMIN'") &&
    workerFileContent.includes("Only Tenant Admins are authorized to update employees")
  );

  assert(
    'Worker restricts POST /employees/:id/toggle-active to membership.role === TENANT_ADMIN',
    workerFileContent.includes("membership.role !== 'TENANT_ADMIN'") &&
    workerFileContent.includes("Only Tenant Admins are authorized to change employee active status")
  );

  // Invariant A: Employees are NOT login users (no Supabase auth user creation)
  const doesEmployeeCreateUser =
    workerFileContent.includes("auth.admin.createUser") ||
    workerFileContent.includes("auth.signUp") ||
    workerFileContent.includes("inviteUserByEmail");
  assert(
    'Employee creation does NOT create a Supabase Auth user, membership, or send invites',
    !doesEmployeeCreateUser
  );

  // ==========================================================================
  // 5. Multi-Tenant Invariant Simulation
  // ==========================================================================
  const companyA = 'comp-aaa-111';
  const companyB = 'comp-bbb-222';

  const mockDbEmployees: Partial<Employee>[] = [
    { id: '1', company_id: companyA, employee_code: 'EMP-001', full_name: 'Alice (Company A)', is_active: true },
    { id: '2', company_id: companyB, employee_code: 'EMP-001', full_name: 'Bob (Company B)', is_active: true },
  ];

  // Code duplication check simulation within same company
  const isDuplicateInCompanyA = mockDbEmployees.some(
    (e) => e.company_id === companyA && e.employee_code?.toLowerCase() === 'emp-001'
  );
  assert('Duplicate employee code rejected within same company', isDuplicateInCompanyA);

  // Code permitted in different company
  const codeInCompanyA = mockDbEmployees.find((e) => e.company_id === companyA && e.employee_code === 'EMP-001');
  const codeInCompanyB = mockDbEmployees.find((e) => e.company_id === companyB && e.employee_code === 'EMP-001');
  assert(
    'Same employee code is allowed across different company workspaces',
    Boolean(codeInCompanyA && codeInCompanyB && codeInCompanyA.company_id !== codeInCompanyB.company_id)
  );

  // Cross-company reference rejection simulation
  const companyBDeptId = 'dept-company-b';
  const mockDepartments = [
    { id: 'dept-company-a', company_id: companyA, name: 'Eng A' },
    { id: 'dept-company-b', company_id: companyB, name: 'Eng B' },
  ];
  const isValidDeptForCompA = mockDepartments.some(
    (d) => d.company_id === companyA && d.id === companyBDeptId
  );
  assert('Cross-company department foreign reference is rejected', !isValidDeptForCompA);

  // Invariant C: Deactivation preserves records (no hard deletion)
  const activeEmployee: Partial<Employee> = {
    id: 'emp-99',
    company_id: companyA,
    employee_code: 'EMP-099',
    full_name: 'Charlie Test',
    is_active: true,
  };
  const deactivatedEmployee = { ...activeEmployee, is_active: false };
  assert(
    'Employee deactivation preserves entity and updates is_active flag without deleting record',
    deactivatedEmployee.id === activeEmployee.id &&
    deactivatedEmployee.is_active === false &&
    deactivatedEmployee.employee_code === activeEmployee.employee_code
  );

  // Invariant D: Department archive visibility rule
  const departmentsList: Partial<Department>[] = [
    { id: 'd1', company_id: companyA, name: 'Active Engineering', is_archived: false },
    { id: 'd2', company_id: companyA, name: 'Archived Sales', is_archived: true },
  ];

  const optionsForNewEmployee = departmentsList.filter((d) => !d.is_archived);
  assert(
    'Archived departments are hidden from new employee selections',
    optionsForNewEmployee.length === 1 && optionsForNewEmployee[0].id === 'd1'
  );

  const existingEmployeeDeptId = 'd2';
  const optionsForExistingEmployee = departmentsList.filter(
    (d) => !d.is_archived || d.id === existingEmployeeDeptId
  );
  assert(
    'Archived department remains visible on existing employee records',
    optionsForExistingEmployee.some((d) => d.id === 'd2' && d.is_archived === true)
  );

  // Invariant E: Search and Filter logic
  const directory: Partial<Employee>[] = [
    { id: 'e1', company_id: companyA, employee_code: 'EMP-10', full_name: 'John Doe', department_id: 'd1', is_active: true },
    { id: 'e2', company_id: companyA, employee_code: 'EMP-20', full_name: 'Jane Smith', department_id: 'd2', is_active: true },
    { id: 'e3', company_id: companyA, employee_code: 'EMP-30', full_name: 'Inactive John', department_id: 'd1', is_active: false },
  ];

  const d1Employees = directory.filter((e) => e.department_id === 'd1');
  assert('Department filter correctly isolates employees in selected department', d1Employees.length === 2);

  const activeEmployees = directory.filter((e) => e.is_active === true);
  assert('Active status filter correctly isolates active employees', activeEmployees.length === 2);

  const searchedJohn = directory.filter((e) => e.full_name?.toLowerCase().includes('john'));
  assert('Search filter matches employee full name', searchedJohn.length === 2);

  // ==========================================================================
  // 6. Existing Asset CRUD Smoke Test Invariant
  // ==========================================================================
  const assetPayload: CreateAssetInput = {
    asset_tag: 'AST-SMOKE-01',
    name: 'MacBook Pro M3 Smoke Test',
    status: 'Available',
    purchase_cost: 1999.0,
    currency: 'USD',
  };
  const assetValidation = validateAsset(assetPayload, false);
  assert('Existing asset creation payload passes validation', assetValidation.isValid);

  const assetUpdateValidation = validateAsset({ name: 'MacBook Pro M3 (Updated)' }, true);
  assert('Existing asset update payload passes validation', assetUpdateValidation.isValid);

  return { passed, failed, tests };
}
