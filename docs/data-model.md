# QuickNotes Data Model

## Entities and relationships

### `users`

| Column | Type | Rules |
|---|---|---|
| `id` | BIGINT | Primary key |
| `email` | VARCHAR(254) | NOT NULL, UNIQUE |
| `display_name` | VARCHAR(100) | NOT NULL |
| `created_at` | TIMESTAMP | NOT NULL |

### `notes`

| Column | Type | Rules |
|---|---|---|
| `id` | BIGINT | Primary key |
| `user_id` | BIGINT | NOT NULL, FK to users.id |
| `title` | VARCHAR(100) | NOT NULL |
| `body` | TEXT | Nullable |
| `created_at` | TIMESTAMP | NOT NULL |
| `updated_at` | TIMESTAMP | NOT NULL |

### `tags`

| Column | Type | Rules |
|---|---|---|
| `id` | BIGINT | Primary key |
| `user_id` | BIGINT | NOT NULL, FK to users.id |
| `name` | VARCHAR(50) | NOT NULL |
| `created_at` | TIMESTAMP | NOT NULL |
| — | — | UNIQUE (`user_id`, `name`) |

### `note_tags`

| Column | Type | Rules |
|---|---|---|
| `note_id` | BIGINT | PK component; FK to notes.id |
| `tag_id` | BIGINT | PK component; FK to tags.id |
| `created_at` | TIMESTAMP | NOT NULL |
| — | — | Composite primary key (`note_id`, `tag_id`) |

## Relationships

- **Users to notes is one-to-many:** one user owns many notes, while each note has exactly one owner.
- **Users to tags is one-to-many:** each user can create many personal tags, and each tag has one owner.
- **Notes to tags is many-to-many:** a note may have several tags and a tag may be attached to many notes. The `note_tags` junction table stores those links without duplicating note or tag data; its composite primary key prevents duplicate links.

## SQL schema

The statements use PostgreSQL-style types suitable for a production relational database. `BIGSERIAL` generates numeric IDs; timestamps default to UTC via application or database configuration. The schema's ownership checks (ensuring a note and tag attached together belong to the same user) should be enforced in application logic or with additional composite constraints if the database's tenancy policy requires it.

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 100),
    body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (note_id, tag_id)
);
```

## Example queries

**1. List a user's newest notes**

```sql
SELECT id, title, body, created_at, updated_at
FROM notes
WHERE user_id = 42
ORDER BY created_at DESC
LIMIT 20;
```

**2. Fetch a note with its owner (JOIN)**

```sql
SELECT n.id, n.title, n.body, u.display_name, u.email
FROM notes AS n
JOIN users AS u ON u.id = n.user_id
WHERE n.id = 1001 AND n.user_id = 42;
```

**3. List tags attached to a note**

```sql
SELECT t.id, t.name
FROM tags AS t
JOIN note_tags AS nt ON nt.tag_id = t.id
JOIN notes AS n ON n.id = nt.note_id
WHERE n.id = 1001 AND n.user_id = 42
ORDER BY t.name;
```

**4. Count notes per user**

```sql
SELECT u.id, u.display_name, COUNT(n.id) AS note_count
FROM users AS u
LEFT JOIN notes AS n ON n.user_id = u.id
GROUP BY u.id, u.display_name
ORDER BY note_count DESC;
```

## Indexes

```sql
CREATE INDEX idx_notes_user_created
    ON notes (user_id, created_at DESC);
CREATE INDEX idx_note_tags_tag_id
    ON note_tags (tag_id);
```

The composite index on `notes(user_id, created_at)` supports the common operation of listing a user's notes newest-first without scanning every user's notes. The `note_tags(tag_id)` index supports finding all notes that use a particular tag; the primary key on `note_tags(note_id, tag_id)` already supports lookups beginning with `note_id`.

## SQL or NoSQL?

I would choose a relational SQL database, such as PostgreSQL, because users, notes, and tags have clear ownership and integrity rules, and note-tag relationships are many-to-many. Foreign keys, unique constraints, transactions, and joins make those rules easier to enforce reliably. At one million users, a well-indexed relational database with caching and a read replica is a sensible starting point; scale out further based on measured workload rather than choosing NoSQL solely because the user count sounds large.
