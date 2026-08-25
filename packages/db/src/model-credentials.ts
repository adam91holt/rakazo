import type { PrismaClient } from "./client.js";

export const newestModelCredentialOrder = [
  { updatedAt: "desc" as const },
  { createdAt: "desc" as const },
  { id: "desc" as const },
];

/**
 * The credential a bot pinned to its own provider should run on. Falls back to
 * the workspace default so a bot whose provider has no dedicated credential
 * still runs rather than failing.
 */
export function findModelCredentialForProvider(
  prisma: PrismaClient,
  scope: { userId: string; workspaceId: string },
  provider: string | null | undefined,
) {
  if (!provider) return findDefaultModelCredential(prisma, scope);
  return prisma.userModelCredential
    .findFirst({
      where: { userId: scope.userId, workspaceId: scope.workspaceId, provider },
      orderBy: newestModelCredentialOrder,
    })
    .then((match) => match ?? findDefaultModelCredential(prisma, scope));
}

export function findDefaultModelCredential(
  prisma: PrismaClient,
  scope: { userId: string; workspaceId: string },
) {
  return prisma.userModelCredential.findFirst({
    where: { userId: scope.userId, workspaceId: scope.workspaceId, isDefault: true },
    orderBy: newestModelCredentialOrder,
  });
}
