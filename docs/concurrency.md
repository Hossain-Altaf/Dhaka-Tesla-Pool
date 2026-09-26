# Capacity and Concurrency

## Invariant

For each active pool, the sum of seats in its `MATCHED`, `DRIVER_ARRIVED` and `STARTED` memberships must not exceed its vehicle capacity.

## Enforcement in this MVP

Every accept follows one transaction order:

1. `SELECT ... FROM vehicles WHERE driver_id = ? FOR UPDATE` obtains an InnoDB lock on the vehicle.
2. The requested ride and compatible open pool are read with locking reads.
3. Active member seats are summed. Cancelled/completed rides are not counted.
4. If the new total fits, ride status, individual pool fare, membership and `MATCHED` audit event commit together. Otherwise the transaction rolls back with HTTP 409.

Competing accepts for the same Tesla serialize on its vehicle row. The later transaction recomputes occupancy after the earlier commit. The integration test races two requests against a one-seat test vehicle and expects exactly one acceptance.

Passenger cancellation locks and updates only that passenger's ride. It never adds seats. If cancellation races an acceptance, the accept may conservatively reject until a retry sees the released seat, but it cannot overbook.

## Scale-up path

The lock is narrow to a vehicle and adequate for this MVP. At higher contention, measure lock waits, add idempotency keys, lock/statement timeouts and bounded retry for transient deadlocks, and partition dispatch across vehicle rows. Caches and queues can notify but must not become the capacity source of truth. Consider a reservation ledger or per-vehicle serialized command stream only after load testing justifies it.