# GoalGPT - Architecture Guidelines

**Role:** Senior Node.js Architect  
**Principles:** Clean Code, SOLID Principles, Scalability  
**Constraint:** "Spaghetti Code" is strictly FORBIDDEN

## TECHNICAL STACK ENFORCEMENT

### Framework
- **FASTIFY** framework strictly. Do NOT use Express.
- We need high performance for real-time match data processing.

## 1. PROJECT STRUCTURE (STRICT ENFORCEMENT)

Do not dump code into root files. Use this exact modular structure:

```
/src
  /config         # Supabase client, Redis connection, Environment variables
  /controllers    # Handles HTTP requests/responses only (NO business logic here)
  /services       # Business Logic & API Fetchers (TheSports integration goes here)
      - scheduleService.ts
      - liveScoreService.ts
      - lineupsService.ts
      - recentSyncService.ts
  /routes         # API Route definitions (Fastify plugins)
  /utils          # Helper functions (e.g., Status Mapper, Date Formatters)
  /jobs           # Cron jobs (Node-cron setup for fetching data)
  /types          # JSDoc or TypeScript definitions for TheSports API responses
  /repositories   # Data access layer (Repository Pattern)
  /middleware     # Fastify middleware (auth, validation, error handling)
  /validators     # Joi validation schemas
  server.ts       # Fastify server initialization
```

## 2. CODING STANDARDS

### Service Layer Pattern

**Controllers must never call the API or Database directly. They must call a Service.**

❌ **Wrong:**
```typescript
// controller -> db.query(...)
export const getMatch = async (req, res) => {
  const result = await pool.query('SELECT * FROM matches WHERE id = $1', [id]);
  res.json(result.rows);
};
```

✅ **Right:**
```typescript
// controller -> matchService.getMatch() -> repository.findMatch()
export const getMatch = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const match = await matchService.getMatch(request.params.id);
    reply.send({ success: true, data: match });
  } catch (error) {
    reply.status(500).send({ success: false, message: error.message });
  }
};
```

### Single Responsibility Principle

Each file must do ONE thing.

❌ **Wrong:**
```typescript
// statusMapper.js içinde database insert logic
function insertMatch(data) {
  const status = mapStatus(data.status); // Status mapping
  await db.query('INSERT INTO matches...'); // Database insert
}
```

✅ **Right:**
```typescript
// utils/statusMapper.ts
export function mapStatus(status: number): MatchStatus {
  // Only status mapping logic
}

// services/matchService.ts
export async function createMatch(data: MatchData) {
  const status = mapStatus(data.status);
  return await matchRepository.create({ ...data, status });
}
```

### No Magic Strings/Numbers

Do not write `status === 1`. Use Enums or Constants.

❌ **Wrong:**
```typescript
if (match.status === 1) {
  // ...
}
```

✅ **Right:**
```typescript
import { MatchState } from '../types/enums';

if (match.status === MatchState.NOT_STARTED) {
  // ...
}
```

### Error Handling

Do not use `console.log` for errors. Use a centralized Error Handler middleware.

❌ **Wrong:**
```typescript
try {
  await someOperation();
} catch (error) {
  console.log('Error:', error);
}
```

✅ **Right:**
```typescript
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors/AppError';
import { ErrorType } from '../utils/errors/ErrorTypes';

try {
  await someOperation();
} catch (error) {
  logger.error('Operation failed:', error);
  throw new AppError('Operation failed', 500, ErrorType.InternalServerError);
}
```

### Async/Await

Use modern ES6+ syntax. Avoid "Callback Hell".

❌ **Wrong:**
```typescript
function getData(callback) {
  fetchData((err, data) => {
    if (err) return callback(err);
    processData(data, (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  });
}
```

✅ **Right:**
```typescript
async function getData(): Promise<Data> {
  const data = await fetchData();
  const result = await processData(data);
  return result;
}
```

### Function Length Constraint

**If a function exceeds 20-30 lines, refactor it.**

Break down complex functions into smaller, focused functions.

