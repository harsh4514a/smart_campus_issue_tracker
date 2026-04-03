import mongoose from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  authenticateRequest: vi.fn(),
  isSuperAdmin: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: mocks.connectDB }));
vi.mock("@/lib/auth", () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock("@/lib/rbac", () => ({ isSuperAdmin: mocks.isSuperAdmin }));
vi.mock("@/models/User", () => ({
  default: {
    findOneAndUpdate: mocks.findOneAndUpdate,
  },
}));

import { PATCH as activateUser } from "@/app/api/admin/users/[id]/activate/route";
import { PATCH as deactivateUser } from "@/app/api/admin/users/[id]/deactivate/route";

function makeRequest(url: string) {
  return new Request(url, {
    method: "PATCH",
    headers: {
      authorization: "Bearer test-token",
    },
  });
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeQueryResult(value: unknown) {
  return {
    select: vi.fn().mockResolvedValue(value),
  };
}

describe("admin user activate/deactivate routes", () => {
  let objectIdValidSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    objectIdValidSpy = vi.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.authenticateRequest.mockResolvedValue({
      user: { _id: "admin-1", role: "admin", adminRole: "super_admin" },
    });
    mocks.isSuperAdmin.mockReturnValue(true);
    mocks.findOneAndUpdate.mockReset();
  });

  afterEach(() => {
    objectIdValidSpy.mockRestore();
  });

  it("deactivate route rejects invalid id", async () => {
    objectIdValidSpy.mockReturnValue(false);

    const response = await deactivateUser(
      makeRequest("http://localhost/api/admin/users/bad/deactivate"),
      makeContext("bad")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ message: "Invalid user id." });
  });

  it("deactivate route blocks self-deactivation", async () => {
    const response = await deactivateUser(
      makeRequest("http://localhost/api/admin/users/admin-1/deactivate"),
      makeContext("admin-1")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "You cannot deactivate your own account.",
    });
  });

  it("deactivate route updates active flag and audit fields", async () => {
    mocks.findOneAndUpdate.mockReturnValue(
      makeQueryResult({
        _id: "user-1",
        role: "staff",
        isActive: false,
      })
    );

    const response = await deactivateUser(
      makeRequest("http://localhost/api/admin/users/user-1/deactivate"),
      makeContext("user-1")
    );

    expect(response.status).toBe(200);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "user-1", role: { $in: ["student", "faculty", "staff"] } },
      {
        $set: {
          isActive: false,
          deactivatedAt: expect.any(Date),
          deactivatedBy: "admin-1",
        },
      },
      { new: true }
    );
  });

  it("activate route returns 404 when target user is missing", async () => {
    mocks.findOneAndUpdate.mockReturnValue(makeQueryResult(null));

    const response = await activateUser(
      makeRequest("http://localhost/api/admin/users/missing/activate"),
      makeContext("missing")
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ message: "User not found." });
  });

  it("activate route restores active state and clears audit fields", async () => {
    mocks.findOneAndUpdate.mockReturnValue(
      makeQueryResult({
        _id: "user-2",
        role: "student",
        isActive: true,
      })
    );

    const response = await activateUser(
      makeRequest("http://localhost/api/admin/users/user-2/activate"),
      makeContext("user-2")
    );

    expect(response.status).toBe(200);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "user-2", role: { $in: ["student", "faculty", "staff"] } },
      {
        $set: {
          isActive: true,
          deactivatedAt: null,
          deactivatedBy: null,
        },
      },
      { new: true }
    );
  });
});
