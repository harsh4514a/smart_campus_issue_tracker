import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  authenticateRequest: vi.fn(),
  isSuperAdmin: vi.fn(),
  find: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: mocks.connectDB }));
vi.mock("@/lib/auth", () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock("@/lib/rbac", () => ({ isSuperAdmin: mocks.isSuperAdmin }));
vi.mock("@/models/User", () => ({
  default: {
    find: mocks.find,
  },
}));

import { GET } from "@/app/api/admin/students/route";

function buildQueryChain(result: unknown[]) {
  const chain = {
    select: vi.fn(),
    populate: vi.fn(),
    sort: vi.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.populate.mockReturnValue(chain);
  chain.sort.mockResolvedValue(result);

  return chain;
}

describe("admin students status filter API", () => {
  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.authenticateRequest.mockResolvedValue({ user: { role: "admin", adminRole: "super_admin" } });
    mocks.isSuperAdmin.mockReturnValue(true);
    mocks.find.mockReset();
  });

  it("applies active filter in DB query", async () => {
    let capturedQuery: Record<string, unknown> | null = null;
    const chain = buildQueryChain([
      {
        toObject: () => ({ _id: "u1", name: "A", department: null, academicDepartment: null }),
      },
    ]);

    mocks.find.mockImplementation((query: Record<string, unknown>) => {
      capturedQuery = query;
      return chain;
    });

    const response = await GET(new Request("http://localhost/api/admin/students?status=active"));

    expect(response.status).toBe(200);
    expect(capturedQuery).toMatchObject({
      role: { $in: ["student", "faculty"] },
      isActive: { $ne: false },
    });
  });

  it("applies inactive filter in DB query", async () => {
    let capturedQuery: Record<string, unknown> | null = null;
    const chain = buildQueryChain([]);

    mocks.find.mockImplementation((query: Record<string, unknown>) => {
      capturedQuery = query;
      return chain;
    });

    const response = await GET(new Request("http://localhost/api/admin/students?status=inactive"));

    expect(response.status).toBe(200);
    expect(capturedQuery).toMatchObject({
      role: { $in: ["student", "faculty"] },
      isActive: false,
    });
  });

  it("defaults to unscoped status when filter is omitted", async () => {
    let capturedQuery: Record<string, unknown> | null = null;
    const chain = buildQueryChain([]);

    mocks.find.mockImplementation((query: Record<string, unknown>) => {
      capturedQuery = query;
      return chain;
    });

    const response = await GET(new Request("http://localhost/api/admin/students"));

    expect(response.status).toBe(200);
    expect(capturedQuery).toMatchObject({ role: { $in: ["student", "faculty"] } });
    expect(capturedQuery).not.toHaveProperty("isActive");
  });
});