## 3. SPECIFIC INSTRUCTION FOR API INTEGRATION

Since we are using TheSports API (which is modular), you must implement separate services for each endpoint described in the documentation provided.

❌ **Wrong:**
```typescript
// One giant fetchData.ts file
export async function fetchData(endpoint: string, params: any) {
  // All endpoints handled here
}
```

✅ **Right:**
```typescript
// services/thesports/match/recentSyncService.ts
export class RecentSyncService {
  async getMatchRecentList(params: MatchRecentParams): Promise<MatchRecent[]> {
    // Only match/recent/list logic
  }
}

// services/thesports/match/liveScoreService.ts
export class LiveScoreService {
  async getLiveMatches(): Promise<LiveMatch[]> {
    // Only live matches logic
  }
}

// services/thesports/match/lineupsService.ts
export class LineupsService {
  async getMatchLineup(matchId: string): Promise<Lineup> {
    // Only lineup logic
  }
}
```

### Incremental Update Logic

Create `recentSyncService.ts` specifically for the Incremental Update logic.

```typescript
// services/thesports/match/recentSyncService.ts
export class RecentSyncService {
  /**
   * Incremental update: Only fetch matches that have changed since last sync
   */
  async syncIncremental(lastSyncTimestamp: Date): Promise<MatchUpdate[]> {
    // Incremental update logic
  }
}
```

## 4. LAYERED ARCHITECTURE

```
Request Flow:
  Client
    ↓
  Route (routes/*.ts) - Fastify plugin
    ↓
  Controller (controllers/*.ts) - HTTP request/response handling only
    ↓
  Service (services/*.ts) - Business logic
    ↓
  Repository (repositories/*.ts) - Data access
    ↓
  Database/External API
```

### Controller Responsibilities

- Extract request parameters (params, query, body)
- Call appropriate service method
- Format response
- Handle errors (pass to error handler middleware)

### Service Responsibilities

- Business logic
- Data transformation
- External API calls
- Cache management
- Validation (business rules)

### Repository Responsibilities

- Database queries
- Data mapping
- Transaction management
- Query optimization

## 5. FILE NAMING CONVENTIONS

- **Controllers:** `*.controller.ts` (e.g., `match.controller.ts`)
- **Services:** `*.service.ts` (e.g., `match.service.ts`)
- **Repositories:** `*.repository.ts` (e.g., `match.repository.ts`)
- **Routes:** `*.routes.ts` (e.g., `match.routes.ts`) - Fastify plugins
- **Types:** `*.types.ts` (e.g., `match.types.ts`)
- **Enums:** `*.enum.ts` (e.g., `MatchState.enum.ts`)
- **Utils:** `*.util.ts` or `*.helper.ts` (e.g., `statusMapper.util.ts`)

## 6. TYPE SAFETY

- Use TypeScript strictly (no `any` types unless absolutely necessary)
- Define interfaces for all API responses
- Use enums for constants
- Use type guards for runtime validation

## 7. TESTING CONSIDERATIONS

- Services should be easily testable (dependency injection)
- Mock repositories in service tests
- Mock external APIs in service tests
- Use dependency injection for testability

## 8. CODE REVIEW CHECKLIST

Before committing code, ensure:

- [ ] No function exceeds 30 lines
- [ ] No magic strings/numbers (use enums/constants)
- [ ] Controllers don't contain business logic
- [ ] Services don't directly query database
- [ ] Error handling uses centralized error handler
- [ ] Logging uses logger utility (not console.log)
- [ ] TypeScript types are properly defined
- [ ] Single Responsibility Principle is followed
- [ ] Code is modular and reusable
- [ ] **FASTIFY is used, NOT Express**

---

## ✅ ACKNOWLEDGED

**I understand and will strictly enforce these architectural rules.**

All code will be:
- ✅ Production-ready
- ✅ Modular
- ✅ Clean
- ✅ Following SOLID principles
- ✅ Scalable
- ✅ Maintainable
- ✅ **Using FASTIFY for high performance**

**"Spaghetti Code" is FORBIDDEN.**
