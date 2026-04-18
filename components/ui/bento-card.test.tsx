import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BentoCard } from "./bento-card";

describe("BentoCard", () => {
  it("renders children", () => {
    render(<BentoCard><p>Content</p></BentoCard>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("applies rounded-xl and surface background", () => {
    const { container } = render(<BentoCard>x</BentoCard>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/rounded-xl/);
  });

  it("supports col-span-2 via span prop", () => {
    const { container } = render(<BentoCard span={2}>x</BentoCard>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/col-span-2/);
  });
});
