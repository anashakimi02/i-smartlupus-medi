import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { MobileDrawer } from "./MobileDrawer";

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
        name="Anas Hakimi"
        onLogOut={() => {}}
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
    expect(screen.queryByText("Log Keluar")).not.toBeInTheDocument();
  });

  it("renders user info, theme toggle, and log out button when open", () => {
    renderDrawer({ open: true, role: "admin", name: "Anas Hakimi" });
    expect(screen.getByText("Anas Hakimi")).toBeInTheDocument();
    expect(screen.getByText("Pentadbir")).toBeInTheDocument();
    expect(screen.getByText("Log Keluar")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("fires onLogOut when log out button clicked", () => {
    const onLogOut = vi.fn();
    renderDrawer({ onLogOut });
    fireEvent.click(screen.getByText("Log Keluar"));
    expect(onLogOut).toHaveBeenCalledOnce();
  });

  it("fires onOpenChange(false) when close button clicked", () => {
    const onOpenChange = vi.fn();
    renderDrawer({ onOpenChange });
    fireEvent.click(screen.getByLabelText("Tutup"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
