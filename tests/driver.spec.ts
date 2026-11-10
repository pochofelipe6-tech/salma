import { login } from "./login-helper";
import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page) {
  await page.addInitScript(() => {
    let success: PositionCallback, error: PositionErrorCallback | undefined;
    let stopped = false;
    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition: (s: PositionCallback, e: PositionErrorCallback) => {
          success = s;
          error = e;
          stopped = false;
          return 1;
        },
        clearWatch: () => {
          stopped = true;
        },
      },
    });
    Object.assign(window, {
      gpsFix: (speed: number | null, lat = 4.65) => {
        if (!stopped)
          success({
            coords: {
              latitude: lat,
              longitude: -74.08,
              accuracy: 8,
              speed: speed === null ? null : speed / 3.6,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
      },
      gpsError: () =>
        error?.({ code: 1, message: "denied" } as GeolocationPositionError),
    });
  });
  await login(page);
  await page.getByLabel("Tu nombre").fill("Felipe García");
  await page.getByLabel("Placa del vehículo").fill("abc123");
}
async function fix(page: Page, speed: number | null, lat = 4.65) {
  await page.evaluate(
    ({ speed, lat }) =>
      (
        window as unknown as {
          gpsFix: (speed: number | null, lat: number) => void;
        }
      ).gpsFix(speed, lat),
    { speed, lat },
  );
}
test("records GPS route, one alert per episode and zone, persists and exports trip", async ({
  page,
}) => {
  await setup(page);
  await expect(
    page.getByRole("button", { name: "Iniciar recorrido", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Permitir ubicación" }).click();
  await fix(page, 0);
  await page
    .getByRole("button", { name: "Iniciar recorrido", exact: true })
    .click();
  await fix(page, 42, 4.6501);
  await expect(
    page.getByText("Vas bien. Sigue cuidando tu camino."),
  ).toBeVisible();
  await page.waitForTimeout(10);
  await fix(page, 64, 4.6502);
  await expect(
    page.getByText("Reduce la velocidad · Límite 50 km/h"),
  ).toBeVisible();
  await page.waitForTimeout(10);
  await fix(page, 65, 4.6503);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("velo-events") || "[]").length,
      ),
    )
    .toBe(1);
  await page.getByLabel("Zona por la que circulas").selectOption("3");
  await expect(
    page.getByText("Reduce la velocidad · Límite 30 km/h"),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("velo-events") || "[]").length,
      ),
    )
    .toBe(2);
  await fix(page, 20, 4.6504);
  await page.waitForTimeout(10);
  await fix(page, 42, 4.6505);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("velo-events") || "[]").length,
      ),
    )
    .toBe(3);
  await page.getByRole("button", { name: "Finalizar recorrido" }).click();
  await expect(page.getByText("Recorrido finalizado, Felipe.")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar recorrido" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/velo-recorrido/);
  const trip = await page.evaluate(
    () => JSON.parse(localStorage.getItem("velo-trips") || "[]")[0],
  );
  expect(trip.events).toHaveLength(3);
  expect(trip.points.length).toBeGreaterThan(3);
  expect(trip.distance).toBeGreaterThan(0);
  expect(trip.plate).toBe("ABC123");
  await page.reload();
  await expect(page.getByLabel("Tu nombre")).toHaveValue("Felipe García");
  await expect(page.getByText("Tus últimos recorridos")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await login(page, "admin");
  await expect(
    page.getByRole("heading", { name: "Cada kilómetro, bajo control." }),
  ).toBeVisible();
  await expect(
    page.locator("table").getByText("Felipe García").first(),
  ).toBeVisible();
});
test("handles denied location and absent speed without false alerts", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Permitir ubicación" }).click();
  await page.evaluate(() =>
    (window as unknown as { gpsError: () => void }).gpsError(),
  );
  await expect(page.locator(".driver-error")).toContainText("denegado");
  await expect(
    page.getByRole("button", { name: "Iniciar recorrido", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Permitir ubicación" }).click();
  await fix(page, 0);
  await page
    .getByRole("button", { name: "Iniciar recorrido", exact: true })
    .click();
  await fix(page, null);
  await expect(
    page.getByText("Esperando velocidad del dispositivo"),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("velo-events")),
  ).toBeNull();
  await page.getByRole("button", { name: "Finalizar recorrido" }).click();
});
test("responsive driver map and stale GPS", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await setup(page);
  await page.getByRole("button", { name: "Permitir ubicación" }).click();
  await fix(page, 0);
  await page
    .getByRole("button", { name: "Iniciar recorrido", exact: true })
    .click();
  await fix(page, 38, 4.6501);
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: "test-results/driver-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(900);
  await page.screenshot({
    path: "test-results/driver-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.clock.install();
  await page.clock.fastForward(17000);
  await expect(page.getByText("Sin señal GPS reciente")).toBeVisible();
  await expect(page.locator(".driver-speed strong")).toHaveText("—km/h");
  expect(errors).toEqual([]);
});
