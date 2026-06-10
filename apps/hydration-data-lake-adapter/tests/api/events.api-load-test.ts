// const BASE_URL = 'http://localhost:8080';
const BASE_URL = 'https://adapters.kril.hydration.cloud';
const ENDPOINT = '/dexscreener/events';
const FROM_BLOCK = 9000000;
const TO_BLOCK = 9100000;
const BATCH_SIZE = 100;

interface EventsResponse {
  events: any[];
}

async function fetchEvents(fromBlock: number, toBlock: number): Promise<EventsResponse> {
  const url = `${BASE_URL}${ENDPOINT}?fromBlock=${fromBlock}&toBlock=${toBlock}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

async function runLoadTest() {
  let currentFrom = FROM_BLOCK;
  let totalEvents = 0;
  let requestCount = 0;

  console.log(`Starting load test from block ${FROM_BLOCK} to ${TO_BLOCK} with batch size ${BATCH_SIZE}`);
  console.log('---');

  while (currentFrom <= TO_BLOCK) {
    const currentTo = Math.min(currentFrom + BATCH_SIZE - 1, TO_BLOCK);

    try {
      requestCount++;
      console.log(`Request #${requestCount}: Fetching blocks ${currentFrom} to ${currentTo}...`);

      const startTime = performance.now();
      const result = await fetchEvents(currentFrom, currentTo);
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);

      const eventsCount = result.events.length;
      totalEvents += eventsCount;

      console.log(`  � Received ${eventsCount} events (${duration}ms)`);

    } catch (error) {
      console.error(`  � Error fetching blocks ${currentFrom} to ${currentTo}:`, error);
    }

    currentFrom = currentTo + 1;
  }

  console.log('---');
  console.log(`Load test completed!`);
  console.log(`Total requests: ${requestCount}`);
  console.log(`Total events received: ${totalEvents}`);
}

runLoadTest().catch(console.error);