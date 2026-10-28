import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { Dropdown } from "./dropdown";
import { Input } from "./input";
describe("accessible controls", () => {
  it("associates input label and validation message", () => {
    render(<Input label="Contact name" error="Enter your name" />);
    const input = screen.getByRole("textbox", { name: "Contact name" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter your name");
  });
  it("provides native dropdown choices", () => {
    render(
      <Dropdown
        label="Neighbourhood"
        options={[
          { value: "", label: "All neighbourhoods" },
          { value: "jabi", label: "Jabi" },
        ]}
      />,
    );
    const select = screen.getByRole("combobox", { name: "Neighbourhood" });
    fireEvent.change(select, { target: { value: "jabi" } });
    expect(select).toHaveValue("jabi");
  });
  it("disables a busy button without removing its name", () => {
    render(<Button loading>Continue</Button>);
    expect(screen.getByRole("button", { name: /Continue/ })).toBeDisabled();
  });
});

it("keeps caller descriptions alongside validation errors", () => {
  render(
    <>
      <p id="existing-help">Use your full name</p>
      <Input label="Name" aria-describedby="existing-help" error="Required" />
    </>,
  );
  expect(
    screen.getByRole("textbox", { name: "Name" }),
  ).toHaveAccessibleDescription("Use your full name Required");
});
