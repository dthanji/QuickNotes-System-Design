# QuickNotes Architecture and Scaling Plan

## Scope and assumptions

The goal is to evolve a browser-only note-taking experience into an online service for **1,000,000 registered users**. As no activity rates are specified in the brief, these are explicit planning assumptions, not measured facts:

- 20% of registered users are active daily: **200,000 daily active users (DAU)**.
- Each DAU reads the notes feed/list 30 times and writes 1 time per day (a create or edit). Deletion is included in the aggregate write rate.
- An average stored note is 2 KB of text and metadata. Each active user creates one net-new note per day, and notes are retained for a year.
- There are 86,400 seconds in a day; calculations show day-average rates, with peak traffic expected to be several times higher and to be handled by load testing and headroom.
- CDN mainly supports static assets and can accelerate versioned front-end assets; authenticated note responses should be private and must not be shared between users through a public cache.

## Functional requirements

1. Users can sign in and only access notes they own.
2. Users can list notes, create, read, update and delete individual notes.
3. Users can assign tags and retrieve notes by tag.
4. The client reports loading, success, empty and failure states with useful messages.
5. Mutations validate input and preserve note ownership and integrity.

## Non-functional requirements

- **Availability:** target 99.9% monthly availability for the API, supported by multiple instances and health checks.
- **Performance:** aim for p95 list/read latency below 300 ms under expected load, excluding slow client networks.
- **Scalability:** scale app servers and workers horizontally; add caching and read capacity based on metrics.
- **Security:** HTTPS, hashed passwords, short-lived session/token credentials, per-resource authorization, input validation, rate limits and secret management.
- **Durability and recovery:** automated database backups, point-in-time recovery, tested restore procedures and durable queue semantics.
- **Observability:** central logs, request IDs, latency/error metrics, queue age, database health and actionable alerts.
- **Privacy:** private note responses are not served from a shared public cache; access logs avoid recording note bodies.

## Load estimates for one million users

### Daily active users

1,000,000 registered users × 20% assumed daily activity = **200,000 DAU**.

### Reads per second

- Reads per day = 200,000 DAU × 30 list/read requests = **6,000,000 reads/day**.
- Average reads/second = 6,000,000 ÷ 86,400 = **69.44 reads/second**.
- At an illustrative 5× burst, plan initially for about **347 reads/second** before adding headroom for retries and related API calls.

### Writes per second

- Writes per day = 200,000 DAU × 1 write = **200,000 writes/day**.
- Average writes/second = 200,000 ÷ 86,400 = **2.31 writes/second**.
- At an illustrative 5× burst, plan initially for about **11.6 writes/second**.

These are request-level estimates. A single screen may generate several API calls, and observed usage should replace assumptions once analytics and load testing are available.

### Storage per year

- New notes per year = 200,000 DAU × 1 note/day × 365 = **73,000,000 notes/year**.
- At 2 KB per note, raw content storage = 73,000,000 × 2 KB = 146,000,000 KB, approximately **146 GB/year** (decimal units).
- Indexes, row overhead, replicas, logs, and backups increase actual provisioned storage, so budget above the raw estimate and measure real average note size.

## Architecture diagram

```text
                      +-------------------------+
                      | Browser / Mobile Client |
                      +------------+------------+
                                   |
                                   v
                              +----+----+
                              |   DNS   |
                              +----+----+
                                   |
                                   v
                      +-------------------------+
                      |           CDN           |
                      | Versioned static assets |
                      +------------+------------+
                                   |
                                   v
                      +-------------------------+
                      |      Load Balancer      |
                      | TLS / health checks     |
                      +-----------+-------------+
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
           +----------------+          +----------------+
           |  App Server A  |          |  App Server B  |
           | REST API/auth  |          | REST API/auth  |
           +---+---------+--+          +--+----------+--+
               |         |                |          |
               |         +----------+-----+          |
               |                    |                |
               v                    v                v
        +-------------+      +-------------+  +---------------+
        | Cache       |      | Primary DB  |->| Read Replica  |
        | Redis-like  |      | users/notes |  | read queries  |
        +-------------+      +------+------+  +---------------+
                                    |
                                    | enqueue background event
                                    v
                             +-------------+
                             | Queue       |
                             +------+------+
                                    |
                                    v
                             +-------------+
                             | Worker      |
                             | async tasks |
                             +------+------+
                                    |
                                    v
                             +-------------+
                             | Primary DB  |
                             | or external |
                             | integrations|
                             +-------------+

     Observability/alerts collect metrics and logs from every tier.
     Deploy multiple instances per critical tier across failure zones.
```

