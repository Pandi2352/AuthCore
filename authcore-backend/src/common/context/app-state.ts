/**
 * Process-wide application state. Set once by the lifecycle service and read
 * by readiness checks and middleware.
 */
let isShuttingDownFlag = false;

export function markShuttingDown(): void {
  isShuttingDownFlag = true;
}

export function isShuttingDown(): boolean {
  return isShuttingDownFlag;
}
