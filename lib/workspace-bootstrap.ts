import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { users, workspaceMembers, workspaces } from "@/db/schema";

const AUTH_PROVIDER = "clerk";

export type BootstrappedWorkspace = {
  userId: string;
  workspaceId: string;
  membershipId: string;
  role: "owner";
};

export async function ensurePersonalWorkspaceForAuthUser({
  authUserId,
  displayName,
}: {
  authUserId: string;
  displayName?: string | null;
}): Promise<BootstrappedWorkspace> {
  return db.transaction(async (tx) => {
    const [insertedUser] = await tx
      .insert(users)
      .values({
        authProvider: AUTH_PROVIDER,
        authUserId,
        displayName: displayName ?? null,
      })
      .onConflictDoNothing({
        target: [users.authProvider, users.authUserId],
      })
      .returning();

    const user =
      insertedUser ??
      (
        await tx
          .select()
          .from(users)
          .where(and(eq(users.authProvider, AUTH_PROVIDER), eq(users.authUserId, authUserId)))
          .limit(1)
      )[0];

    if (!user) throw new Error("Failed to initialize user.");

    const [insertedWorkspace] = await tx
      .insert(workspaces)
      .values({
        name: "Personal",
        type: "personal",
        createdByUserId: user.id,
        personalOwnerUserId: user.id,
        timezone: user.timezone,
      })
      .onConflictDoNothing({
        target: workspaces.personalOwnerUserId,
        where: sql`${workspaces.type} = 'personal'`,
      })
      .returning();

    const workspace =
      insertedWorkspace ??
      (
        await tx
          .select()
          .from(workspaces)
          .where(and(eq(workspaces.type, "personal"), eq(workspaces.personalOwnerUserId, user.id)))
          .limit(1)
      )[0];

    if (!workspace) throw new Error("Failed to initialize personal workspace.");

    const [insertedMembership] = await tx
      .insert(workspaceMembers)
      .values({
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner",
      })
      .onConflictDoNothing({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      })
      .returning();

    const membership =
      insertedMembership ??
      (
        await tx
          .select()
          .from(workspaceMembers)
          .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id)))
          .limit(1)
      )[0];

    if (!membership || membership.role !== "owner") {
      throw new Error("Failed to initialize owner membership.");
    }

    return {
      userId: user.id,
      workspaceId: workspace.id,
      membershipId: membership.id,
      role: "owner",
    };
  });
}
