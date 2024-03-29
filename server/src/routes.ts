import { FastifyInstance } from "fastify";
import { prisma } from "./lib/prisma";
import { z } from "zod";

export async function appRoutes(server: FastifyInstance) {
    server.post("/habits", async (request) => {
        const createHabitBody = z.object({
            title: z.string(),
            weekDays: z.array(z.number().min(0).max(6)),
        });

        const { title, weekDays } = createHabitBody.parse(request.body);
    });
}
