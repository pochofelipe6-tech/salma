import { test, expect } from "@playwright/test";
import { login } from "./login-helper";
test("anonymous access redirects to login and invalid credentials are rejected", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Tu camino empieza aquí." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.getByLabel("Correo electrónico").fill("admin@velo.app");
  await page.getByLabel("Contraseña", { exact: true }).fill("incorrecta");
  await page
    .getByRole("button", { name: "Entrar como conductor", exact: true })
    .click();
  await expect(page.locator(".login-error")).toContainText("no corresponden");
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.goto("/conductor");
  await expect(
    page.getByRole("heading", { name: "Tu camino empieza aquí." }),
  ).toBeVisible();
});
test("roles route correctly, persist on refresh, and logout prevents returning", async ({
  page,
}) => {
  await login(page, "conductor");
  await expect(page.getByLabel("Tu nombre")).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/conductor$/);
  await expect(page.locator(".shell")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Tu nombre")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu camino empieza aquí." }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await login(page, "admin");
  await expect(
    page.getByRole("heading", { name: "Cada kilómetro, bajo control." }),
  ).toBeVisible();
  await page.goto("/conductor");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator(".driver-app")).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
});
test("demo autofill, expired session and mobile layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Usar cuenta de prueba" }).click();
  await expect(page.getByLabel("Correo electrónico")).toHaveValue(
    "conductor@velo.app",
  );
  await page
    .getByRole("button", { name: "Entrar como conductor", exact: true })
    .click();
  await expect(page).toHaveURL(/\/conductor$/);
  await page.evaluate(() => {
    const key = "velo-demo-session";
    const s = JSON.parse(sessionStorage.getItem(key)!);
    s.expiresAt = Date.now() - 1000;
    sessionStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Tu camino empieza aquí." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({
    path: "test-results/login-desktop.png",
    fullPage: true,
  });
});
