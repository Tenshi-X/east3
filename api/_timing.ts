import type { Request, Response, NextFunction } from "express";

// The browser can compare app time with total request time to spot network or
// routing latency. Do not expose SQL, user data, or credentials in diagnostics.
export function apiTiming(_req: Request, res: Response, next: NextFunction) {
  const start = performance.now();
  const json = res.json;
  res.json = function (body: any) {
    res.setHeader(
      "Server-Timing",
      "app;dur=" + (performance.now() - start).toFixed(1),
    );
    res.setHeader("Cache-Control", "private, no-store");
    return json.call(this, body);
  };
  next();
}
