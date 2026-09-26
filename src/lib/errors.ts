/**
 * Domain errors, in a module with no dependencies at all so it can be imported
 * from anywhere — including code that is also reachable from the browser —
 * without dragging Prisma or the database driver along with it.
 */

/** A rule of the inventory domain was broken. The message is safe to display. */
export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}
