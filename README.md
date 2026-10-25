# QuickNotes System Design

QuickNotes is a notes application that started as a browser-only app and is
being redesigned as a real online service for 1 million users. This repository
contains the front-end API client (built against the JSONPlaceholder practice
API) and the backend design documents the backend team will build from.

## What's in this repository

- `index.html`, `api.js`, `style.css` — the API client
  - **GET** `https://jsonplaceholder.typicode.com/posts?_limit=10` — load 10 notes
  - **POST** `https://jsonplaceholder.typicode.com/posts` — create a note (title required, max 100 chars)
  - **DELETE** `https://jsonplaceholder.typicode.com/posts/{id}` — delete a note
  - Loading, success, error and empty states are shown on the page; buttons are
    disabled while requests run; all user text is inserted with `textContent`.
- `docs/api-design.md` — REST API design (endpoints, examples, error codes)
- `docs/data-model.md` — entities, relationships, SQL schema, queries, index, SQL vs NoSQL
- `docs/architecture.md` — requirements, 1M-user estimates, diagram, flows, trade-offs

## How to run the API client

No build step or dependencies are required.

1. Clone the repository:
   ```bash
   git clone https://github.com/JoseBeanz/quicknotes-system-design.git
   cd quicknotes-system-design

2. Open index.html directly in a modern browser, or serve the folder:

bash
python3 -m http.server 8000
then visit http://localhost:8000.

Click Load notes to fetch 10 notes.

Fill in a title (required) and optional body, then submit the form to create a note.

Click Delete on any note to remove it.

Note: JSONPlaceholder is a fake API. Created notes are not persisted on the
server; the client keeps them in the page and handles delete/refresh sensibly.
See the header comment in api.js for details.

Design documents
API design

Data model

Architecture

What I learned
Wrapping fetch in a reusable request() helper makes error handling
consistent — fetch only rejects on network failures, so checking
response.ok explicitly (and throwing) is essential for HTTP error handling.

State management on the page matters. Because JSONPlaceholder does not