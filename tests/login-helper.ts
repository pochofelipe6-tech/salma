import { expect, type Page } from "@playwright/test";
export async function login(
  page: Page,
  role: "admin" | "conductor" = "conductor",
) {
  await page.goto("/");
  await page
    .getByRole("button", {
      name:
        role === "admin"
          ? "Administrador Mi organización"
          : "Conductor Mi recorrido",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Correo electrónico")
    .fill(role === "admin" ? "admin@velo.app" : "conductor@velo.app");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(role === "admin" ? "Admin123!" : "Conductor123!");
  await page
    .getByRole("button", {
      name:
        role === "admin"
          ? "Entrar como administrador"
          : "Entrar como conductor",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(role === "admin" ? /\/admin$/ : /\/conductor$/);
}
