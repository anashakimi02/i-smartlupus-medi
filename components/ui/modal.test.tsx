import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./modal";

describe("Modal", () => {
  it("renders trigger and opens content on click", () => {
    render(
      <Modal trigger={<button>Open</button>} title="Sahkan">
        <p>Body text</p>
      </Modal>
    );
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Sahkan")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });

  it("closes when the close button is clicked", () => {
    render(
      <Modal trigger={<button>Open</button>} title="T">
        <p>Body</p>
      </Modal>
    );
    fireEvent.click(screen.getByText("Open"));
    fireEvent.click(screen.getByRole("button", { name: /tutup/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <Modal trigger={<button>Open</button>} title="T" description="Pilih tindakan">
        <p>Body</p>
      </Modal>
    );
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByText("Pilih tindakan")).toBeInTheDocument();
  });

  it("opens without a trigger when controlled open is true", () => {
    render(
      <Modal open title="Berjaya">
        <p>Kandungan</p>
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Berjaya")).toBeInTheDocument();
  });

  it("stays closed when controlled open is false", () => {
    render(
      <Modal open={false} title="Berjaya">
        <p>Kandungan</p>
      </Modal>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onOpenChange(false) when the close button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Berjaya">
        <p>Kandungan</p>
      </Modal>
    );
    fireEvent.click(screen.getByRole("button", { name: /tutup/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
