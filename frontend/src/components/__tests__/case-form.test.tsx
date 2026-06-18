import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CaseForm } from "../case-form";

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("CaseForm", () => {
  it("renders all fields", () => {
    render(<CaseForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toBeInTheDocument();
    expect(screen.getByLabelText("Budget / hour")).toBeInTheDocument();
  });

  it("blocks submit and shows a validation error for a too-short title", async () => {
    const onSubmit = vi.fn();
    render(<CaseForm onSubmit={onSubmit} />);

    fill("Title", "ab");
    fill("Subject", "Maths");
    fill("Level", "GCSE");
    fill("Location", "London");
    fill("Budget / hour", "30");
    fireEvent.submit(screen.getByRole("form", { name: "Case form" }));

    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits parsed values when the form is valid", async () => {
    const onSubmit = vi.fn();
    render(<CaseForm onSubmit={onSubmit} />);

    fill("Title", "Algebra help");
    fill("Subject", "Maths");
    fill("Level", "GCSE");
    fill("Location", "London");
    fill("Budget / hour", "30");
    fireEvent.submit(screen.getByRole("form", { name: "Case form" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: "Algebra help",
      subject: "Maths",
      budgetPerHour: 30,
    });
  });
});
