import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttentionTable } from "./AttentionTable";
import type { AttentionRow } from "@/lib/dashboard/pemohon";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
});

describe("AttentionTable", () => {
  it("renders empty state when rows is empty", () => {
    render(<AttentionTable rows={[]} />);
    expect(screen.getByText(/tiada permohonan memerlukan perhatian/i)).toBeInTheDocument();
  });

  it("renders rose-toned severity dot for ditolak rows", () => {
    const rows: AttentionRow[] = [
      {
        id: "t1",
        ticket_no: "TIC-001",
        asset_name: "Komputer Riba",
        reason: "ditolak",
        age_days: 5,
        rejection_reason: "Foto tidak jelas",
      },
    ];
    const { container } = render(<AttentionTable rows={rows} />);
    expect(container.querySelector('[data-severity="ditolak"]')).not.toBeNull();
  });

  it("renders amber-toned severity dot for menunggu_lama rows", () => {
    const rows: AttentionRow[] = [
      {
        id: "t2",
        ticket_no: "TIC-002",
        asset_name: "Pencetak",
        reason: "menunggu_lama",
        age_days: 12,
        rejection_reason: null,
      },
    ];
    const { container } = render(<AttentionTable rows={rows} />);
    expect(container.querySelector('[data-severity="menunggu_lama"]')).not.toBeNull();
  });

  it("renders rejection_reason text for ditolak rows", () => {
    const rows: AttentionRow[] = [
      {
        id: "t3",
        ticket_no: "TIC-003",
        asset_name: "Mesin Faks",
        reason: "ditolak",
        age_days: 5,
        rejection_reason: "Sila lampirkan invois pembelian",
      },
    ];
    render(<AttentionTable rows={rows} />);
    expect(screen.getByText(/sila lampirkan invois pembelian/i)).toBeInTheDocument();
  });

  it("renders 'Menunggu N hari' text for menunggu_lama rows", () => {
    const rows: AttentionRow[] = [
      {
        id: "t4",
        ticket_no: "TIC-004",
        asset_name: "Skanner",
        reason: "menunggu_lama",
        age_days: 14,
        rejection_reason: null,
      },
    ];
    render(<AttentionTable rows={rows} />);
    expect(screen.getByText(/menunggu 14 hari/i)).toBeInTheDocument();
  });

  it("navigates to /semua/${id} when a row is clicked", () => {
    const rows: AttentionRow[] = [
      {
        id: "abc-123",
        ticket_no: "TIC-005",
        asset_name: "Test",
        reason: "ditolak",
        age_days: 5,
        rejection_reason: "reason",
      },
    ];
    render(<AttentionTable rows={rows} />);
    fireEvent.click(screen.getByText("TIC-005"));
    expect(pushMock).toHaveBeenCalledWith("/semua/abc-123");
  });
});
