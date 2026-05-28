import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { MobileDrawer } from "./MobileDrawer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

function renderDrawer(props: Partial<React.ComponentProps<typeof MobileDrawer>> = {}) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  return render(
    <ThemeProvider>
      <MobileDrawer
        open={true}
        onOpenChange={() => {}}
        role="admin"
        {...props}
      />
    </ThemeProvider>
  );
}

describe("MobileDrawer", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("does not render panel content when closed", () => {
    renderDrawer({ open: false });
    expect(screen.queryByText("i-SMARTLUPUS")).not.toBeInTheDocument();
  });

  it("renders header content and nav items when open", () => {
    renderDrawer({ open: true, role: "admin" });
    expect(screen.getByText("i-SMARTLUPUS")).toBeInTheDocument();
    expect(screen.getByText("Hospital Besut")).toBeInTheDocument();
  });

  it("does not render profile/logout (ProfileMenu in navbar owns those)", () => {
    renderDrawer({ open: true });
    expect(screen.queryByText("Log Keluar")).not.toBeInTheDocument();
  });

  it("does not render a theme toggle (AppHeader owns it)", () => {
    renderDrawer({ open: true });
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("fires onOpenChange(false) when close button clicked", () => {
    const onOpenChange = vi.fn();
    renderDrawer({ onOpenChange });
    fireEvent.click(screen.getByLabelText("Tutup"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
