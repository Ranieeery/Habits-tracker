import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";

const server = Fastify();
const prisma = new PrismaClient();

server.get("/", async () => {
    const habits = await prisma.habit.findMany();

    return habits;
});

server
    .listen({
        port: 3000,
    })
    .then(() => {
        console.log("Server listening on http://localhost:3000");
    });
