# Entrelinhas Demo Guide

This guide describes a five-minute demonstration of the MVP release candidate.

The demo proves the full backend flow:

```text
Incoming Message -> Webhook -> Queue -> Worker -> Parser -> Property Listing -> REST API
```

## 1. Start From A Clean Checkout

Install dependencies:

```bash
npm install
```

Create the local environment file:

```bash
cp .env.example .env
```

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

If your Docker installation uses the legacy Compose command:

```bash
docker-compose up -d
```

Run migrations:

```bash
npm run db:migrate
```

## 2. Start The API And Worker

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run dev:worker
```

Check the API:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "environment": "development",
  "status": "ok"
}
```

## 3. Send A Real Estate Message

Terminal 3:

```bash
curl -X POST http://localhost:3000/webhooks/messages \
  -H "Content-Type: application/json" \
  -d '{
    "externalMessageId": "demo_msg_001",
    "groupId": "demo_group_001",
    "groupName": "Imoveis Londrina",
    "senderId": "demo_user_001",
    "senderName": "Maria",
    "text": "VENDO CASA\n3 quartos\nJardim Europa\nLondrina - PR\nR$ 320.000\nContato: (43) 99999-9999",
    "sentAt": "2026-07-01T10:00:00.000Z"
  }'
```

The webhook returns quickly after validating, persisting, and enqueueing the message.

## 4. Confirm The Raw Message Was Accepted

```bash
curl http://localhost:3000/messages
```

Look for:

```json
{
  "processingStatus": "processed"
}
```

If the worker is still processing, run the command again after a moment.

## 5. Query The Extracted Property Listing

```bash
curl "http://localhost:3000/property-listings?city=Londrina&propertyType=house&minPrice=300000"
```

Expected shape:

```json
{
  "data": [
    {
      "intent": "sale",
      "propertyType": "house",
      "priceAmount": 320000,
      "locationText": "Jardim Europa, Londrina - PR",
      "city": "Londrina",
      "neighborhood": "Jardim Europa",
      "state": "PR",
      "bedrooms": 3,
      "contactPhone": "(43) 99999-9999"
    }
  ]
}
```

This is the core product moment: an informal group message became structured, searchable data.

## 6. Query Product Statistics

```bash
curl http://localhost:3000/statistics
```

Expected shape:

```json
{
  "data": {
    "totalReceivedMessages": 1,
    "totalPropertyListings": 1,
    "extractionSuccessRate": 100,
    "totalUnstructuredMessages": 0,
    "totalRejectedMessages": 0,
    "totalMessagesCurrentlyProcessing": 0
  }
}
```

`extractionSuccessRate` is based on processed messages, not accepted messages:

```text
listing_created parser results / processed raw messages * 100
```

## 7. Optional Negative Demo

Send a non-real-estate message:

```bash
curl -X POST http://localhost:3000/webhooks/messages \
  -H "Content-Type: application/json" \
  -d '{
    "externalMessageId": "demo_msg_002",
    "groupId": "demo_group_001",
    "groupName": "Imoveis Londrina",
    "senderId": "demo_user_002",
    "senderName": "Joao",
    "text": "Backend Developer remoto para startup",
    "sentAt": "2026-07-01T10:05:00.000Z"
  }'
```

After the worker processes it, `GET /statistics` should show one rejected message and no additional Property Listing.

## Demo Talking Points

- The webhook does not perform heavy work.
- Every raw message is persisted before processing.
- The worker owns asynchronous processing.
- Parser outcomes are business results, not technical failures.
- A Property Listing is created only when required fields are present.
- REST APIs expose the backend as a product surface.
- Current limitations are explicit: no AI, no provider adapters, no dashboard, no authentication, no multi-tenancy.
