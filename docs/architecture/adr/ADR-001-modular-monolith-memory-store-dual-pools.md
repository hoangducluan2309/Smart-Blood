# ADR-001: Modular Monolith, Dual MSSQL Connection Pools & In-Process MemoryStore

- **Status:** Accepted
- **Date:** 2026-11-11
- **Authors:** SmartBlood Architecture & Backend Engineering Team
- **Source of Truth:** `docs/Architechture.md` (§2, §4, §5, §6, §7, §8, §9) & `docs/Skill.md` (§1, §4, §5, §8)

## 1. Context

SmartBlood operates as an integrated blood donation center, rare blood zero-trust vault, FEFO blood bag inventory, emergency hospital dispatch, and donor portal on a **single Windows/Linux VPS (2–4 vCPU, 4–8 GB RAM)** supporting Biên Hòa Red Cross Center and partner hospitals in Đồng Nai.

Key architectural constraints from `docs/Skill.md` & `docs/Architechture.md`:
- Locked backend stack: Node.js 22 LTS + Express + TypeScript (strict) + `mssql` + Socket.io + Zod + JWT + AES-256-GCM + Winston.
- No Redis or external distributed cache is permitted unless single-instance scale limits are exceeded.
- Concurrency hazards exist at two levels:
  1. High-volume read/SSE/display & public check-in traffic (`lookup-cccd`, `submit`) vs. slow reporting/dashboard aggregations.
  2. Transactional race conditions during **STT queue ticket issuance**, **84-day donation interval checks**, and **FEFO emergency blood bag dispatch** (`UPDLOCK`, `ROWLOCK`, `READPAST`).
- Zero-trust privacy requires sealing `Rh-` donor contact details in an encrypted vault with **dual-custody OTP approval** (`requesterId <> approverId`) and **15-minute access windows**, plus non-PII JSON observability and immutable hash-chained `AuditLogs`.

## 2. Decision

1. **Modular Monolith (`backend/src/modules/`):** Partition business domains into 6 isolated modules (`event-qr`, `public-checkin`, `medical-workflow`, `inventory-vault`, `hospital`, `donor-portal`) communicating strictly through a typed in-process `TypedDomainEventBus` (`backend/src/shared/domain-events.ts`) and Express routers mounted under `/api/v1/*`.
2. **Dual `mssql` Connection Pools (`backend/src/config/database.ts`):**
   - `mainPool` (`max: 15`, `min: 2`): serves OLTP stored procedures, auth, medical workflow, emergency alerts, FEFO dispatch, and vault mutations.
   - `analyticsPool` (`max: 5`, `min: 0`): isolates read-heavy dashboard summaries, quarantine/inventory listings, and audit log queries so analytical scans cannot starve transactional check-in/dispatch connections.
3. **Database-First Transactional Integrity (`database/stored-procedures/`):** All multi-table mutations (`sp_SubmitDonorCheckIn`, `sp_DispatchBloodBagsFEFO`, `sp_ApproveVaultUnlock`, `sp_AdminUpdateUserStatus`, etc.) execute inside SQL Server `READ COMMITTED` transactions with `SET ANSI_NULLS ON`, `SET QUOTED_IDENTIFIER ON`, `UPDLOCK, ROWLOCK` (and `READPAST` for FEFO), plus chained SHA-256 `AuditLogs` via `sp_WriteAuditLog`.
4. **Bounded In-Process `MemoryStore` (`backend/src/shared/memory-store.ts`):** Manages ephemeral OTPs (`otp:verify:*`, `otp:reset:*`, `otp:vault:*` with 3-attempt eviction), progressive login brute-force locks (`lock:user:{id}`: 5 fails -> 3m -> 15m -> 1h, never auto-setting permanent `LOCKED`), CCCD lookup throttling, and QR binary cache (`max 100 entries`, FIFO eviction on capacity overflow, 15s purge sweep).
5. **Typed 6-Namespace Socket.io Server (`backend/src/sockets/index.ts`):** Isolates RBAC per namespace (`/staff`, `/donor`, `/display`, `/emergency`, `/inventory`, `/hospital`), stripping `hoTen` and `lyDoTamHoan` from `/donor` and `/display` broadcasts.

## 3. Alternatives Considered

- **Microservices + Redis + Message Broker (RabbitMQ/Kafka):** Rejected because `docs/Skill.md` §1 locks dependencies to a single Node.js + MSSQL 2019 stack for single-VPS operations; running separate brokers and orchestrators violates hardware budget and increases failure surface without solving single-DB consistency better than MSSQL `UPDLOCK/READPAST`.
- **ORM (Prisma/TypeORM) instead of parameterized `mssql` + Stored Procedures:** Rejected because ORM-generated queries cannot natively express SQL Server `WITH (UPDLOCK, ROWLOCK, READPAST)` FEFO bag locking, `OUTPUT` / transactional hash-chained `AuditLogs`, or least-privilege SP-only database execution.
- **Single Shared Connection Pool:** Rejected because heavy inventory/audit queries during peak blood drives could exhaust connections needed for sub-second `emergency:red_alert` and hospital dispatch workflows.

## 4. Consequences

### Positive
- Zero extra infrastructure containers beyond `mssql`, `backend`, and `nginx` (`docker-compose.yml`).
- Deterministic concurrency safety on STT numbering (`sp_SubmitDonorCheckIn`) and FEFO bag allocation (`sp_DispatchBloodBagsFEFO`).
- Strict PII isolation across HTTP logs (Winston redaction), public Socket.io namespaces, and `RareBloodVault` (nullifying plaintext phone/address on `Donors`).
- Clear horizontal split path later: extracting `MemoryStore` -> Redis or promoting `domainEvents` -> message bus stays encapsulated inside `shared/`.

### Trade-offs & Mitigations
- **Single Node.js Process Assumption:** Because `MemoryStore` (OTPs, brute-force locks, QR cache) and Socket.io rooms reside in RAM, Nginx sticky sessions (`ip_hash`) and a single `backend` replica are used unless replaced by a Redis adapter (`Scale Trigger`: when concurrent users/sockets saturate 1 Node event loop or multi-node failover is required).
- **Least-Privilege SQL Role Execution:** Stored procedure compilation requires `SET ANSI_NULLS ON` and `SET QUOTED_IDENTIFIER ON` so filtered indexes (`idx_Donors_userId`, `idx_BloodBags_destinationHospitalId`) succeed when `hienmau_app` invokes SPs.

## 5. Compliance Verification

- Verified by `backend/src/` strict TypeScript build (`pnpm typecheck`, `pnpm build:backend`).
- Verified against real MSSQL 2019 (`HienMauDB`) across automated test tiers (`tests/unit/*.test.ts`, `tests/integration/*.test.ts`, `tests/e2e/*.test.ts`): 84-day rule boundary, FEFO locking, rare blood sealing + dual custody + 15-minute expiry, cross-hospital IDOR blocking, brute-force lock + admin unlock, immutable audit logs, and WebSocket namespace RBAC + PII stripping.
- Verified with `docker-compose.yml` + `nginx/default.conf` reverse proxy WebSocket/gzip config.
