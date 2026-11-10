import { login } from "./login-helper";
import { test, expect } from "@playwright/test";
test("audio repeats while over limit, respects mute, and stops with stale GPS", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const create = AudioContext.prototype.createOscillator;
    let beeps = 0;
    AudioContext.prototype.createOscillator = function () {
      beeps++;
      return create.call(this);
    };
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
      beeps: () => beeps,
      fix: (speed: number) =>
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
  await login(page);
  await page.getByLabel("Tu nombre").fill("Felipe");
  await page.getByLabel("Placa del vehículo").fill("ABC123");
  await page.getByRole("button", { name: "Permitir ubicación" }).click();
  await page.evaluate(() =>
    (window as unknown as { fix: (s: number) => void }).fix(0),
  );
  await page
    .getByRole("button", { name: "Iniciar recorrido", exact: true })
    .click();
  await page.evaluate(() =>
    (window as unknown as { fix: (s: number) => void }).fix(65),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { beeps: () => number }).beeps(),
      ),
    )
    .toBe(3);
  await page.clock.install();
  await page.clock.fastForward(6500);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { beeps: () => number }).beeps(),
      ),
    )
    .toBe(6);
  await page.getByRole("button", { name: "Sonido activado" }).click();
  await page.clock.fastForward(6500);
  expect(
    await page.evaluate(() =>
      (window as unknown as { beeps: () => number }).beeps(),
    ),
  ).toBe(6);
  await page.getByRole("button", { name: "Sonido desactivado" }).click();
  await page.clock.fastForward(17000);
  await expect(page.getByText("Sin señal GPS reciente")).toBeVisible();
  const count = await page.evaluate(() =>
    (window as unknown as { beeps: () => number }).beeps(),
  );
  await page.clock.fastForward(7000);
  expect(
    await page.evaluate(() =>
      (window as unknown as { beeps: () => number }).beeps(),
    ),
  ).toBe(count);
});
