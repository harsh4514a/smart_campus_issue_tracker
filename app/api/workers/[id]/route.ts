import { GET as deptAdminWorkerDetailGET } from "@/app/api/dept-admin/workers/[id]/route";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  return deptAdminWorkerDetailGET(request, context);
}
