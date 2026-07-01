# Entrelinhas Development Roadmap

This roadmap breaks the MVP into incremental milestones. Each milestone should produce a working, demonstrable system and increase the product's capabilities.

The sequence intentionally starts with the smallest useful backend surface and grows toward the full message processing pipeline:

Incoming Message -> Webhook -> Persistence -> Queue -> Worker -> Parser Result -> Property Listing -> REST APIs -> Public Release Readiness

The roadmap avoids multi-domain support, provider integrations, authentication, frontend implementation, AI features, billing, and SaaS administration. Those remain future roadmap items from the approved product requirements.

## Milestone 1: Project Foundation

### Goal

Deliver a runnable backend foundation that proves the project can be started, configured, observed at a basic level, and safely extended in later milestones.

From a product perspective, this milestone does not extract business data yet. Its value is confidence: contributors and reviewers should be able to run Entrelinhas locally and see that the backend has a stable starting point.

### Why Now?

Every later milestone depends on a predictable development environment, basic runtime health, configuration, and logging. Without this foundation, message ingestion and parser behavior would be harder to demonstrate, test, or explain in a public open-source repository.

This milestone should stay intentionally small. The goal is not to build a platform shell full of abstractions; it is to create the minimum trustworthy base for the first product capability.

### Features

- Runnable backend service.
- Local development environment.
- Health endpoint for basic availability checks.
- Environment-based configuration.
- Basic structured logging.
- Containerized local dependencies.
- Initial project documentation for running the service.
- Architecture alignment with the approved modular monolith direction.

### Acceptance Criteria

- A developer can start the project locally from a clean checkout.
- The health endpoint returns a successful response.
- Required configuration is documented and validated.
- Logs are readable and useful for local diagnosis.
- Local dependencies can be started consistently.
- The repository explains how to run the current milestone.
- No business-domain behavior is required yet.

### Out of Scope

- Message webhook.
- Raw message persistence.
- Queue processing.
- Parser behavior.
- Property listings.
- Query APIs beyond health.
- Authentication.
- Frontend dashboard.
- Provider integrations.

## Milestone 2: Message Ingestion

### Goal

Deliver the first real product capability: Entrelinhas can receive provider-agnostic messages, persist them as raw messages, and expose them through a query API.

At the end of this milestone, a user should be able to send a real estate-style message to the backend and retrieve the stored raw message.

### Why Now?

The approved PRD states that every raw message must be persisted before processing. This milestone establishes the system of record before introducing asynchronous workers or parsing. It also validates the provider-agnostic contract that protects the core application from external messaging providers.

This is the first milestone that demonstrates Entrelinhas's core product direction: chat content enters the system and becomes queryable backend data.

### Features

- Provider-agnostic incoming message webhook.
- Incoming payload validation.
- Raw message persistence.
- Basic message processing state visible to API consumers.
- Message listing API.
- Message detail API.
- Duplicate-aware ingestion behavior at the product level.
- Clear API examples for sending and retrieving messages.

### Acceptance Criteria

- A valid normalized incoming message can be submitted to the webhook.
- The webhook returns quickly after accepting the message.
- The raw message can be retrieved through the message APIs.
- Invalid payloads are rejected before entering the system.
- Re-sending the same logical message does not create confusing duplicate product data.
- Stored messages preserve enough original context to support later parsing.
- The milestone can be demonstrated without any external WhatsApp provider.

### Out of Scope

- Queue and worker processing.
- Parser result creation.
- Property listing extraction.
- Statistics API.
- Provider-specific payload translation.
- AI extraction.
- Authentication.

## Milestone 3: Asynchronous Processing

### Goal

Deliver the asynchronous processing lifecycle. Messages should no longer be merely stored; they should move through a controlled processing path after ingestion.

At the end of this milestone, a submitted message should be accepted, persisted, queued, processed by a worker, and marked with a clear processing outcome placeholder.

### Why Now?

The architecture requires heavy processing to stay out of the webhook request cycle. Before adding parser behavior, the system needs to prove that messages can flow asynchronously with observable status, retry behavior, failure handling, and idempotency.

This milestone turns Entrelinhas from a storage API into a pipeline.

### Features

- Message enqueueing after successful raw message persistence.
- Worker execution for queued messages.
- Processing lifecycle states.
- Pending, processed, and failed processing visibility.
- Retry behavior for transient technical failures.
- Idempotent processing behavior when jobs are retried.
- Clear distinction between technical processing failure and future parser rejection.
- Operational examples showing a message moving through the lifecycle.

### Acceptance Criteria

- A newly ingested message enters the asynchronous processing flow.
- Processing status changes are visible through message APIs or documented inspection paths.
- Retried jobs do not create duplicate business outcomes.
- Technical failures can be observed and diagnosed.
- The webhook remains independent from worker execution speed.
- The system can demonstrate accepted, pending, processed, and failed processing states.
- No parser-specific business decision is required yet.

### Out of Scope

- Real estate detection.
- Field extraction.
- Parser result statuses such as `listing_created`, `unstructured`, or `rejected`.
- Property listing creation.
- Listing filters.
- Statistics API beyond basic processing visibility.
- Provider adapters.

## Milestone 4: Real Estate Parser and Property Listing Creation

### Goal

Deliver the core MVP intelligence: Entrelinhas can process real estate messages, produce parser results, and create structured property listings only when the strict quality rules are satisfied.

At the end of this milestone, the sample PRD message should become a structured property listing.

### Why Now?

