// ============================================================================
// QuickNotes API client
// Talks to the JSONPlaceholder practice API (https://jsonplaceholder.typicode.com).
//
// IMPORTANT — JSONPlaceholder is a FAKE API:
//   * POST returns a simulated 201 with an invented id (e.g. 101).
//   * DELETE returns 200 but the server does NOT persist anything.
//   * Nothing you create survives a page reload, and DELETE on a fake id
//     "succeeds" even though no real record exists.
//
// Our approach: we keep an in-memory mirror of the notes on the page. A created
// note is added locally when the server confirms it. A deleted note is removed
// locally when the server confirms it. Because the server does not persist,
// we do NOT re-fetch the list after a mutation (it would just overwrite our
// local state with the original 10 posts). This is called out explicitly so
// the behaviour is intentional, not accidental.
// ============================================================================

const API_URL = "https://jsonplaceholder.typicode.com/posts";

// ---- DOM references ---------------------------------------------------------
const loadBtn   = document.getElementById("load-btn");
const statusEl  = document.getElementById("status");
const noteForm  = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput  = document.getElementById("body-input");
const submitBtn  = document.getElementById("submit-btn");
const notesList  = document.getElementById("notes-list");

// ---- Reusable fetch wrapper -------------------------------------------------
/**
 * request() wraps fetch() with error handling.
 * Throws an Error if the network fails or the response is not ok.
 * Returns the parsed JSON body (or null for 204 No Content).
 *
 * @param {string} url     The URL to request.
 * @param {object} options fetch() options (method, headers, body, ...).
 * @returns {Promise<any>} Parsed JSON body or null.
 */
async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    // fetch() only rejects on network failures, not HTTP errors.
    throw new Error(`Network error: ${networkError.message}`);
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  // Some endpoints (e.g. DELETE) may return no body.
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ---- Status helpers ---------------------------------------------------------
/** Show a status message. type = "loading" | "success" | "error" | "empty". */
function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = `status status--${type}`;
}

/** Enable or disable a button while a request is in flight. */
function setBusy(button, busy) {
  button.disabled = busy;
}

// ---- Rendering --------------------------------------------------------------
/**
 * Render one note as an <li> with a Delete button.
 * All user-supplied text is inserted with textContent (never innerHTML) to
 * prevent XSS injection.
 */
function renderNote(note) {
  const li = document.createElement("li");
  li.className = "note";
  li.dataset.id = note.id;

  const title = document.createElement("h3");
  title.className = "note-title";
  title.textContent = note.title;

  const body = document.createElement("p");
  body.className = "note-body";
  body.textContent = note.body ?? "";

  const meta = document.createElement("p");
  meta.className = "note-meta";
  meta.textContent = `id: ${note.id}`;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => deleteNote(note.id, deleteBtn));

  li.append(title, body, meta, deleteBtn);
  return li;
}

/** Add a note to the top of the list. */
function prependNote(note) {
  notesList.prepend(renderNote(note));
}

// ---- Empty state ------------------------------------------------------------
function showEmptyState() {
  notesList.innerHTML = "";
  const li = document.createElement("li");
  li.className = "empty-state";
  li.textContent = "No notes yet. Create one above or load notes.";
  notesList.append(li);
}

// ---- GET /posts?_limit=10 ---------------------------------------------------
/**
 * Load 10 notes from the server and render them.
 */
async function loadNotes() {
  setBusy(loadBtn, true);
  setStatus("Loading notes...", "loading");

  try {
    const notes = await request(`${API_URL}?_limit=10`);

    notesList.innerHTML = "";

    if (!Array.isArray(notes) || notes.length === 0) {
      showEmptyState();
      setStatus("Loaded 0 notes from the server.", "empty");
      return;
    }

    notes.forEach((note) => notesList.append(renderNote(note)));
    setStatus(`Loaded ${notes.length} notes from the server.`, "success");
  } catch (error) {
    setStatus(`Could not load notes: ${error.message}`, "error");
    showEmptyState();
  } finally {
    setBusy(loadBtn, false);
  }
}

// ---- POST /posts ------------------------------------------------------------
/**
 * Validate the title, then POST a new note to the server.
 * On success, prepend the returned note to the list.
 */
async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body  = bodyInput.value.trim();

  // Validation: title required, max 100 characters (input maxlength helps,
  // but we validate in JS too so programmatic submits are covered).
  if (!title) {
    setStatus("Please enter a title before creating a note.", "error");
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus("Title must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }

  setBusy(submitBtn, true);
  setStatus("Creating note...", "loading");

  try {
    const newNote = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, userId: 1 }),
    });

    // JSONPlaceholder returns 201 with the created object (and fake id).
    prependNote(newNote);
    setStatus(`Note created (status 201, id ${newNote.id}).`, "success");

    // Clear the form on success.
    noteForm.reset();
    titleInput.focus();
  } catch (error) {
    setStatus(`Could not create note: ${error.message}`, "error");
  } finally {
    setBusy(submitBtn, false);
  }
}

// ---- DELETE /posts/{id} -----------------------------------------------------
/**
 * Delete a note by id. On success, remove the corresponding <li>.
 * See the file header comment for the JSONPlaceholder persistence caveat.
 */
async function deleteNote(id, deleteBtn) {
  setBusy(deleteBtn, true);
  setStatus(`Deleting note ${id}...`, "loading");

  try {
    await request(`${API_URL}/${id}`, { method: "DELETE" });

    const li = notesList.querySelector(`li[data-id="${id}"]`);
    if (li) li.remove();

    if (notesList.children.length === 0) showEmptyState();

    setStatus(`Note ${id} deleted.`, "success");
  } catch (error) {
    setStatus(`Could not delete note ${id}: ${error.message}`, "error");
    setBusy(deleteBtn, false);
  }
}

// ---- Wiring -----------------------------------------------------------------
loadBtn.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);