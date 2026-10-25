# QuickNotes API Design

Base URL: `https://api.quicknotes.example.com/v1`

All requests and responses use JSON. Authentication uses a bearer token
(`Authorization: Bearer <token>`). Resources are user-scoped: a user can only
read and modify their own notes unless they hold an admin role.

## Endpoints

| Method | Path              | Description                          | Success status |
|--------|-------------------|--------------------------------------|----------------|
| GET    | `/notes`          | List the current user's notes        | 200 OK         |
| GET    | `/notes/{id}`     | Fetch a single note                  | 200 OK         |
| POST   | `/notes`          | Create a note                        | 201 Created    |
| PATCH  | `/notes/{id}`     | Partially update a note              | 200 OK         |
| DELETE | `/notes/{id}`     | Delete a note                        | 204 No Content |
| GET    | `/tags`           | List tags available to the user      | 200 OK         |
| POST   | `/tags`           | Create a tag                         | 201 Created    |
| POST   | `/notes/{id}/tags`| Attach a tag to a note               | 201 Created    |

## Request & response examples

### Creating a note — `POST /notes`

Request:

```json
{
  "title": "Sprint planning",
  "body": "Review backlog, estimate stories, pick sprint goal.",
  "tags": ["work", "planning"]
}


Response — 201 Created:

json
{
  "id": 101,
  "title": "Sprint planning",
  "body": "Review backlog, estimate stories, pick sprint goal.",
  "user_id": 42,
  "tags": ["work", "planning"],
  "created_at": "2026-01-15T09:30:00Z",
  "updated_at": "2026-01-15T09:30:00Z"
}
Listing notes — GET /notes
Request:

text
GET /v1/notes?limit=20&offset=0
Authorization: Bearer <token>
Response — 200 OK:

json
{
  "data": [
    {
      "id": 101,
      "title": "Sprint planning",
      "body": "Review backlog, estimate stories, pick sprint goal.",
      "user_id": 42,
      "tags": ["work", "planning"],
      "created_at": "2026-01-15T09:30:00Z",
      "updated_at": "2026-01-15T09:30:00Z"
    },
    {
      "id": 100,
      "title": "Grocery list",
      "body": "Milk, eggs, bread",
      "user_id": 42,
      "tags": ["personal"],
      "created_at": "2026-01-14T18:02:00Z",
      "updated_at": "2026-01-14T18:02:00Z"
    }
  ],
  "meta": { "limit": 20, "offset": 0, "total": 2 }
}
Error status codes
Status	Meaning
400	Bad request — malformed JSON or validation failure
401	Unauthorized — missing or invalid bearer token
403	Forbidden — authenticated but not allowed to access resource
404	Not found — note or tag does not exist
500	Internal server error — unexpected server failure
Example error body (400 Bad Request):

json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required and must be 100 characters or fewer.",
    "field": "title"
  }
}
Conventions
Validation: title required, 1–100 characters; body optional, max 10,000 characters.

Pagination: limit (default 20, max 100) and offset.

Timestamps are ISO 8601 UTC.

Idempotency: DELETE is idempotent (deleting an already-deleted note returns 404 on the second call).

Rate limiting: 429 Too Many Requests with Retry-After header when the per-token budget is exceeded.