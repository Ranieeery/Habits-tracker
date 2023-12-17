import Fastify from "fastify";
import cors from "@fastify/cors";
import { appRoutes } from "./routes";

const server = Fastify();

server.register(cors);
server.register(appRoutes);

server
    .listen({
        port: 3000,
    })
    .then(() => {
        console.log("Server listening on http://localhost:3000");
    });
