
---

## 6. `docs/architecture.md`

```markdown
# QuickNotes Architecture

## Functional requirements

1. Users can sign up, log in and log out (token-based auth).
2. Users can create, read, update and delete their own notes.
3. Users can tag notes and filter notes by tag.
4. The note list is paginated and sorted newest-first.
5. All data is private to its owner; cross-user access is rejected.
6. The API returns JSON and exposes REST endpoints documented in `api-design.md`.

## Non-functional requirements

1. **Availability:** 99.9% monthly uptime (~43 min downtime/month).
2. **Latency:** p95 read latency < 200 ms; p95 write latency < 300 ms.
3. **Scalability:** support 1,000,000 registered users and 10,000,000 notes.
4. **Durability:** no committed note is ever lost (replicated storage).
5. **Security:** TLS in transit, hashed passwords, per-user authorization.
6. **Observability:** structured logs, metrics and distributed tracing.

## Load estimate for 1,000,000 users

Assumptions: 10% daily active users (100,000 DAU), each DAU performs ~20 reads
and ~2 writes per day. Peak traffic is ~5× the daily average.

- **Reads per second (average):** 100,000 × 20 / 86,400 ≈ **23 reads/s**
- **Reads per second (peak):** 23 × 5 ≈ **115 reads/s**
- **Writes per second (average):** 100,000 × 2 / 86,400 ≈ **2.3 writes/s**
- **Writes per second (peak):** 2.3 × 5 ≈ **12 writes/s**
- **Storage per year:** average note ≈ 1 KB (title + body + row overhead).
  100,000 DAU × 2 notes/day × 365 days ≈ 73,000,000 notes/year ≈ **73 GB/year**
  of note data; with indexes, metadata and 3× replication, budget **~250 GB/year**.

These numbers are small for a single well-indexed SQL primary, which is why the
architecture below uses a primary + read replica rather than sharding.

## Architecture diagram
┌──────────────┐
│ Client │ (browser / mobile app)
└──────┬───────┘
│ HTTPS
┌──────▼───────┐
│ DNS │ resolves api.quicknotes.example.com
└──────┬───────┘
│
┌──────▼───────┐
│ CDN │ caches static assets & GET /notes responses
└──────┬───────┘
│
┌──────▼───────┐
│Load Balancer │ TLS termination, health checks, routing
└──┬───────┬───┘
│ │
┌─────────▼─┐ ┌─▼─────────┐
│ App Srv 1 │ │ App Srv 2 │ (stateless, horizontally scaled)
└─────┬─────┘ └─────┬─────┘
│ │
┌─────▼───────────────▼─────┐
│ Cache │ (Redis) hot notes, sessions
└─────┬───────────────┬─────┘
│ │
┌────────▼──────┐ ┌─────▼─────────┐
│ Primary DB │ │ Read Replica │ (SQL)
└────────┬──────┘ └───────────────┘
│
┌─────▼─────┐
│ Queue │ (e.g. SQS / RabbitMQ)
└─────┬─────┘
│
┌─────▼─────┐
│ Worker │ async jobs (search indexing, emails, cleanup)
└───────────┘


## Component explanations (one sentence each)

- **Client** — runs the QuickNotes UI and issues HTTPS API requests.
- **DNS** — maps the human-friendly API hostname to the load balancer's address.
- **CDN** — serves static assets and cacheable GET responses close to users, reducing origin load and latency.
- **Load balancer** — terminates TLS, health-checks app servers and distributes traffic across them.
- **App servers (×2+)** — stateless application processes that validate input, enforce authorization and talk to cache/database/queue.
- **Cache (Redis)** — stores hot note lists and session data so most reads never reach the database.
- **Primary database** — the single source of truth that accepts all writes and serves strongly-consistent reads.
- **Read replica** — a streaming copy of the primary that absorbs read traffic and provides failover.
- **Queue** — buffers asynchronous work so the request path stays fast.
- **Worker** — consumes queued jobs (e.g. re-indexing notes for search, sending emails, cleaning up soft-deleted rows).

## Flow: `GET /notes`

1. Client sends `GET /v1/notes` to the API hostname.
2. DNS resolves the hostname to the load balancer.
3. CDN checks its cache; a cache hit for this user's page is returned immediately.
4. On a miss, the load balancer forwards the request to a healthy app server.
5. The app server authenticates the bearer token and checks the cache (Redis) for the user's note list.
6. On a cache hit, the app server returns the cached list.
7. On a cache miss, the app server queries the **read replica** with the indexed `(user_id, created_at DESC)` query, writes the result to Redis with a short TTL, and returns it.
8. The response flows back through the load balancer and CDN to the client.

## Flow: `POST /notes`

1. Client sends `POST /v1/notes` with a JSON body.
2. DNS resolves the hostname; the CDN passes non-cacheable methods straight through.
3. The load balancer forwards the request to an app server.
4. The app server authenticates the user and validates the payload (`title` required, ≤100 chars).
5. The app server writes the note to the **primary database** inside a transaction.
6. The app server invalidates the user's cached note list in Redis.
7. The app server enqueues an asynchronous job (e.g. search indexing) onto the **queue**.
8. The app server returns `201 Created` with the new note; a **worker** later consumes the queued job.

## Trade-offs

1. **Read replica vs single database.** Adding a read replica doubles read
   capacity and provides a failover target, but introduces replication lag, so
   a read immediately after a write may not see the new note. We mitigate this
   by routing "read-your-own-writes" requests (e.g. the response to a POST) to
   the primary or by invalidating the cache on write.
2. **Cache vs always-fresh reads.** Caching note lists in Redis cuts database
   load and latency dramatically, but cached data can be stale and every write
   must invalidate the right keys. We accept a short TTL and explicit
   invalidation on write as a good balance for a notes app.

## Avoiding single points of failure

- **Load balancer:** deploy as a managed, multi-AZ load balancer (or an
  active/passive pair) so a single instance failure does not take down the API.
- **App servers:** run at least two stateless instances behind the load
  balancer; a failed instance is removed by health checks and traffic shifts to
  the survivors.
- **Database:** the primary streams to a read replica; if the primary fails, the
  replica is promoted. Backups are taken continuously for point-in-time recovery.
- **Cache:** run Redis in a replicated/clustered configuration so a node loss
  degrades performance but does not stop reads (they fall through to the DB).
- **Queue:** use a managed, replicated queue (e.g. SQS) so queued jobs survive
  broker failure and are retried by workers.
- **DNS/CDN:** provided by managed services with their own redundancy; TTLs are
  kept low so failover records propagate quickly.