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