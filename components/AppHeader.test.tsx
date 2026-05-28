import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { AppHeader } from "./AppHeader";

function renderHeader(props: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  return render(
    <ThemeProvider>
      <AppHeader
        sidebarCollapsed={false}
        onToggleSidebar={() => {}}
        onOpenDrawer={() => {}}
        name="Anas Hakimi"
        role="admin"
        onLogOut={() => {}}
        {...props}
      />
    </ThemeProvider>
  );
}

describe("AppHeader", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("renders the Jata Negara logo with descriptive alt text", () => {
    renderHeader();
    expect(screen.getByAltText("Jata Negara Malaysia")).toBeInTheDocument();
  });

  it("renders the three kepala surat lines", () => {
    renderHeader();
    expect(screen.getByText("i-SMARTLUPUS")).toBeInTheDocument();
    expect(screen.getByText("Hospital Besut")).toBeInTheDocument();
    expect(screen.getByText("Terengganu")).toBeInTheDocument();
  });

  it("renders ThemeToggle", () => {
    renderHeader();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("renders chevron button for desktop with visibility classes", () => {
    renderHeader({ sidebarCollapsed: false });
    const btn = screen.getByLabelText("Runtuhkan bar sisi");
    expect(btn.className).toMatch(/hidden md:inline-flex/);
  });

  it("swaps chevron direction when sidebarCollapsed is true", () => {
    renderHeader({ sidebarCollapsed: true });
    expect(screen.getByLabelText("Kembangkan bar sisi")).toBeInTheDocument();
  });

  it("renders hamburger button for mobile", () => {
    renderHeader();
    expect(screen.getByLabelText("Buka menu")).toBeInTheDocument();
  });

  it("fires onToggleSidebar when chevron clicked", () => {
    const onToggleSidebar = vi.fn();
    renderHeader({ onToggleSidebar });
    fireEvent.click(screen.getByLabelText("Runtuhkan bar sisi"));
    expect(onToggleSidebar).toHaveBeenCalledOnce();
  });

  it("fires onOpenDrawer when hamburger clicked", () => {
    const onOpenDrawer = vi.fn();
    renderHeader({ onOpenDrawer });
    fireEvent.click(screen.getByLabelText("Buka menu"));
    expect(onOpenDrawer).toHaveBeenCalledOnce();
  });

  it("renders ProfileMenu trigger with the user's name", () => {
    renderHeader({ name: "Anas Hakimi" });
    expect(screen.getByLabelText(/Menu profil Anas Hakimi/i)).toBeInTheDocument();
  });
});
