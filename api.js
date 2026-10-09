"use strict";

const API_URL = "https://jsonplaceholder.typicode.com/posts";
const NOTES_LIMIT = 10;

const loadButton = document.querySelector("#load-btn");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitButton = document.querySelector("#submit-btn");
const statusMessage = document.querySelector("#status");
const notesList = document.querySelector("#notes-list");

let notes = [];
// JSONPlaceholder doesn't persist POST results; use negative IDs locally if a mock response has no ID.
let nextLocalId = -1;

/** Reusable HTTP helper: check response.ok and report non-2xx responses as errors. */
async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`The server returned ${response.status} ${response.statusText || "for this request"}.`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return { data: null, status: response.status };

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("The server returned an invalid JSON response.");
    }
  }
  return { data, status: response.status };
}

function setStatus(message, kind = "") {
  statusMessage.textContent = message;
  statusMessage.classList.remove("status--success", "status--error");
  if (kind === "success") statusMessage.classList.add("status--success");
  if (kind === "error") statusMessage.classList.add("status--error");
}

function renderNotes() {
  notesList.replaceChildren();

  if (notes.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No notes yet. Load notes or create your first note.";
    notesList.appendChild(emptyItem);
    return;
  }

  notes.forEach((note) => {
    const item = document.createElement("li");
    item.className = "note-card";
    item.dataset.noteId = String(note.id);

    const heading = document.createElement("h3");
    heading.textContent = note.title || "(Untitled note)";

    const body = document.createElement("p");
    body.className = "note-body";
    body.textContent = note.body || "No body provided.";

    const meta = document.createElement("p");
    meta.className = "note-meta";
    meta.textContent = `Note #${note.id}`;

    const actions = document.createElement("div");
    actions.className = "note-actions";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button--danger";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteNote(note.id, deleteButton));

    actions.appendChild(deleteButton);
    item.append(heading, body, meta, actions);
    notesList.appendChild(item);
  });
}

async function loadNotes() {
  loadButton.disabled = true;
  setStatus("Loading notes...");
  try {
    const result = await request(`${API_URL}?_limit=${NOTES_LIMIT}`);
    notes = Array.isArray(result.data) ? result.data : [];
    renderNotes();
    if (notes.length === 0) {
      setStatus("The server returned no notes. You can create one below.", "success");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    setStatus(`Could not load notes. Please try again. ${error.message}`, "error");
  } finally {
    loadButton.disabled = false;
  }
}

async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title) {
    setStatus("Please enter a title before creating a note.", "error");
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus("The title must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }

  submitButton.disabled = true;
  setStatus("Creating note...");
  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title, body, userId: 1 })
    });

    const created = result.data || { title, body, userId: 1, id: nextLocalId-- };
    // JSONPlaceholder returns a simulated POST response and does not persist this note on its server.
    // Keep the returned item in the browser's in-memory list and explain the limitation in the UI.
    notes = [created, ...notes];
    renderNotes();
    setStatus(`Note created (status ${result.status}, id ${created.id}). JSONPlaceholder does not persist created notes.`, "success");
    noteForm.reset();
  } catch (error) {
    setStatus(`Could not create the note. Please try again. ${error.message}`, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteNote(noteId, button) {
  const previousText = button.textContent;
  const noteIdString = String(noteId);
  button.disabled = true;
  button.textContent = "Deleting...";
  setStatus("Deleting note...");
  try {
    const result = await request(`${API_URL}/${encodeURIComponent(noteIdString)}`, { method: "DELETE" });
    // JSONPlaceholder simulates DELETE as well; update only the local list after the mock request succeeds.
    notes = notes.filter((note) => String(note.id) !== noteIdString);
    renderNotes();
    setStatus(`Note ${noteId} deleted (status ${result.status}). This change is local to this demo.`, "success");
  } catch (error) {
    button.disabled = false;
    button.textContent = previousText;
    setStatus(`Could not delete note ${noteId}. Please try again. ${error.message}`, "error");
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = previousText;
    }
  }
}

loadButton.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);

// Loading is user-triggered so "Loading notes..." is visible when the button is clicked.
