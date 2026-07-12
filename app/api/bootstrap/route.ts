import { auth } from "@clerk/nextjs/server";

import { ensurePersonalWorkspaceForAuthUser } from "@/lib/workspace-bootstrap";

export const runtime = "nodejs";

function hasClerkConfig() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export async function POST() {
  if (!hasClerkConfig()) {
    console.warn("[bootstrap] Clerk is not configured.");
    return Response.json({ error: "Clerk is not configured." }, { status: 503 });
  }

  const { userId } = await auth();

  if (!userId) {
    console.warn("[bootstrap] Authentication required.");
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const context = await ensurePersonalWorkspaceForAuthUser({ authUserId: userId });

    console.info("[bootstrap] Personal workspace ready.", {
      userId: context.userId,
      workspaceId: context.workspaceId,
      role: context.role,
    });

    return Response.json({
      userId: context.userId,
      workspaceId: context.workspaceId,
      role: context.role,
    });
  } catch (error) {
    console.error("[bootstrap] Failed to initialize personal workspace.", error);
    return Response.json({ error: "Failed to initialize workspace." }, { status: 500 });
  }
}
