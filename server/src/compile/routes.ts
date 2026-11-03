import { Router } from "express";
import { createExecutionPlan, InvalidCompileRequestError } from "./plan";
import { runSubmission } from "./runner";

export const compileRouter = Router();
let activeRuns = 0;

// These existing runners execute locally; do not expose them in production.
compileRouter.post("/", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.sendStatus(404);
    return;
  }
  if (activeRuns >= 2) {
    res.status(429).json({ error: "The runners are busy. Try again shortly." });
    return;
  }
  const controller = new AbortController();
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  let started = false;
  try {
    const { request } = createExecutionPlan(req.body);
    activeRuns++;
    started = true;
    res.on("close", disconnect);
    const result = await runSubmission(request, request.language, { signal: controller.signal });
    if (!res.destroyed) res.json(result);
  } catch (error) {
    if (!res.destroyed) res.status(error instanceof InvalidCompileRequestError ? 400 : 500)
      .json({ error: error instanceof InvalidCompileRequestError ? error.message : "Could not execute code." });
  } finally {
    res.off("close", disconnect);
    if (started) activeRuns--;
  }
});
