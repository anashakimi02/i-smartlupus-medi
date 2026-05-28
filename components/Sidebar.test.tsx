import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Sidebar from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("Sidebar", () => {
  it("renders nav items for the role", () => {
    render(<Sidebar role="admin" collapsed={false} />);
    expect(screen.getByText("Utama")).toBeInTheDocument();
    expect(screen.getByText("Pengguna")).toBeInTheDocument();
    expect(screen.getByText("Semua")).toBeInTheDocument();
    expect(screen.getByText("Profil")).toBeInTheDocument();
  });

  it("hides labels when collapsed", () => {
    render(<Sidebar role="admin" collapsed={true} />);
    expect(screen.queryByText("Utama")).not.toBeInTheDocument();
  });

  it("does not render a collapse toggle button (AppHeader owns it)", () => {
    render(<Sidebar role="admin" collapsed={false} />);
    expect(screen.queryByLabelText("Runtuhkan bar sisi")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Kembangkan bar sisi")).not.toBeInTheDocument();
  });

  it("does not render profile/logout (ProfileMenu in navbar owns those)", () => {
    render(<Sidebar role="admin" collapsed={false} />);
    expect(screen.queryByText(/Log Keluar/i)).not.toBeInTheDocument();
  });

  it("marks the active route with aria-current", () => {
    render(<Sidebar role="admin" collapsed={false} />);
    const utamaLink = screen.getByText("Utama").closest("a");
    expect(utamaLink).toHaveAttribute("aria-current", "page");
  });
});
