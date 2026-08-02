import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PasswordChecklist } from "./password-checklist";

const LABELS = [
  "12 aksara atau lebih",
  "Satu huruf besar (A-Z)",
  "Satu huruf kecil (a-z)",
  "Satu nombor (0-9)",
  "Satu simbol (!@#$...)",
];

describe("PasswordChecklist", () => {
  it("lists all five rules in order before anything is typed", () => {
    render(<PasswordChecklist password="" />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent?.replace(/dipenuhi|belum dipenuhi/, "").trim()))
      .toEqual(LABELS);
  });

  it("marks every rule unmet for an empty password", () => {
    render(<PasswordChecklist password="" />);
    expect(screen.getAllByText("belum dipenuhi")).toHaveLength(5);
    expect(screen.queryAllByText("dipenuhi")).toHaveLength(0);
  });

  it("marks every rule met for a compliant password", () => {
    render(<PasswordChecklist password="Hospital#2026x" />);
    expect(screen.getAllByText("dipenuhi")).toHaveLength(5);
    expect(screen.queryAllByText("belum dipenuhi")).toHaveLength(0);
  });

  it("reflects a partially compliant password rule by rule", () => {
    // 12 chars, has upper + lower, no digit, no symbol.
    render(<PasswordChecklist password="HospitalBesut" />);
    expect(screen.getAllByText("dipenuhi")).toHaveLength(3);
    expect(screen.getAllByText("belum dipenuhi")).toHaveLength(2);
  });

  it("announces changes to screen readers", () => {
    const { container } = render(<PasswordChecklist password="" />);
    expect(container.querySelector("[aria-live='polite']")).toBeInTheDocument();
  });

  it("distinguishes met from unmet by icon, not colour alone", () => {
    const { container: empty } = render(<PasswordChecklist password="" />);
    const { container: full } = render(<PasswordChecklist password="Hospital#2026x" />);
    // Different lucide icons render different <svg class="lucide-*"> names.
    const iconName = (c: HTMLElement) => c.querySelector("svg")?.getAttribute("class") ?? "";
    expect(iconName(empty)).not.toBe(iconName(full));
  });
});
