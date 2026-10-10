import { Hono } from "hono";
import { version } from "../package.json";

const app = new Hono<{ Bindings: Env }>().basePath("/v1");

app.get("/health", (c) => c.json({ status: "ok", version }));

export default app;
