import Fastify from 'fastify';

const server = Fastify();

server.get('/', () => {
  return "Hello World!";
});

server.listen({
    port: 3000,
})