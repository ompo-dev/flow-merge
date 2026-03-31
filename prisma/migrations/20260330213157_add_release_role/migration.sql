-- CreateEnum
CREATE TYPE "ReleaseRole" AS ENUM ('stable', 'beta', 'internal');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "releaseRole" "ReleaseRole" NOT NULL DEFAULT 'stable';
