import DeptAdminProtected from "@/components/dept-admin/DeptAdminProtected";

export default function DeptAdminLayout({ children }: { children: React.ReactNode }) {
  return <DeptAdminProtected>{children}</DeptAdminProtected>;
}
