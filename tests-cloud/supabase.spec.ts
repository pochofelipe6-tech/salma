import { test, expect } from "@playwright/test";
test("real-auth mode syncs GPS batches, retries failed saves and awaits final save before logout", async ({
  page,
}) => {
  const uid = "11111111-1111-4111-8111-111111111111";
  let role = "conductor",
    offline = false;
  const payloads: Record<string, any>[] = [];
  await page.addInitScript(() => {
    let callback: PositionCallback;
    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition: (cb: PositionCallback) => {
          callback = cb;
          return 1;
        },
        clearWatch: () => {},
      },
    });
    Object.assign(window, {
      gpsFix: (speed: number) =>
        callback({
          coords: {
            latitude: 4.65,
            longitude: -74.08,
            accuracy: 5,
            speed: speed / 3.6,
          },
          timestamp: Date.now(),
        } as GeolocationPosition),
    });
  });
  await page.route("https://velo-test.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const user = {
      id: uid,
      email: "real@example.com",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    };
    if (url.pathname === "/auth/v1/token") {
      const token = [
        { alg: "HS256", typ: "JWT" },
        {
          sub: uid,
          role: "authenticated",
          aud: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        "test",
      ]
        .map((s, i) =>
          i === 2 ? s : Buffer.from(JSON.stringify(s)).toString("base64url"),
        )
        .join(".");
      return route.fulfill({
        json: {
          access_token: token,
          refresh_token: "test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        },
      });
    }
    if (url.pathname === "/auth/v1/user") return route.fulfill({ json: user });
    if (url.pathname === "/auth/v1/logout")
      return route.fulfill({ status: 204 });
    if (url.pathname === "/rest/v1/profiles")
      return route.fulfill({
        json: { id: uid, email: user.email, full_name: "", role },
      });
    if (url.pathname === "/rest/v1/rpc/sync_trip") {
      if (offline)
        return route.fulfill({
          status: 400,
          json: { message: "Sin conexión", code: "TEST_OFFLINE" },
        });
      const p = request.postDataJSON().p_payload;
      payloads.push(p);
      return route.fulfill({ json: p.id });
    }
    if (
      url.pathname === "/rest/v1/trips" ||
      url.pathname === "/rest/v1/speed_events"
    )
      return route.fulfill({ json: [] });
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected mocked endpoint " + url.pathname },
    });
  });
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByText("ACCESO CON SUPABASE")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Usar cuenta de prueba" }),
  ).toHaveCount(0);
  await page.getByLabel("Correo electrónico").fill("real@example.com");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("not-a-real-password");
  await page
    .getByRole("button", { name: "Entrar como conductor", exact: true })
    .click();
  await expect(page).toHaveURL(/\/conductor$/);
  await page.getByLabel("Tu nombre").fill("Conductor real");
  await page.getByLabel("Placa del vehículo").fill("XYZ123");
  await page.getByRole("button", { name: "Permitir ubicación" }).click();
  await page.evaluate(() => (window as any).gpsFix(0));
  await page
    .getByRole("button", { name: "Iniciar recorrido", exact: true })
    .click();
  await expect.poll(() => payloads.length).toBe(1);
  expect(payloads[0].points[0].sequence).toBe(0);
  offline = true;
  await page.evaluate(() => (window as any).gpsFix(64));
  await page.clock.fastForward(16000);
  await expect(
    page.getByText("Pendiente de sincronización", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (uid) =>
        JSON.parse(localStorage.getItem("velo-pending-trips:" + uid) || "[]")
          .length,
      uid,
    ),
  ).toBe(1);
  offline = false;
  await page.evaluate(() => (window as any).gpsFix(45));
  await page.clock.fastForward(16000);
  await expect.poll(() => payloads.length).toBeGreaterThan(1);
  const synced = payloads.at(-1)!;
  expect(synced.events[0].zone_code).toBe("urban");
  expect(synced.events[0].speed_kmh).toBe(64);
  expect(synced.points[0].sequence).toBe(1);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(payloads.at(-1)!.ended_at).not.toBeNull();
  expect(
    await page.evaluate(
      (uid) =>
        JSON.parse(localStorage.getItem("velo-pending-trips:" + uid) || "[]")
          .length,
      uid,
    ),
  ).toBe(0);
  role = "admin";
  await page.getByLabel("Correo electrónico").fill("real@example.com");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("not-a-real-password");
  await page
    .getByRole("button", { name: "Entrar como conductor", exact: true })
    .click();
  await expect(page.locator(".login-error")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
