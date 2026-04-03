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

import AdminStudentsPage from "@/app/admin/students/page";

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

describe("admin users card filter behavior", () => {
  beforeEach(() => {
    mocks.showToast.mockReset();
    mocks.loadAuth.mockReturnValue({
      token: "test-token",
      user: { id: "admin-1", role: "admin", adminRole: "super_admin" },
    });

    mocks.authFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith("/api/admin/students")) {
        return {
          students: [
            {
              _id: "u1",
              name: "Alice",
              email: "alice@charusat.edu.in",
              role: "student",
              isActive: true,
              course: "CSE",
            },
            {
              _id: "u2",
              name: "Bob",
              email: "bob@charusat.edu.in",
              role: "faculty",
              isActive: true,
              course: "ME",
            },
            {
              _id: "u3",
              name: "Carol",
              email: "carol@charusat.edu.in",
              role: "student",
              isActive: false,
              course: "CSE",
            },
            {
              _id: "u4",
              name: "Dev",
              email: "dev@charusat.edu.in",
              role: "faculty",
              isActive: false,
              course: "EE",
            },
          ],
        };
      }

      if (endpoint.startsWith("/api/admin/issues")) {
        return {
          issues: [
            { _id: "i1", student: { _id: "u1" } },
            { _id: "i2", student: { _id: "u1" } },
            { _id: "i3", student: { _id: "u2" } },
            { _id: "i4", student: { _id: "u3" } },
            { _id: "i5", student: { _id: "u3" } },
            { _id: "i6", student: { _id: "u3" } },
          ],
        };
      }

      throw new Error(`Unhandled endpoint: ${endpoint}`);
    });
  });

  it("changes card totals only with academic department filter", async () => {
    const user = userEvent.setup();
    render(<AdminStudentsPage />);

    await waitFor(() => {
      expect(getCardValue("Users")).toBe(4);
      expect(getCardValue("Students")).toBe(2);
      expect(getCardValue("Faculty")).toBe(2);
      expect(getCardValue("Active Users")).toBe(2);
      expect(getCardValue("Inactive Users")).toBe(2);
      expect(getCardValue("Issues Raised")).toBe(6);
    });

    await user.click(screen.getByRole("button", { name: "Students" }));
    await user.selectOptions(findSelectByOption("Active Users"), "Inactive");
    await user.type(screen.getByPlaceholderText("Search users by name or email..."), "alice");

    expect(getCardValue("Users")).toBe(4);
    expect(getCardValue("Students")).toBe(2);
    expect(getCardValue("Faculty")).toBe(2);
    expect(getCardValue("Active Users")).toBe(2);
    expect(getCardValue("Inactive Users")).toBe(2);
    expect(getCardValue("Issues Raised")).toBe(6);

    await user.selectOptions(findSelectByOption("Academic Department"), "CSE");

    await waitFor(() => {
      expect(getCardValue("Users")).toBe(2);
      expect(getCardValue("Students")).toBe(2);
      expect(getCardValue("Faculty")).toBe(0);
      expect(getCardValue("Active Users")).toBe(1);
      expect(getCardValue("Inactive Users")).toBe(1);
      expect(getCardValue("Issues Raised")).toBe(5);
    });
  });
});
