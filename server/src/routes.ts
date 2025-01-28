import { prisma } from "./lib/prisma";
import { z } from "zod";
import dayjs from "dayjs";
import { FastifyTypedInstance } from "./types";

export async function appRoutes(server: FastifyTypedInstance) {
    // Habits
    server.post(
        "/habits",
        {
            schema: {
                tags: ["habits"],
                description: "Create a new habit",
                body: z.object({
                    title: z.string(),
                    weekDays: z.array(z.number().min(0).max(6)),
                }),
                response: {
                    201: z.null().describe("Habit created"),
                },
            },
        },
        async (request, reply) => {
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

            return reply.status(201).send();
        }
    );

    // // Days
    server.get(
        "/day",
        {
            schema: {
                tags: ["day"],
                description: "Get habits for a specific day",
                querystring: z.object({
                    date: z.coerce
                        .date()
                        .describe(
                            "Date in ISO format (e.g. 2025-01-26T14:00:00.000Z)"
                        ),
                }),
                response: {
                    200: z.object({
                        possibleHabits: z.array(
                            z.object({
                                id: z.string(),
                                title: z.string(),
                                created_at: z.date(),
                            })
                        ),
                        completedHabits: z.array(z.string()),
                    }),
                },
            },
        },
        async (request) => {
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

            const completedHabits =
                day?.dayHabits.map((dayHabit) => {
                    return dayHabit.habit_id;
                }) ?? [];

            return {
                possibleHabits,
                completedHabits,
            };
        }
    );

    // Toggle habit
    server.patch(
        "/habits/:id/toggle",
        {
            schema: {
                tags: ["habits"],
                description: "Toggle habit completion status",
                params: z.object({
                    id: z.string().uuid(),
                }),
                response: {
                    200: z.object({
                        success: z.boolean(),
                    }),
                },
            },
        },
        async (request) => {
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
        }
    );

    //Summary
    server.get(
        "/summary",
        {
            schema: {
                tags: ["summary"],
                description: "Get habits completion summary",
                response: {
                    200: z
                        .array(
                            z.object({
                                id: z.string(),
                                date: z.date(),
                                completed: z.number(),
                                amount: z.number(),
                            })
                        )
                        .describe(
                            "Array of daily summaries with completion stats"
                        ),
                },
            },
        },
        async (request) => {
            const summary = await prisma.$queryRaw<
                { id: string; date: Date; completed: number; amount: number }[]
            >`
        SELECT D.id, D.date,
        (
        SELECT CAST(COUNT(*) AS FLOAT) 
        FROM day_habits DH 
        WHERE DH.day_id = D.id) AS completed,
        (
        SELECT CAST(COUNT(*) AS FLOAT) 
        FROM habit_week_days HWD 
        JOIN habits H ON H.id = HWD.habit_id
        WHERE HWD.week_day = CAST(strftime("%w", D.date/1000.0, 'unixepoch') AS INT)
            AND H.created_at <= D.date) AS amount
        FROM days D
        `;

            return summary;
        }
    );
}
