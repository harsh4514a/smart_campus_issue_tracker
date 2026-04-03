import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  authenticateRequest: vi.fn(),
  isSuperAdmin: vi.fn(),
  isDeptAdmin: vi.fn(),
  getAdminDepartmentIds: vi.fn(),
  find: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: mocks.connectDB }));
vi.mock("@/lib/auth", () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock("@/lib/mailer", () => ({ sendPasswordSetupEmail: vi.fn() }));
vi.mock("@/lib/password-setup", () => ({ signPasswordSetupToken: vi.fn() }));
vi.mock("@/lib/rbac", () => ({
  isSuperAdmin: mocks.isSuperAdmin,
  isDeptAdmin: mocks.isDeptAdmin,
  getAdminDepartmentIds: mocks.getAdminDepartmentIds,
}));
vi.mock("@/models/User", () => ({
  default: {
    find: mocks.find,
  },
}));

import { GET } from "@/app/api/admin/staff/route";

function buildQueryChain(result: unknown[]) {
  const chain = {
    populate: vi.fn(),
    sort: vi.fn(),
  };

  chain.populate.mockReturnValue(chain);
  chain.sort.mockResolvedValue(result);

  return chain;
}

describe("admin staff status filter API", () => {
  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.authenticateRequest.mockResolvedValue({ user: { role: "admin", adminRole: "super_admin" } });
    mocks.isSuperAdmin.mockReturnValue(true);
    mocks.isDeptAdmin.mockReturnValue(false);
    mocks.getAdminDepartmentIds.mockReturnValue(["dep-1"]);
    mocks.find.mockReset();
  });

  it("applies active filter for super admin query", async () => {
    let capturedQuery: Record<string, unknown> | null = null;
    const chain = buildQueryChain([]);

    mocks.find.mockImplementation((query: Record<string, unknown>) => {
      capturedQuery = query;
      return chain;
    });

    const response = await GET(new Request("http://localhost/api/admin/staff?status=active"));

    expect(response.status).toBe(200);
    expect(capturedQuery).toMatchObject({ role: "staff", isActive: { $ne: false } });
  });

  it("applies inactive filter for super admin query", async () => {
    let capturedQuery: Record<string, unknown> | null = null;
    const chain = buildQueryChain([]);

    mocks.find.mockImplementation((query: Record<string, unknown>) => {
      capturedQuery = query;
      return chain;
    });

    const response = await GET(new Request("http://localhost/api/admin/staff?status=inactive"));

    expect(response.status).toBe(200);
    expect(capturedQuery).toMatchObject({ role: "staff", isActive: false });
  });

  it("returns forbidden when caller is not super or dept admin", async () => {
    mocks.isSuperAdmin.mockReturnValue(false);
    mocks.isDeptAdmin.mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/admin/staff?status=active"));

    expect(response.status).toBe(403);
  });
});
