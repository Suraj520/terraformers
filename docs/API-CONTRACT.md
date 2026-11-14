# Proposed classroom API boundary

This is an implementation contract for a future server. The current browser application does not call these endpoints.

| Method and path | Intended role | Rule |
|---|---|---|
| `GET /v1/teacher/classes` | teacher | Return only classes linked to the verified educator subject. |
| `GET /v1/teacher/classes/{classId}/progress` | teacher | Verify educator-to-class membership and school tenancy on every request. |
| `POST /v1/teacher/classes/{classId}/assignments` | teacher | Validate assignment, age band and class membership server-side. |
| `GET /v1/student/assignments` | student | Return published assignments for the learner's verified memberships only. |
| `PUT /v1/student/attempts/{attemptId}` | student | Verify attempt ownership; accept only allow-listed progress/evidence fields. |
| `GET /v1/student/progress` | student | Return only the authenticated learner's own progress. |
| `DELETE /v1/schools/{schoolId}/learners/{learnerId}` | school admin | Verify school-admin authority and apply documented deletion/retention rules. |

## Non-negotiable controls

- Resolve identity from a verified server session/token. Ignore client-supplied `role`, `schoolId`, `educatorId` and `learnerId` for authorization.
- Enforce school and class scope in every database query (defence in depth with database row-level policies where supported).
- Use opaque identifiers and school-managed pseudonymous learner references. Avoid full names, exact dates of birth, home addresses, personal contact details and behavioural advertising identifiers.
- Log administrative exports, assignment changes and access to sensitive class-level reports without putting student content into logs.
- Provide retention, export, correction and deletion workflows agreed with each school and reviewed under applicable local law.
- Return only the minimum learner-level data needed for the teacher's assigned classes. Students must never receive peer-level progress data.
- Treat concept scores as provisional learning evidence, not diagnoses or permanent labels. Provide context and human review.
