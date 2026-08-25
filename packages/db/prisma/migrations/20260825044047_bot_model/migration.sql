-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "modelId" TEXT,
ADD COLUMN     "modelProvider" TEXT;

-- AlterTable
ALTER TABLE "computers" ALTER COLUMN "scope" SET DEFAULT 'team';

-- RenameIndex
ALTER INDEX "action_approval_rules_workspaceId_createdByUserId_effect_matchK" RENAME TO "action_approval_rules_workspaceId_createdByUserId_effect_ma_key";
