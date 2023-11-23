import Fastify from "fastify";

const server = Fastify();

server.get("/", () => {
    return "Hello World!";
});

server
    .listen({
        port: 3000,
    })
    .then(() => {
        console.log("Server listening on http://localhost:3000");
    });