Once ingestion and asynchronous processing are reliable, the next product leap is extraction. This is where Entrelinhas starts solving the business problem: useful real estate opportunities stop being trapped in chat text and become structured data.

This milestone should prove the deterministic parser philosophy without adding AI or multiple domains.

### Features

- Real estate message detection.
- Property type detection.
- Sale or rental intent detection.
- Price extraction.
- Location extraction for city, neighborhood, or equivalent local reference.
- Optional extraction of useful fields such as bedrooms and contact phone.
- Parser result creation for every processed message.
- Parser result statuses:
  - `listing_created`
  - `unstructured`
  - `rejected`
- Machine-readable parser reasons for incomplete or unsupported messages.
- Strict property listing creation when required fields are present.
- Preservation of unstructured real estate messages without polluting the listing dataset.
- Rejection of unsupported non-real-estate messages.

### Acceptance Criteria

- A complete real estate listing message creates a property listing.
- A real estate-related message missing required data creates an unstructured parser result but no property listing.
- A non-real-estate message creates a rejected parser result but no property listing.
- Every processed raw message has a parser result.
- Property listings are traceable back to their originating message and parser result conceptually.
- Parser behavior is explainable through statuses and reasons.
- The parser remains deterministic and does not depend on AI.

### Out of Scope

- Multi-domain parsing.
- AI-assisted extraction.
- Confidence scores.
- Partial property listings.
- Manual review queue.
- Provider adapters.
- Advanced search or statistics beyond what is needed to verify parser outcomes.

## Milestone 5: Query APIs and Product Metrics

### Goal

Deliver the backend as a usable product API. Consumers should be able to query extracted property listings, filter them, and inspect basic processing and extraction statistics.

At the end of this milestone, Entrelinhas should be useful to a future dashboard or external API consumer.

### Why Now?

Extraction alone is not enough. The business value appears when structured listings can be searched, filtered, and measured. This milestone turns the pipeline output into a product surface.

It also validates whether the earlier parser decisions produce the metrics needed to understand system quality.

### Features

- Property listing list API.
- Property listing detail API.
- Listing filters for:
  - City
  - Neighborhood
  - Property type
  - Minimum price
  - Maximum price
- Statistics API for:
  - Total received messages
  - Total extracted listings
  - Extraction success rate
  - Messages pending processing
  - Messages rejected by parser
  - Unstructured real estate messages
- API examples that show a full product flow from message submission to listing query.
- Response shapes suitable for a future dashboard.

### Acceptance Criteria

- Extracted property listings can be listed and retrieved.
- Listings can be filtered by the required MVP filters.
- Statistics reflect actual message, parser, and listing outcomes.
- Extraction success rate can be calculated from recorded outcomes.
- Pending, rejected, and unstructured counts are visible.
- A reviewer can demonstrate the full MVP pipeline through APIs only.
- No frontend is required to understand or use the product behavior.

### Out of Scope

- Frontend dashboard.
- Authentication.
- Saved searches or alerts.
- Provider-specific integrations.
- Advanced analytics.
- Semantic search.
- Multi-tenant reporting.

## Milestone 6: Public Release Readiness

### Goal

Prepare Entrelinhas for public release as a serious open-source backend project suitable for a LinkedIn technical publication and senior engineering portfolio review.

At the end of this milestone, the repository should be clear, demonstrable, tested, documented, and honest about its trade-offs and limitations.

### Why Now?

After the product pipeline works end to end, the final MVP work should reduce operational and contributor risk. This is where the project moves from "it works locally" to "someone else can understand it, run it, trust it, and evaluate the engineering decisions."

This milestone should not expand the product scope. It should harden and explain the MVP.

### Features

- End-to-end validation of the message processing flow.
- Focused automated tests for ingestion, processing, parser outcomes, listing creation, filters, and statistics.
- Error handling review for invalid input, processing failures, parser rejections, and retries.
- Observability improvements for local diagnosis.
- Retry and idempotency validation.
- README improvements with:
  - Product overview
  - Architecture summary
  - Mermaid diagrams
  - Local setup
  - API examples
  - Demo scenario
  - Known limitations
  - Roadmap
- Documentation linking PRD, architecture, and roadmap.
- Public-release checklist for repository quality.

### Acceptance Criteria

- A new developer can understand the product from the README.
- A new developer can run the project locally using documented steps.
- The full MVP flow can be demonstrated from raw message submission to property listing query and statistics.
- Automated tests cover the critical product behaviors.
- Parser outcomes are observable and explainable.
- Known limitations are documented honestly.
- The repository is ready to be shared publicly without implying unsupported features exist.

### Out of Scope

- New product features.
- New parser domains.
- AI extraction.
- Frontend dashboard implementation.
- Authentication.
- Provider adapters.
- Production deployment automation beyond what is needed to explain local operation.

## Delivery Principles

- Each milestone should be mergeable and demonstrable on its own.
- Product behavior should lead infrastructure decisions.
- Strict MVP boundaries should be preserved.
- Every accepted message should remain traceable.
- Parser outcomes should be observable, not hidden.
- New abstractions should be added only when they clarify the current milestone or protect an approved future direction.
- Documentation should evolve with the product, not be saved entirely for the end.

## Suggested Review Gates

Each milestone should end with a short review:

- What product capability can now be demonstrated?
- Which APIs or behaviors prove it?
- What changed from the previous milestone?
- What was intentionally left out?
- What risks were discovered?
- Is the next milestone still the right next step?
