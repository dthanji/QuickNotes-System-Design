# QuickNotes REST API Design

## Overview

The production API is versioned under `/api/v1`. All endpoints use HTTPS and JSON unless otherwise stated. The API authenticates users with a secure session or bearer token; examples below show the authenticated user's perspective, so a client cannot choose another user's ownership by supplying a different user ID. Notes are scoped to the current user.

## Endpoints

| Method | Path | Description | Success |
|---|---|---|---|
| GET | `/api/v1/notes?limit=20&cursor={cursor}` | List the signed-in user's notes, newest first, using cursor pagination. | `200 OK` |
| GET | `/api/v1/notes/{noteId}` | Retrieve one note belonging to the signed-in user. | `200 OK` |
| POST | `/api/v1/notes` | Create a note for the signed-in user. | `201 Created` |
| PATCH | `/api/v1/notes/{noteId}` | Update supplied fields on an owned note. | `200 OK` |
| DELETE | `/api/v1/notes/{noteId}` | Delete an owned note. | `204 No Content` |
| GET | `/api/v1/tags` | List the signed-in user's tags. | `200 OK` |
| PUT | `/api/v1/notes/{noteId}/tags/{tagId}` | Attach an owned tag to an owned note; idempotent for an existing link. | `204 No Content` |
| DELETE | `/api/v1/notes/{noteId}/tags/{tagId}` | Detach a tag from a note. | `204 No Content` |

Cursor pagination should impose a maximum page size (for example, 100) to protect the service from unbounded queries. The server derives user ownership from authentication and checks it on every read or mutation.

## List notes: request and response

**Request**

```http
GET /api/v1/notes?limit=20 HTTP/1.1
Host: api.quicknotes.example
Authorization: Bearer <access-token>
Accept: application/json
```

**Response — `200 OK`**

```json
{
  "data": [
    {
      "id": "note_8d2f",
      "title": "Prepare project outline",
      "body": "List the milestones and risks.",
      "tags": ["work", "planning"],
      "createdAt": "2026-10-09T09:00:00Z",
      "updatedAt": "2026-10-09T09:30:00Z"
    }
  ],
  "page": {
    "nextCursor": null,
    "limit": 20
  }
}
```

An empty collection returns `200 OK` with `"data": []`, not a 404.

## Create a note: request and response

**Request**

```http
POST /api/v1/notes HTTP/1.1
Host: api.quicknotes.example
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "title": "Read about API design",
  "body": "Review REST conventions before the meeting.",
  "tagIds": ["tag_work"]
}
```

The title is required and must contain 1–100 characters after trimming. Body is optional. Unknown fields should be rejected or explicitly ignored according to the published contract; the API never accepts a client-supplied owner ID.

**Response — `201 Created`**

```http
Location: /api/v1/notes/note_9a71
```

```json
{
  "data": {
    "id": "note_9a71",
    "title": "Read about API design",
    "body": "Review REST conventions before the meeting.",
    "tags": ["work"],
    "createdAt": "2026-10-09T10:10:00Z",
    "updatedAt": "2026-10-09T10:10:00Z"
  }
}
```

## Update and delete examples

- `PATCH /api/v1/notes/note_9a71` with `{"title":"API design checklist"}` returns `200 OK` and the updated note representation.
- `DELETE /api/v1/notes/note_9a71` returns `204 No Content` after deletion. A repeated delete returns `404 Not Found` under this API's chosen contract.

## Error statuses

All errors use a consistent envelope with a stable machine-readable code, a safe human-readable message, and a request ID for troubleshooting.

| Status | Meaning | Typical case |
|---|---|---|
| `400 Bad Request` | Request syntax or validation is invalid. | Missing title, title over 100 characters, invalid JSON, or invalid pagination. |
| `401 Unauthorized` | Authentication is missing or invalid. | Expired or absent bearer token. |
| `403 Forbidden` | Authenticated caller lacks permission. | Attempting an operation disallowed by account policy. |
| `404 Not Found` | Resource does not exist or is not visible to this user. | Unknown note ID or a note owned by another user. |
| `409 Conflict` | Request conflicts with current resource state. | A version check detects a concurrent edit. |
| `429 Too Many Requests` | Caller has exceeded a rate limit. | Too many requests in a short interval. |
| `500 Internal Server Error` | Unexpected server failure. | Unhandled database or application error. |

**Example error response — `400 Bad Request`**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required and must be 100 characters or fewer.",
    "details": {
      "field": "title"
    },
    "requestId": "req_01J9KQ8Z6P"
  }
}
```

Server errors must not expose stack traces, SQL, credentials, or internal implementation details. The request ID connects the client response to internal logs.
