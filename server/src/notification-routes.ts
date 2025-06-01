import WebPush from "web-push";
import { FastifyInstance } from "fastify";

const publicKey =
    "BB5MZBPUwoToIqoAhvwalC1RNNKvruynbyILea1IBtb97gHicEM2dBeMGlimcS7KPzpLe8VKpmzI4EIbV_byPXg";
const privateKey = "dfX1ubGKOT-ducaiZGjvmu9nLEbxssfNWVZ9eyoGVWo";

WebPush.setVapidDetails("https://localhost:3000", publicKey, privateKey);

export async function notificationRoutes(app: FastifyInstance) {
    app.get("/push/public_key", () => {
        return { publicKey };
    });

    app.post("/push/register", (request, reply) => {
        console.log(request.body);

        return reply.status(201).send();
    });

    app.post("/push/send", async (request, reply) => {
        console.log(request.body);

        return reply.status(201).send();
    });
}
