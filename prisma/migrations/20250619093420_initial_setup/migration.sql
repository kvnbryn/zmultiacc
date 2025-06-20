-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ZepetoAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "zepetoEmail" TEXT NOT NULL,
    "displayName" TEXT,
    "username" TEXT,
    "profilePic" TEXT,
    "encryptedZepetoPassword" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastValidatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ZepetoAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ZepetoAccount" ("createdAt", "displayName", "encryptedZepetoPassword", "id", "name", "profilePic", "userId", "username", "zepetoEmail") SELECT "createdAt", "displayName", "encryptedZepetoPassword", "id", "name", "profilePic", "userId", "username", "zepetoEmail" FROM "ZepetoAccount";
DROP TABLE "ZepetoAccount";
ALTER TABLE "new_ZepetoAccount" RENAME TO "ZepetoAccount";
CREATE UNIQUE INDEX "ZepetoAccount_userId_zepetoEmail_key" ON "ZepetoAccount"("userId", "zepetoEmail");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
