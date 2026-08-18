/**
 * Restartable request/response wrapper around a Web Worker (§6.3).
 * Each worker is spawned lazily on first use and torn down on error so one
 * crash never bricks the session.
 */

type Pending = {
  resolve: (value: never) => void;
  reject: (error: Error) => void;
};

/**
 * Omit that distributes over unions: `Omit<A | B, K>` collapses to the common
 * properties of A and B, which would reject every variant-specific field.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export class WorkerClient<Req extends { id: number }, Res extends { id: number }> {
  #worker: Worker | null = null;
  #pending = new Map<number, Pending>();
  #nextId = 1;

  constructor(private readonly spawn: () => Worker) {}

  #ensure(): Worker {
    if (this.#worker) return this.#worker;
    const worker = this.spawn();
    worker.addEventListener("message", (event: MessageEvent<Res>) => {
      const pending = this.#pending.get(event.data.id);
      if (!pending) return;
      this.#pending.delete(event.data.id);
      (pending.resolve as (value: Res) => void)(event.data);
    });
    worker.addEventListener("error", (event) => {
      this.#failAll(new Error(event.message || "The worker crashed."));
      this.terminate();
    });
    this.#worker = worker;
    return worker;
  }

  #failAll(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }

  send(
    request: DistributiveOmit<Req, "id">,
    transfer: Transferable[] = [],
  ): Promise<Res> {
    const worker = this.#ensure();
    const id = this.#nextId++;
    // Reattaching the generated id restores a full Req; the compiler cannot
    // prove that across the generic boundary, hence the assertion.
    const message = { ...request, id } as unknown as Req;
    return new Promise<Res>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: resolve as (value: never) => void,
        reject,
      });
      worker.postMessage(message, transfer);
    });
  }

  terminate(): void {
    this.#worker?.terminate();
    this.#worker = null;
  }
}
