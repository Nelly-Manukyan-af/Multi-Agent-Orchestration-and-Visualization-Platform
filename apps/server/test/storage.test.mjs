import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { WebSocket } from "ws";
import { createTestDatabase } from "./support/database.mjs";

test("PostgreSQL persistence and reconnect", { timeout: 60000 }, async (t) => {
  const fixture = await createTestDatabase();
  let database, store, observer, server, closeHub, restoreQuery;
  const sockets = new Set();
  const publications = [], observations = [], failures = [];
  const start = { type: 'run_started', teamName: 'Test team', pattern: 'sequential', task: 'Storage regression', snapshot: [], topology: [], turnLimit: 5000 };
  const token = (i) => ({ type: 'llm_token', turnId: 'turn', text: `${i},`, channel: 'content' });
  const turn = (i) => ({ type: 'turn_started', turnId: `turn-${i}`, agentId: 'unknown', turn: i });
  const finish = { type: 'run_finished', status: 'completed', reason: 'harness', totals: { promptTokens: 7, completionTokens: 11, turns: 1, durationMs: 123 } };
  const deadline = async (promise, label, ms = 20000) => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms); })]); }
    finally { clearTimeout(timer); }
  };
  function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
  async function rows(id) { return (await observer.query('SELECT payload FROM events WHERE run_id=$1 ORDER BY seq', [id])).rows.map(r => r.payload); }
  async function summary(id) { return (await observer.query('SELECT * FROM runs WHERE id=$1', [id])).rows[0]; }
  function contiguous(events, after = 0) { assert.deepEqual(events.map(e => e.seq), Array.from({ length: events.length }, (_, i) => after + i + 1)); }
  async function seed(id) { await store.append(id, start); await store.append(id, { type: 'turn_started', turnId: 'turn', agentId: 'unknown', turn: 1 }); }
  async function collect(id, afterSeq) {
    const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
    sockets.add(socket);
    const events = [], errors = [];
    socket.on('error', e => errors.push(e.message));
    socket.on('message', raw => { const msg = JSON.parse(raw.toString()); if (msg.type === 'event') events.push(msg.event); else errors.push(msg.message); });
    await deadline(new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); }), 'ws open');
    socket.send(JSON.stringify({ type: 'subscribe', runId: id, afterSeq }));
    return {
      events,
      async until(seq) {
        const expires = Date.now() + 10000;
        while (!events.some(e => e.seq === seq)) {
          assert.equal(errors.length, 0, errors.join('; '));
          assert(Date.now() < expires, `Timed out waiting for WebSocket seq ${seq}`);
          await delay(5);
        }
        assert.equal(errors.length, 0);
      },
      async close() { if (socket.readyState === WebSocket.CLOSED) return; const closed = new Promise(r => socket.once('close', r)); socket.close(); await deadline(closed, 'ws close'); sockets.delete(socket); },
    };
  }
  // Delay the return of a real pg query, preserving real Drizzle and real SQL.
  function pageBarrier(id, pageNumber) {
    const entered = deferred(), released = deferred();
    const original = database.pool.query;
    let count = 0;
    database.pool.query = async function (...args) {
      const result = await original.apply(this, args);
      const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text;
      if (sql?.startsWith('select "payload" from "events"') && args[1]?.[0] === id && ++count === pageNumber) {
        entered.resolve(); await released.promise;
      }
      return result;
    };
    restoreQuery = () => { released.resolve(); database.pool.query = original; restoreQuery = undefined; };
    return { entered: entered.promise, release: () => restoreQuery?.() };
  }

  try {
    process.env.DATABASE_URL = fixture.url;
    database = await import("../src/db/index.ts");
    await database.migrateDatabase();
    store = await import("../src/store/eventStore.ts");
    const { applyEvent, initialState } = await import("../../../packages/shared/src/reducer.ts");
    observer = new Pool({ connectionString: fixture.url, connectionTimeoutMillis: 3000 });
    store.onPersistenceError((id, error) => failures.push({ id, error }));
    store.onAppend(event => {
      publications.push(event);
      // Independent connection must see committed rows at publication time.
      observations.push(observer.query('SELECT payload FROM events WHERE run_id=$1 AND seq=$2', [event.runId, event.seq]).then(r => assert.deepEqual(r.rows[0]?.payload, event)));
    });

    await t.test('1000 concurrent tokens: unique contiguous sequence and committed publication', async () => {
      await seed('concurrent');
      const appended = await Promise.all(Array.from({ length: 1000 }, (_, i) => store.append('concurrent', token(i))));
      await store.flushTokens('concurrent');
      assert.deepEqual(appended.map(e => e.seq), Array.from({ length: 1000 }, (_, i) => i + 3));
      const persisted = await rows('concurrent');
      assert.equal(persisted.length, 1002); contiguous(persisted);
      assert.deepEqual(persisted.slice(2), appended);
      assert.deepEqual(publications.filter(e => e.runId === 'concurrent'), persisted);
      await Promise.all(observations);
    });

    await t.test('two independent runs under interleaved concurrent appends', async () => {
      await Promise.all(['independent-a', 'independent-b'].map(seed));
      await Promise.all(Array.from({ length: 600 }, (_, i) => store.append(i % 2 ? 'independent-a' : 'independent-b', token(i))));
      await store.flushTokens();
      for (const id of ['independent-a', 'independent-b']) { const events = await rows(id); assert.equal(events.length, 302); contiguous(events); assert(events.every(e => e.runId === id)); }
      await Promise.all(observations);
    });

    await t.test('token trigger failure: atomic rollback, retained buffer, no publication, recovery flush', async () => {
      const id = 'token-failure'; await seed(id);
      await observer.query(`CREATE FUNCTION harness_fail_token() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.run_id = 'token-failure' AND NEW.seq = 52 THEN RAISE EXCEPTION 'harness token failure'; END IF; RETURN NEW; END $$`);
      await observer.query('CREATE TRIGGER harness_fail_token BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION harness_fail_token()');
      const settled = await Promise.allSettled(Array.from({ length: 100 }, (_, i) => store.append(id, token(i))));
      assert.equal(settled.filter(r => r.status === 'rejected').length, 1);
      assert(settled.find(r => r.status === 'rejected').reason instanceof store.PersistenceError);
      assert.equal((await rows(id)).length, 2);
      assert.equal(publications.filter(e => e.runId === id).length, 2);
      assert(failures.some(f => f.id === id));
      await observer.query('DROP TRIGGER harness_fail_token ON events');
      await store.flushTokens(id);
      const persisted = await rows(id); assert.equal(persisted.length, 102); contiguous(persisted);
      assert.deepEqual(persisted.slice(2).map(e => e.text), Array.from({ length: 100 }, (_, i) => `${i},`));
      assert.deepEqual(publications.filter(e => e.runId === id), persisted);
      await Promise.all(observations);
    });

    await t.test('run_finished projection failure rolls back event and summary atomically; retry succeeds', async () => {
      const id = 'projection-failure'; await seed(id);
      const before = await summary(id), stateBefore = await store.getState(id);
      await observer.query(`CREATE FUNCTION harness_fail_summary() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = 'projection-failure' THEN RAISE EXCEPTION 'harness projection failure'; END IF; RETURN NEW; END $$`);
      await observer.query('CREATE TRIGGER harness_fail_summary BEFORE UPDATE ON runs FOR EACH ROW EXECUTE FUNCTION harness_fail_summary()');
      await assert.rejects(store.append(id, finish), store.PersistenceError);
      assert.deepEqual(await summary(id), before); assert.equal((await rows(id)).length, 2);
      assert.equal(publications.filter(e => e.runId === id).length, 2);
      assert.deepEqual(await store.getState(id), stateBefore);
      await observer.query('DROP TRIGGER harness_fail_summary ON runs');
      const final = await store.append(id, finish); assert.equal(final.seq, 3);
      const after = await summary(id); assert.equal(after.status, 'completed'); assert.equal(after.total_tokens, 18); assert.equal(Number(after.duration_ms), 123); assert.equal(Number(after.finished_at), final.timestamp);
      assert.equal((await rows(id)).at(-1).type, 'run_finished');
      await Promise.all(observations);
    });

    await t.test('paged persisted replay equals reducer and current/reloaded state', async () => {
      for (const id of ['concurrent', 'independent-a', 'independent-b', 'token-failure', 'projection-failure']) {
        const persisted = await rows(id); assert.deepEqual(await store.loadEvents(id), persisted);
        assert.deepEqual(await store.loadEvents(id, 100), persisted.filter(e => e.seq > 100));
        assert.deepEqual(await store.getState(id), persisted.reduce(applyEvent, initialState));
      }
      assert.equal((await store.getState('concurrent')).turns.turn.output, Array.from({ length: 1000 }, (_, i) => `${i},`).join(''));
      await store.append('concurrent', finish);
      assert.deepEqual(await store.getState('concurrent'), (await rows('concurrent')).reduce(applyEvent, initialState));
      await Promise.all(observations);
    });

    // attachHub installs the singleton publication callback after observer tests.
    const { attachHub } = await import("../src/store/hub.ts");
    server = createServer(); closeHub = attachHub(server);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const id = 'ws-catchup'; await store.append(id, start);
    for (let i = 1; i <= 1200; i++) await store.append(id, turn(i));
    let firstEvents;
    await t.test('real WebSocket: >500-event paged catch-up with live appends between pages', async () => {
      const gate = pageBarrier(id, 2);
      let client;
      try {
        client = await collect(id, 0); await deadline(gate.entered, 'second actual catch-up page');
        for (let i = 1201; i <= 1225; i++) await store.append(id, turn(i));
        gate.release(); await client.until(1226);
        firstEvents = client.events.slice(); assert.equal(firstEvents.length, 1226); contiguous(firstEvents);
        assert.deepEqual(firstEvents, await rows(id));
        assert.deepEqual(firstEvents.reduce(applyEvent, initialState), await store.getState(id));
      } finally { gate.release(); await client?.close(); }
    });

    await t.test('real WebSocket: reconnect afterSeq, offline gap, live final during catch-up, no missing/duplicate applications', async () => {
      assert(firstEvents, 'initial catch-up required');
      for (let i = 1226; i <= 1255; i++) await store.append(id, turn(i));
      const afterSeq = 700, gate = pageBarrier(id, 2);
      let client;
      try {
        client = await collect(id, afterSeq); await deadline(gate.entered, 'reconnect second actual page');
        const final = await store.append(id, finish);
        gate.release(); await client.until(final.seq);
        contiguous(client.events, afterSeq);
        assert.deepEqual(client.events, (await rows(id)).filter(e => e.seq > afterSeq));
        const applied = firstEvents.filter(e => e.seq <= afterSeq).concat(client.events);
        contiguous(applied); assert.deepEqual(applied, await rows(id));
        assert.equal(applied.at(-1).type, 'run_finished');
        assert.deepEqual(applied.reduce(applyEvent, initialState), await store.getState(id));
      } finally { gate.release(); await client?.close(); }
    });

    await t.test('real WebSocket: already completed run delivers final event on reconnect', async () => {
      const persisted = await rows(id), last = persisted.at(-1);
      assert.equal(last.type, 'run_finished');
      const client = await collect(id, last.seq - 3);
      try { await client.until(last.seq); assert.deepEqual(client.events, persisted.slice(-3)); contiguous(client.events, last.seq - 3); }
      finally { await client.close(); }
    });
  } finally {
    restoreQuery?.();
    for (const socket of sockets) socket.terminate();
    if (closeHub) await closeHub();
    if (server?.listening) await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    try {
      if (store) await store.flushTokens();
    } finally {
      if (observer) await observer.end();
      if (database) await database.closeDatabase();
      await fixture.close();
    }
  }
});
