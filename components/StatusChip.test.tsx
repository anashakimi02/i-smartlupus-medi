import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusChip } from "./StatusChip";

describe("StatusChip", () => {
  it("renders Malay label for each status", () => {
    const cases = [
      { status: "BARU", label: "Baru" },
      { status: "menunggu_semakan", label: "Menunggu Semakan" },
      { status: "proses_pelupusan", label: "Proses Pelupusan" },
      { status: "selesai", label: "Selesai" },
      { status: "ditolak", label: "Ditolak" },
    ] as const;

    for (const { status, label } of cases) {
      const { unmount } = render(<StatusChip status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("applies 'done' tone for selesai (emerald progression deepest)", () => {
    render(<StatusChip status="selesai" />);
    const chip = screen.getByText("Selesai");
    expect(chip.className).toMatch(/chip-done/);
  });

  it("applies 'rejected' tone for ditolak", () => {
    render(<StatusChip status="ditolak" />);
    const chip = screen.getByText("Ditolak");
    expect(chip.className).toMatch(/chip-rejected/);
  });
});
