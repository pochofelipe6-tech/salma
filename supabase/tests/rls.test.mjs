import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  ADMIN = "33333333-3333-4333-8333-333333333333";
const TRIP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test("schema, Auth profiles, ownership, RLS, roles and atomic idempotent inserts", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated;
 insert into auth.users(id,email) values('${A}','a@example.com');`);
    await db.exec(
      await readFile(
        new URL("../migrations/202611100001_velo.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(new URL("../seed.sql", import.meta.url), "utf8"),
    );
    await db.exec(
      `insert into auth.users(id,email,raw_user_meta_data) values('${B}','b@example.com','{"role":"admin","full_name":"Conductor B"}'),('${ADMIN}','admin@example.com','{}');update public.profiles set role='admin' where id='${ADMIN}';`,
    );
    const as = async (id) => {
      await db.exec(
        `reset role;select set_config('request.jwt.claim.sub','${id || ""}',false);set role ${id ? "authenticated" : "anon"};`,
      );
    };
    const payload = {
      id: TRIP,
      driver: "Conductor A",
      plate: "ABC123",
      started_at: "2026-11-10T14:00:00Z",
      ended_at: null,
      distance_km: 0.1,
      points: [
        {
          sequence: 0,
          recorded_at: "2026-11-10T14:00:01Z",
          latitude: 4.65,
          longitude: -74.08,
          accuracy_m: 8,
          speed_kmh: 64,
        },
      ],
      events: [
        {
          client_id: 1001,
          zone_code: "urban",
          sector: "GPS Bogotá",
          recorded_at: "2026-11-10T14:00:01Z",
          latitude: 4.65,
          longitude: -74.08,
          speed_kmh: 64,
          limit_kmh: 999,
        },
      ],
    };
    const sync = (p) =>
      db.query("select public.sync_trip($1::jsonb)", [JSON.stringify(p)]);
    await t.test(
      "seed has correct limits and Auth ignores user-supplied admin metadata",
      async () => {
        const z = await db.query(
          "select speed_limit from public.speed_zones order by speed_limit",
        );
        assert.deepEqual(
          z.rows.map((r) => r.speed_limit),
          [30, 35, 50, 70],
        );
        const r = await db.query(
          "select role from public.profiles where id=$1",
          [B],
        );
        assert.equal(r.rows[0].role, "conductor");
        assert.equal(
          (await db.query("select count(*)::int n from public.profiles"))
            .rows[0].n,
          3,
        );
      },
    );
    await t.test(
      "driver writes trip once and database computes the true speed limit",
      async () => {
        await as(A);
        await sync(payload);
        await sync(payload);
        assert.equal(
          (await db.query("select count(*)::int n from public.trip_points"))
            .rows[0].n,
          1,
        );
        assert.equal(
          (await db.query("select count(*)::int n from public.speed_events"))
            .rows[0].n,
          1,
        );
        const e = (
          await db.query("select limit_kmh,excess_kmh from public.speed_events")
        ).rows[0];
        assert.equal(e.limit_kmh, 50);
        assert.equal(Number(e.excess_kmh), 14);
      },
    );
    await t.test(
      "driver cannot promote self, write tables directly or see another profile",
      async () => {
        await assert.rejects(
          () =>
            db.query("update public.profiles set role='admin' where id=$1", [
              A,
            ]),
          /permission denied/i,
        );
        await assert.rejects(
          () =>
            db.query(
              "insert into public.vehicles(driver_id,plate) values($1,'XYZ123')",
              [A],
            ),
          /permission denied/i,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.profiles where id=$1",
              [B],
            )
          ).rows[0].n,
          0,
        );
        await db.query(
          "update public.profiles set full_name='Nombre nuevo' where id=$1",
          [A],
        );
      },
    );
    await t.test(
      "second driver cannot read or mutate first driver trip/points/events",
      async () => {
        await as(B);
        for (const table of [
          "trips",
          "trip_points",
          "speed_events",
          "vehicles",
        ])
          assert.equal(
            (await db.query(`select count(*)::int n from public.${table}`))
              .rows[0].n,
            0,
          );
        await assert.rejects(
          () => sync({ ...payload, driver: "Conductor B" }),
          /otro conductor/,
        );
      },
    );
    await t.test(
      "invalid speed event rolls back trip and points atomically",
      async () => {
        const invalid = {
          ...payload,
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          events: [{ ...payload.events[0], speed_kmh: 20 }],
        };
        await assert.rejects(() => sync(invalid), /check constraint/);
        assert.equal(
          (await db.query("select count(*)::int n from public.trips")).rows[0]
            .n,
          0,
        );
      },
    );
    await t.test(
      "admin can read all data but cannot impersonate a driver",
      async () => {
        await as(ADMIN);
        for (const table of [
          "trips",
          "trip_points",
          "speed_events",
          "vehicles",
        ])
          assert.equal(
            (await db.query(`select count(*)::int n from public.${table}`))
              .rows[0].n,
            1,
          );
        assert.equal(
          (await db.query("select count(*)::int n from public.profiles"))
            .rows[0].n,
          3,
        );
        await assert.rejects(() => sync(payload), /sesión de conductor/);
      },
    );
    await t.test(
      "anonymous requests cannot read tables or execute sync",
      async () => {
        await as(null);
        await assert.rejects(
          () => db.query("select * from public.trips"),
          /permission denied/,
        );
        await assert.rejects(() => sync(payload), /permission denied/);
      },
    );
    await t.test(
      "finalizing is idempotent and old snapshots cannot reopen the trip",
      async () => {
        await as(A);
        await sync({ ...payload, ended_at: "2026-11-10T14:01:00Z" });
        await sync(payload);
        assert.notEqual(
          (await db.query("select ended_at from public.trips")).rows[0]
            .ended_at,
          null,
        );
      },
    );
  } finally {
    await db.close();
  }
});
