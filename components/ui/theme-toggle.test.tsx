import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "./theme-toggle";

function withProvider(ui: React.ReactElement) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("renders three segments labelled Sistem, Terang, Gelap", () => {
    withProvider(<ThemeToggle />);
    expect(screen.getByRole("radio", { name: "Sistem" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Terang" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Gelap" })).toBeInTheDocument();
  });

  it("selecting Gelap adds dark class to html", () => {
    withProvider(<ThemeToggle />);
    fireEvent.click(screen.getByRole("radio", { name: "Gelap" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("marks the active segment with aria-checked=true", () => {
    withProvider(<ThemeToggle />);
    fireEvent.click(screen.getByRole("radio", { name: "Terang" }));
    expect(screen.getByRole("radio", { name: "Terang" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Sistem" })).toHaveAttribute("aria-checked", "false");
  });
});
