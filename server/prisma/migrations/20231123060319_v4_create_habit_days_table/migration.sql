-- CreateTable
CREATE TABLE "habit_days" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day_id" TEXT NOT NULL,
    "habit_id" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "habit_days_day_id_habit_id_key" ON "habit_days"("day_id", "habit_id");
