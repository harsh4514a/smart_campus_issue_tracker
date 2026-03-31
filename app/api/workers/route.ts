import { GET as deptAdminWorkersGET } from "@/app/api/dept-admin/workers/route";

export async function GET(request: Request) {
  return deptAdminWorkersGET(request);
}
