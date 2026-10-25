
---

## 5. `docs/data-model.md`

```markdown
# QuickNotes Data Model

## Entities

### `users`

| Column        | Type          | Constraints                         |
|---------------|---------------|-------------------------------------|
| `id`          | BIGINT        | PRIMARY KEY, auto-increment         |
| `email`       | VARCHAR(255)  | NOT NULL, UNIQUE                    |
| `password_hash`| VARCHAR(255) | NOT NULL                            |
| `display_name`| VARCHAR(100)  | NOT NULL                            |
| `created_at`  | TIMESTAMPTZ   | NOT NULL, DEFAULT now()             |

### `notes`

| Column       | Type          | Constraints                                   |
|--------------|---------------|-----------------------------------------------|
| `id`         | BIGINT        | PRIMARY KEY, auto-increment                   |
| `user_id`    | BIGINT        | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE |
| `title`      | VARCHAR(100)  | NOT NULL                                      |
| `body`       | TEXT          | NULL                                          |
| `created_at` | TIMESTAMPTZ   | NOT NULL, DEFAULT now()                       |
| `updated_at` | TIMESTAMPTZ   | NOT NULL, DEFAULT now()                       |

### `tags`

| Column     | Type         | Constraints                          |
|------------|--------------|--------------------------------------|
| `id`       | BIGINT       | PRIMARY KEY, auto-increment          |
| `user_id`  | BIGINT       | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE |
| `name`     | VARCHAR(50)  | NOT NULL                             |
| `created_at`| TIMESTAMPTZ | NOT NULL, DEFAULT now()              |

Unique constraint: `(user_id, name)` — a user cannot have two tags with the same name.

### `note_tags`

| Column     | Type   | Constraints                                        |
|------------|--------|----------------------------------------------------|
| `note_id`  | BIGINT | NOT NULL, FOREIGN KEY → notes(id) ON DELETE CASCADE |
| `tag_id`   | BIGINT | NOT NULL, FOREIGN KEY → tags(id)  ON DELETE CASCADE |
| PRIMARY KEY| (note_id, tag_id) | composite primary key                    |

## Relationships

- **`users` → `notes` (one-to-many):** one user owns many notes; each note
  belongs to exactly one user. Enforced by `notes.user_id` FK.
- **`users` → `tags` (one-to-many):** one user owns many tags; each tag belongs
  to exactly one user.
- **`notes` ↔ `tags` (many-to-many):** a note can have many tags and a tag can
  be applied to many notes. Modelled by the `note_tags` join table whose
  composite primary key prevents duplicate associations.

## CREATE TABLE statements

```sql
CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE notes (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(100) NOT NULL,
    body       TEXT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE tags (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id  BIGINT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

Example queries
1. List a user's most recent notes
sql
SELECT id, title, body, created_at
FROM notes
WHERE user_id = 42
ORDER BY created_at DESC
LIMIT 20;
2. List notes with their tags (JOIN)
sql
SELECT n.id, n.title, t.name AS tag
FROM notes n
JOIN note_tags nt ON nt.note_id = n.id
JOIN tags t       ON t.id = nt.tag_id
WHERE n.user_id = 42
ORDER BY n.created_at DESC;
3. Count notes per tag for a user
sql
SELECT t.name, COUNT(nt.note_id) AS note_count
FROM tags t
LEFT JOIN note_tags nt ON nt.tag_id = t.id
WHERE t.user_id = 42
GROUP BY t.id, t.name
ORDER BY note_count DESC;
Index
sql
CREATE INDEX idx_notes_user_created
    ON notes (user_id, created_at DESC);
Reason: The most common query is "list this user's notes, newest first"
(query 1 above). A composite index on (user_id, created_at DESC) lets the
database satisfy the filter and the sort with a single index scan instead of a
sequential scan plus an in-memory sort. This keeps the read path fast as the
table grows into millions of rows.

SQL vs NoSQL decision
QuickNotes uses a relational (SQL) database because the domain is highly
structured and relational: users own notes, notes share tags, and tags form a
true many-to-many relationship with notes. These are exactly the joins a
relational engine handles well, and foreign keys plus ON DELETE CASCADE give
us referential integrity for free. The write volume is modest (see the
architecture estimates: a few hundred writes per second at 1M users), so the
horizontal write-scaling advantages of NoSQL are not needed. A SQL database
also gives us ACID transactions (important when attaching tags to a note) and
mature tooling for reporting. If, in the future, the notes body grows into
large, loosely structured documents, that column could move to a document store
while the relational core stays in SQL.