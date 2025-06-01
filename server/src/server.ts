import { fastify } from "fastify";
import { fastifyCors } from "@fastify/cors";
import { appRoutes } from "./routes";
import {
    jsonSchemaTransform,
    serializerCompiler,
    validatorCompiler,
    ZodTypeProvider,
} from "fastify-type-provider-zod";
import { fastifySwagger } from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { notificationRoutes } from "./notification-routes";

const server = fastify().withTypeProvider<ZodTypeProvider>();
const port = 3000;

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.register(fastifyCors);
server.register(fastifySwagger, {
    openapi: {
        info: {
            title: "Habits API",
            version: "0.1.0",
        },
    },
    transform: jsonSchemaTransform,
});

server.register(fastifySwaggerUi, {
    routePrefix: "/docs",
});

server.register(appRoutes);
server.register(notificationRoutes)

server
    .listen({
        host: "0.0.0.0",
        port: port,
    })
    .then(() => {
        console.log(`Server listening on http://localhost:${port}`);
    });