## Component responsibilities

- **Browser/Mobile Client:** Presents note workflows and communicates with the API over HTTPS.
- **DNS:** Resolves the service's human-readable hostname to the edge endpoint and supports controlled routing changes.
- **CDN:** Caches and delivers versioned static files near users, reducing origin latency and bandwidth; it does not publicly cache private note data.
- **Load Balancer:** Distributes incoming API traffic across healthy app servers and removes unhealthy instances from rotation.
- **App Servers A and B:** Run the stateless API, authenticate users, validate requests, enforce note ownership and coordinate data operations.
- **Cache:** Holds frequently used, non-sensitive or correctly user-scoped data to reduce repeated database reads and latency.
- **Primary Database:** Stores authoritative user, note, tag and relationship data with transactions and constraints.
- **Database Read Replica:** Offloads eligible read queries from the primary and provides additional read capacity, acknowledging replication lag.
- **Queue:** Buffers non-critical asynchronous work so user-facing requests are not blocked by downstream processing.
- **Worker:** Processes queued jobs with retries and idempotency, such as search indexing, notifications or audit/event tasks.
- **Observability and alerts:** Collect logs, traces and metrics to identify errors, slow requests, replica lag and backlogs before users report them.

## GET /notes request flow

1. The client resolves the QuickNotes hostname through DNS and establishes HTTPS to the service edge.
2. The CDN serves cached versioned assets where possible; requests for private note data continue to the API origin.
3. The load balancer selects a healthy app-server instance.
4. The app server validates the session/token and derives the user ID from the authenticated identity, never from an untrusted query parameter.
5. The server checks a cache key scoped to that user and the requested pagination/filter parameters; only safe user-scoped results may be cached.
6. On a cache miss, the app server queries the read replica for that user's newest notes and applies pagination and authorization constraints. Strongly consistent reads can use the primary where required.
7. The server returns a JSON response with data and pagination metadata, and may populate the cache with a short TTL.
8. Metrics record latency, result size, cache hit/miss and errors without logging private note content.

## POST /notes request flow

1. The client sends `POST /api/v1/notes` over HTTPS with its authentication credential and a JSON title/body payload.
2. DNS and the load balancer route the request to a healthy app server.
3. The app server authenticates the user, validates title presence/length and body size, applies rate limits, and derives ownership from the authenticated user.
4. The server inserts the note into the primary database within a transaction and lets database constraints protect data integrity.
5. After the write commits, the API returns `201 Created`, the new note representation, and a `Location` header; it does not wait for optional background jobs.
6. The server invalidates or updates relevant user-scoped cache entries so stale lists are not kept until their TTL expires.
7. Optional side effects, such as search indexing or notifications, are published through a durable queue using a transactional outbox or equivalent reliable publish pattern.
8. The worker processes events asynchronously with retry/backoff and idempotency keys, and failures are sent to a dead-letter queue for inspection.

## Trade-offs and failure resilience

### Cache vs. strict freshness

Caching decreases database load and read latency, but cached note lists can become stale after create/update/delete. Use short TTLs, explicit invalidation after committed writes, user-scoped keys and a primary read for operations requiring read-after-write consistency.

### Read replica vs. consistency

A read replica adds read throughput and isolates some query load, but replication lag means a just-created or edited note may not appear immediately on replica-backed reads. Route read-after-write requests to the primary for a short window or use consistency metadata before falling back to replicas.

### Queue vs. synchronous work

Asynchronous workers keep the user-facing path responsive and can scale independently, but jobs become eventually consistent and can fail or repeat. Make handlers idempotent, retry transient failures with backoff, monitor queue age/depth and dead-letter persistent failures.

### More redundancy vs. cost and operations

Multiple app servers, database replicas and worker instances reduce downtime but increase cost and operational complexity. Scale based on measured bottlenecks, automate deployments and database failover, and test recovery rather than assuming that a replica alone guarantees availability.

## Avoiding single points of failure

Run at least two app-server instances behind health-checked load balancing, ideally across separate availability zones, and deploy more than one worker for queued workloads. Use a managed highly available database with automated backups, point-in-time recovery and a tested primary-failover procedure; keep the read replica monitored and understand that replica failover is not instantaneous. Use a durable replicated queue, a highly available cache configuration (with the app able to fall back to the database if cache is unavailable), redundant DNS/edge infrastructure, and centralized monitoring from outside the application cluster. Every failover path should be rehearsed, and recovery time and recovery point objectives should be documented.
