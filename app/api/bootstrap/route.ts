import { auth } from "@clerk/nextjs/server";

import { ensurePersonalWorkspaceForAuthUser } from "@/lib/workspace-bootstrap";

export const runtime = "nodejs";

function hasClerkConfig() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export async function POST() {
  if (!hasClerkConfig()) {
    return Response.json({ error: "Clerk is not configured." }, { status: 503 });
  }

  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const context = await ensurePersonalWorkspaceForAuthUser({ authUserId: userId });

  return Response.json({
    userId: context.userId,
    workspaceId: context.workspaceId,
    role: context.role,
  });
}
