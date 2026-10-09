import WebPush from "web-push";
import { FastifyInstance } from "fastify";
import { z } from "zod";

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
        const sendPushBody = z.object({
            subscription: z.object({
                endpoint: z.string(),
                keys: z.object({
                    p256dh: z.string(),
                    auth: z.string(),
                }),
            }),
        });

        const { subscription } = sendPushBody.parse(request.body);

        WebPush.sendNotification(subscription, "Hello World!" )

        return reply.status(201).send();
    });
}
