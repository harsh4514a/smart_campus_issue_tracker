// @vitest-environment jsdom

import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  loadAuth: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/lib/client-auth", () => ({
  authFetch: mocks.authFetch,
  loadAuth: mocks.loadAuth,
}));

vi.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("@/components/AdminProtected", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/admin/AdminShell", () => ({
  default: ({
    title,
    subtitle,
    headerActions,
    children,
  }: {
    title: string;
    subtitle?: string;
    headerActions?: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {headerActions}
      <div>{children}</div>
    </div>
  ),
}));

import AdminStaffPage from "@/app/admin/staff/page";

function getCardValue(label: string) {
  const labelNode = screen.getAllByText(label).find((node) => node.closest("article"));
  const card = labelNode?.closest("article");
  if (!card) {
    throw new Error(`Card not found for label: ${label}`);
  }

  const numericText = Array.from(card.querySelectorAll("p"))
    .map((node) => node.textContent?.trim() || "")
    .find((text) => /^\d+$/.test(text));

  if (!numericText) {
    throw new Error(`Numeric value not found for card: ${label}`);
  }

  return Number(numericText);
}

function findSelectByOption(optionLabel: string) {
  const select = screen
    .getAllByRole("combobox")
    .find((node) => Array.from((node as HTMLSelectElement).options).some((opt) => opt.text === optionLabel));

  if (!select) {
    throw new Error(`Select not found for option: ${optionLabel}`);
  }

  return select as HTMLSelectElement;
}

describe("admin staff card filter behavior", () => {
  beforeEach(() => {
    mocks.showToast.mockReset();
    mocks.loadAuth.mockReturnValue({
      token: "test-token",
      user: { id: "admin-1", role: "admin", adminRole: "super_admin" },
    });

    mocks.authFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith("/api/admin/departments")) {
        return {
          departments: [
            { _id: "a1", name: "CSE", type: "Academic" },
            { _id: "a2", name: "ME", type: "Academic" },
            { _id: "s1", name: "Electrical", type: "Service" },
            { _id: "s2", name: "Network", type: "Service" },
          ],
        };
      }

      if (endpoint.startsWith("/api/admin/staff")) {
        return {
          faculty: [
            {
              _id: "st1",
              name: "Staff One",
              email: "st1@charusat.edu.in",
              isActive: true,
              managedDepartments: [{ _id: "a1", name: "CSE", type: "Academic" }],
              serviceDepartment: { _id: "s1", name: "Electrical", type: "Service" },
            },
            {
              _id: "st2",
              name: "Staff Two",
              email: "st2@charusat.edu.in",
              isActive: false,
              managedDepartments: [{ _id: "a1", name: "CSE", type: "Academic" }],
              serviceDepartment: { _id: "s2", name: "Network", type: "Service" },
            },
            {
              _id: "st3",
              name: "Staff Three",
              email: "st3@charusat.edu.in",
              isActive: true,
              managedDepartments: [{ _id: "a2", name: "ME", type: "Academic" }],
              serviceDepartment: { _id: "s1", name: "Electrical", type: "Service" },
            },
          ],
        };
      }

      if (endpoint.startsWith("/api/admin/issues")) {
        return {
          issues: [
            { _id: "i1", status: "Pending", assignedStaff: { _id: "st1" } },
            { _id: "i2", status: "In Progress", assignedStaff: { _id: "st1" } },
            { _id: "i3", status: "Pending", assignedStaff: { _id: "st2" } },
            { _id: "i4", status: "Pending", assignedStaff: { _id: "st2" } },
            { _id: "i5", status: "Pending", assignedStaff: { _id: "st2" } },
            { _id: "i6", status: "Pending", assignedStaff: { _id: "st2" } },
            { _id: "i7", status: "Pending", assignedStaff: { _id: "st2" } },
            { _id: "i8", status: "Pending", assignedStaff: { _id: "st2" } },
          ],
        };
      }

      throw new Error(`Unhandled endpoint: ${endpoint}`);
    });
  });

  it("changes card totals by academic and service filters only", async () => {
    const user = userEvent.setup();
    render(<AdminStaffPage />);

    await waitFor(() => {
      expect(getCardValue("Total Staff")).toBe(3);
      expect(getCardValue("Active Staff")).toBe(2);
      expect(getCardValue("Inactive Staff")).toBe(1);
      expect(getCardValue("Overloaded")).toBe(1);
      expect(getCardValue("Capacity")).toBe(1);
    });

    await user.selectOptions(findSelectByOption("Active Staff"), "Inactive");
    await user.type(screen.getByPlaceholderText("Search staff by name or email..."), "Staff One");

    expect(getCardValue("Total Staff")).toBe(3);
    expect(getCardValue("Active Staff")).toBe(2);
    expect(getCardValue("Inactive Staff")).toBe(1);

    await user.selectOptions(findSelectByOption("All Academic Departments"), "a1");

    await waitFor(() => {
      expect(getCardValue("Total Staff")).toBe(2);
      expect(getCardValue("Active Staff")).toBe(1);
      expect(getCardValue("Inactive Staff")).toBe(1);
      expect(getCardValue("Overloaded")).toBe(1);
      expect(getCardValue("Capacity")).toBe(0);
    });

    await user.selectOptions(findSelectByOption("All Service Departments"), "s1");

    await waitFor(() => {
      expect(getCardValue("Total Staff")).toBe(1);
      expect(getCardValue("Active Staff")).toBe(1);
      expect(getCardValue("Inactive Staff")).toBe(0);
      expect(getCardValue("Overloaded")).toBe(0);
      expect(getCardValue("Capacity")).toBe(0);
    });
  });
});
