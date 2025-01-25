import { FastifyInstance } from "fastify";
import { prisma } from "./lib/prisma";
import { z } from "zod";
import dayjs from "dayjs";

export async function appRoutes(server: FastifyInstance) {
    server.post("/habits", async (request) => {
        console.log(request.body);
        const createHabitBody = z.object({
            title: z.string(),
            weekDays: z.array(z.number().min(0).max(6)),
        });

        const { title, weekDays } = createHabitBody.parse(request.body);

        const today = dayjs().startOf("day").toDate();

        await prisma.habit.create({
            data: {
                title,
                created_at: today,
                weekDays: {
                    create: weekDays.map((weekDay) => {
                        return {
                            week_day: weekDay,
                        };
                    }),
                },
            },
        });
    });

    server.get("/day", async (request) => {
        const getDayParams = z.object({
            date: z.coerce.date(),
        });

        const { date } = getDayParams.parse(request.query);

        const parsedDate = dayjs(date).startOf("day");
        const weekDay = parsedDate.get("day");

        const possibleHabits = await prisma.habit.findMany({
            where: {
                created_at: {
                    lte: date,
                },
                weekDays: {
                    some: {
                        week_day: weekDay,
                    },
                },
            },
        });

        const day = await prisma.day.findUnique({
            where: {
                date: parsedDate.toDate(),
            },
            include: {
                dayHabits: true,
            },
        });

        const completedHabits = day?.dayHabits.map((dayHabit) => {
            return dayHabit.habit_id;
        });

        return {
            possibleHabits,
            completedHabits,
        };
    });

    server.patch("/habits/:id/toggle", async (request) => {
        const toggleHabitsParam = z.object({
            id: z.string().uuid(),
        });

        const { id } = toggleHabitsParam.parse(request.params);

        const today = dayjs().startOf("day").toDate();

        let day = await prisma.day.findUnique({
            where: {
                date: today,
            },
        });

        if (!day) {
            day = await prisma.day.create({
                data: {
                    date: today,
                },
            });
        }

        const dayHabit = await prisma.dayHabit.findUnique({
            where: {
                day_id_habit_id: {
                    day_id: day.id,
                    habit_id: id,
                },
            },
        });

        if (dayHabit) {
            await prisma.dayHabit.delete({
                where: {
                    id: dayHabit.id,
                },
            });
        } else {
            await prisma.dayHabit.create({
                data: {
                    habit_id: id,
                    day_id: day.id,
                },
            });
        }
    });
}
