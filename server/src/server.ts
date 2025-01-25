import Fastify from "fastify";
import cors from "@fastify/cors";
import { appRoutes } from "./routes";

const server = Fastify();
const port = 3000;

server.register(cors);
server.register(appRoutes);

server
    .listen({
        host: "0.0.0.0",
        port: port,
    })
    .then(() => {
        console.log(`Server listening on http://localhost:${port}`);
    });
