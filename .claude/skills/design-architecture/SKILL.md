---
name: design-architecture
description: Think through a non-trivial architecture or system-design decision for Tabletop Trainer (new subsystem, data model, trust boundary, multi-user feature) and record it as a decision doc before writing code. Use when the change spans more than one module or introduces state, identity, money, or email.
---

# Design an architecture change

For work where the *design* is the hard part and the code follows. If the change
fits in one module and the tests obviously cover it, skip this — just build it.

## 1. State the decision in one sentence

"We will X so that Y." If you can't, the problem isn't understood yet. Write down
what is explicitly **out** of scope too — most design rot is unstated scope.

## 2. Find the invariant you get for free

Before adding machinery, ask what the system already guarantees. This codebase's
engine is **pure and deterministic**, which is why the server can re-grade a
submitted move list and anti-cheat needs no extra subsystem. Leaning on an
existing invariant beats inventing a mechanism.

Then ask the inverse: **what does this change break?** Determinism, the
explainable-scoring contract, and "no secrets in the client" are load-bearing.
A design that erodes one of them needs an explicit, written justification.

## 3. Draw the trust boundary

Name every actor (browser, Edge Function, database, mail provider, scheduler) and
decide, per piece of data, **who is allowed to assert it**. Anything the client
asserts must be either verified or recomputed. Anything secret must live only on
the far side of the boundary.

## 4. Model the data with the failure modes in mind

- What is the natural key, and what breaks if it ever changes? (Email as PK is
  fine until someone changes their email — note the migration path.)
- Which operations must be idempotent (sends, grants, payments)? Give each a
  claim row or unique constraint so a retry is safe.
- Which are one-shot (first attempt wins)? Enforce with a primary key, not
  application logic.
- Add an index for every lookup path, especially token lookups.

## 5. Choose boring technology, and say why

Prefer the option with the fewest moving parts that meets the actual scale.
Record the runner-up and the tradeoff — the next person needs to know it was
considered, not guessed.

## 6. Write it down, then phase it

Produce a doc in `tabletop-trainer/docs/` with:

- A mermaid system diagram and, if there's state, the schema as real SQL.
- The trust model in plain language ("the client sends moves, never scores").
- Security/privacy notes: secrets, PII, consent, deletion.
- **Phased delivery** — each phase independently shippable and verifiable.
- Open decisions, each with your recommended default.

Then implement one phase at a time, keeping `npm test` and `npm run build` green
at every step. See `docs/MULTIPLAYER.md` for a worked example.
