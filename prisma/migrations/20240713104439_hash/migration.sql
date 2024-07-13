/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_name_password_idx";

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");
