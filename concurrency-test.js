/**
 * Concurrency / oversell test for EventNest registration.
 *
 * What it does:
 * 1. Signs up 10 fresh test users
 * 2. Creates a ticket type with quantity = 3
 * 3. Fires all 10 registration requests at the exact same time (Promise.all)
 * 4. Reports how many succeeded vs failed, and checks the final quantitySold
 *
 * Expected result if the atomic increment is working correctly:
 * - Exactly 3 registrations succeed
 * - Exactly 7 fail with "sold out"
 * - Final quantitySold === 3 (never more, even though 10 requests hit it at once)
 *
 * Usage: node concurrency-test.js
 * (requires Node 18+ for built-in fetch, and your server running locally)
 */

const BASE_URL = 'http://localhost:5000/api/v1';

// EDIT THESE to match your existing org + event:
const ORG_ID = '6a8d4376d3adacdfed9a7313';
const EVENT_ID = '6a8d499c346ce714a05af783';
const ORGANIZER_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YThhYmQ2ZTc4M2E1MWNiYTZhZGZmMWIiLCJyb2xlIjoiYXR0ZW5kZWUiLCJpYXQiOjE3ODgyNzg3NDQsImV4cCI6MTc4ODI3OTY0NH0.sCu8RFCct5Wz3V6f48dZfvwb7coqQPMvz7DkjAdCjiU';

const NUM_USERS = 10;
const TICKET_QUANTITY = 3;

async function signupTestUser(i) {
  const email = `concurrency-test-${Date.now()}-${i}@example.com`;
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Test User ${i}`, email, password: 'Passw0rd123' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Signup failed for user ${i}: ${JSON.stringify(data)}`);
  return data.data.accessToken;
}

async function createLimitedTicketType() {
  const res = await fetch(`${BASE_URL}/organizations/${ORG_ID}/events/${EVENT_ID}/ticket-types`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ORGANIZER_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      name: `Concurrency Test Ticket ${Date.now()}`,
      price: 0,
      quantity: TICKET_QUANTITY,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Ticket type creation failed: ${JSON.stringify(data)}`);
  return data.data.ticketType._id;
}

async function attemptRegister(accessToken, ticketTypeId, userIndex) {
  const res = await fetch(`${BASE_URL}/registrations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ eventId: EVENT_ID, ticketTypeId }),
  });
  const data = await res.json();
  return { userIndex, success: res.ok, status: res.status, message: data.message };
}

async function checkFinalQuantitySold(ticketTypeId) {
  const res = await fetch(`${BASE_URL}/organizations/${ORG_ID}/events/${EVENT_ID}/ticket-types`, {
    headers: { Authorization: `Bearer ${ORGANIZER_ACCESS_TOKEN}` },
  });
  const data = await res.json();
  const tt = data.data.ticketTypes.find((t) => t._id === ticketTypeId);
  return tt ? tt.quantitySold : null;
}

async function main() {
  console.log(`Signing up ${NUM_USERS} test users...`);
  const tokens = [];
  for (let i = 0; i < NUM_USERS; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    tokens.push(await signupTestUser(i));
  }
  console.log('Done.\n');

  console.log(`Creating ticket type with quantity = ${TICKET_QUANTITY}...`);
  const ticketTypeId = await createLimitedTicketType();
  console.log(`Ticket type created: ${ticketTypeId}\n`);

  console.log(`Firing ${NUM_USERS} registration requests SIMULTANEOUSLY...\n`);
  const results = await Promise.all(
    tokens.map((token, i) => attemptRegister(token, ticketTypeId, i))
  );

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  results
    .sort((a, b) => a.userIndex - b.userIndex)
    .forEach((r) => {
      console.log(`User ${r.userIndex}: ${r.success ? '✅ SUCCESS' : '❌ FAILED'} (${r.status}) - ${r.message}`);
    });

  console.log(`\nSucceeded: ${succeeded.length} / ${NUM_USERS}`);
  console.log(`Failed: ${failed.length} / ${NUM_USERS}`);

  const finalSold = await checkFinalQuantitySold(ticketTypeId);
  console.log(`\nFinal quantitySold in DB: ${finalSold} (should be exactly ${TICKET_QUANTITY})`);

  if (succeeded.length === TICKET_QUANTITY && finalSold === TICKET_QUANTITY) {
    console.log('\n🎉 PASS: No overselling occurred. Concurrency control is working correctly.');
  } else {
    console.log('\n⚠️  UNEXPECTED RESULT - review the numbers above.');
  }
}

main().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});