export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.WORKER_ENABLED !== "true") {
    return;
  }

  const { startWorker } = await import(
    "@/server/worker/start-worker"
  );

  startWorker();
}
