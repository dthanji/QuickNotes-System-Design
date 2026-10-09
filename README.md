# QuickNotes System Design

QuickNotes is a browser-based API client plus a system-design package for evolving a small notes application into a reliable service for one million registered users. The front end demonstrates GET, POST and DELETE against the JSONPlaceholder practice API; the documents specify a production API, relational data model, and scalable architecture.

## Features

- Load up to ten practice notes from JSONPlaceholder.
- Create notes with title validation (required, at most 100 characters) and optional body text.
- Delete a note from the current browser list after the mock API accepts the request.
- Visible loading, success, error and empty states.
- Three backend design documents covering API endpoints, database schema and scalable architecture.

> **Important:** JSONPlaceholder is a mock API. It simulates create and delete responses but does not persist those changes on its server. New and deleted notes are reflected in the current page's in-memory list only; reload the page to reset the demonstration.

## How to run the API client

1. Clone or download this repository.
2. Open `index.html` in a current browser, or serve the folder locally (for example, run `python -m http.server 8000` from the repository directory and open `http://localhost:8000`).
3. Click **Load notes** to fetch the first ten posts.
4. Use the form to create a note or a card's **Delete** button to remove it from the local list.
5. An internet connection is required to reach JSONPlaceholder. No backend server or API key is needed for this practice client.

The production endpoints described in the documents are a design specification, not a running backend in this repository.

## Design documents

- [API design](docs/api-design.md) — endpoints, JSON examples, status codes and error format.
- [Data model](docs/data-model.md) — entities, relationships, SQL schema, queries and indexes.
- [Architecture and scaling](docs/architecture.md) — requirements, load estimates, diagram, request flows, trade-offs and redundancy.

## What I learned

- A reusable `request()` helper centralizes HTTP status checking and error handling, while request-specific code manages loading and success messages.
- Form validation and inserting user input with `textContent` improve usability and reduce the risk of injecting untrusted HTML.
- JSONPlaceholder is useful for practicing HTTP methods, but mock success responses are not durable storage; the client must explain this limitation.
- Relational keys and junction tables express ownership and many-to-many tag relationships, while indexes support the queries users run most often.
- At one million users, load estimates should be explicit assumptions that are validated using monitoring and load testing; caching, replicas, queues and redundancy each have costs and consistency implications.

## Repository structure

```text
quicknotes-system-design/
├── index.html
├── api.js
├── style.css
├── README.md
└── docs/
    ├── api-design.md
    ├── data-model.md
    └── architecture.md
```
