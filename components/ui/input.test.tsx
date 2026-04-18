import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./input";

describe("Input", () => {
  it("renders with associated label and helper text", () => {
    render(
      <Input
        id="ic"
        label="No. Kad Pengenalan"
        helper="12 digit tanpa sempang"
      />
    );
    const input = screen.getByLabelText("No. Kad Pengenalan");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-describedby");
    expect(screen.getByText("12 digit tanpa sempang")).toBeInTheDocument();
  });

  it("shows error message and sets aria-invalid when error prop is set", () => {
    render(
      <Input
        id="ic"
        label="No. IC"
        error="IC tidak sah"
      />
    );
    const input = screen.getByLabelText("No. IC");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("IC tidak sah");
  });

  it("applies 48px height via min-h-touch", () => {
    render(<Input id="x" label="X" />);
    expect(screen.getByLabelText("X")).toHaveClass("min-h-touch");
  });

  it("renders required indicator when required", () => {
    render(<Input id="x" label="Nama" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders trailing slot when provided", () => {
    render(
      <Input
        id="pw"
        label="Kata Laluan"
        trailing={<button type="button" aria-label="Tukar kelihatan">X</button>}
      />
    );
    expect(screen.getByLabelText("Tukar kelihatan")).toBeInTheDocument();
  });

  it("trailing slot does not break label association", () => {
    render(
      <Input
        id="pw"
        label="Kata Laluan"
        trailing={<button aria-label="toggle">T</button>}
      />
    );
    expect(screen.getByLabelText("Kata Laluan")).toBeInTheDocument();
  });
});
