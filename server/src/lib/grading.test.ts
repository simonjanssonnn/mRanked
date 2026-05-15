import { describe, expect, it } from "vitest";
import { grade, parseFlexibleNumber } from "./grading.js";

describe("parseFlexibleNumber", () => {
  it("parses plain integers", () => {
    expect(parseFlexibleNumber("42")).toBe(42);
  });
  it("parses decimals", () => {
    expect(parseFlexibleNumber("3.14")).toBeCloseTo(3.14);
  });
  it("accepts comma decimals (European)", () => {
    expect(parseFlexibleNumber("3,14")).toBeCloseTo(3.14);
  });
  it("parses fractions", () => {
    expect(parseFlexibleNumber("1/2")).toBe(0.5);
    expect(parseFlexibleNumber("-3/4")).toBe(-0.75);
  });
  it("parses scientific notation", () => {
    expect(parseFlexibleNumber("1e3")).toBe(1000);
    expect(parseFlexibleNumber("-1.5e-2")).toBeCloseTo(-0.015);
  });
  it("trims whitespace", () => {
    expect(parseFlexibleNumber("  17 ")).toBe(17);
  });
  it("rejects division by zero", () => {
    expect(parseFlexibleNumber("3/0")).toBeNull();
  });
  it("rejects empty strings", () => {
    expect(parseFlexibleNumber("")).toBeNull();
    expect(parseFlexibleNumber("   ")).toBeNull();
  });
  it("rejects letters / garbage", () => {
    expect(parseFlexibleNumber("abc")).toBeNull();
    expect(parseFlexibleNumber("12abc")).toBeNull();
  });
});

describe("grade — numeric", () => {
  it("exact match → correct, accuracy 1", () => {
    const r = grade({ answerType: "numeric", submitted: "42", correctAnswer: "42" });
    expect(r.correct).toBe(true);
    expect(r.accuracy).toBe(1);
  });
  it("within tolerance → correct", () => {
    const r = grade({
      answerType: "numeric", submitted: "3.1416",
      correctAnswer: "3.1415927", tolerance: 0.001,
    });
    expect(r.correct).toBe(true);
  });
  it("just outside tolerance → wrong but partial accuracy", () => {
    const r = grade({
      answerType: "numeric", submitted: "3.2",
      correctAnswer: "3", tolerance: 0.01,
    });
    expect(r.correct).toBe(false);
    expect(r.accuracy).toBeGreaterThan(0);
    expect(r.accuracy).toBeLessThan(1);
  });
  it("far outside → accuracy 0", () => {
    const r = grade({
      answerType: "numeric", submitted: "1000",
      correctAnswer: "1", tolerance: 1e-6,
    });
    expect(r.correct).toBe(false);
    expect(r.accuracy).toBe(0);
  });
  it("accepts fractions when the canonical is decimal", () => {
    const r = grade({ answerType: "numeric", submitted: "1/2", correctAnswer: "0.5" });
    expect(r.correct).toBe(true);
  });
  it("accepts comma decimals", () => {
    const r = grade({ answerType: "numeric", submitted: "0,5", correctAnswer: "0.5" });
    expect(r.correct).toBe(true);
  });
  it("acceptableForms fallback for unparseable submissions", () => {
    const r = grade({
      answerType: "numeric",
      submitted: "Pi",
      correctAnswer: "3.14159",
      acceptableForms: ["pi"],
    });
    expect(r.correct).toBe(true);
  });
  it("acceptableForms match is case-insensitive and whitespace-tolerant", () => {
    const r = grade({
      answerType: "numeric",
      submitted: "  E^2  ",
      correctAnswer: "7.389",
      acceptableForms: ["e^2"],
    });
    expect(r.correct).toBe(true);
  });
  it("null submission → wrong, accuracy 0", () => {
    const r = grade({ answerType: "numeric", submitted: null, correctAnswer: "1" });
    expect(r.correct).toBe(false);
    expect(r.accuracy).toBe(0);
  });
  it("empty-string submission → wrong", () => {
    const r = grade({ answerType: "numeric", submitted: "", correctAnswer: "1" });
    expect(r.correct).toBe(false);
  });
  it("whitespace-only submission → wrong", () => {
    const r = grade({ answerType: "numeric", submitted: "   ", correctAnswer: "1" });
    expect(r.correct).toBe(false);
  });
  it("default tolerance is tight (1e-6)", () => {
    const r1 = grade({ answerType: "numeric", submitted: "0.5", correctAnswer: "0.5000005" });
    expect(r1.correct).toBe(true);
    const r2 = grade({ answerType: "numeric", submitted: "0.5", correctAnswer: "0.51" });
    expect(r2.correct).toBe(false);
  });
  it("loose tolerance is honoured", () => {
    const r = grade({
      answerType: "numeric", submitted: "9.8",
      correctAnswer: "9.81", tolerance: 0.05,
    });
    expect(r.correct).toBe(true);
  });
  it("negative numbers compared correctly", () => {
    const r = grade({ answerType: "numeric", submitted: "-7", correctAnswer: "-7" });
    expect(r.correct).toBe(true);
  });
  it("partial credit is monotonic in distance from target", () => {
    const close = grade({
      answerType: "numeric", submitted: "2.0",
      correctAnswer: "2", tolerance: 0.001,
    });
    const closer = grade({
      answerType: "numeric", submitted: "2.5",
      correctAnswer: "2", tolerance: 0.001,
    });
    const far = grade({
      answerType: "numeric", submitted: "10",
      correctAnswer: "2", tolerance: 0.001,
    });
    expect(close.accuracy).toBeGreaterThanOrEqual(closer.accuracy);
    expect(closer.accuracy).toBeGreaterThan(far.accuracy);
  });
});

describe("grade — multiple_choice", () => {
  it("exact-string match → correct", () => {
    const r = grade({
      answerType: "multiple_choice", submitted: "x + 3", correctAnswer: "x + 3",
    });
    expect(r.correct).toBe(true);
    expect(r.accuracy).toBe(1);
  });
  it("case-insensitive", () => {
    const r = grade({
      answerType: "multiple_choice", submitted: "X + 3", correctAnswer: "x + 3",
    });
    expect(r.correct).toBe(true);
  });
  it("whitespace-tolerant", () => {
    const r = grade({
      answerType: "multiple_choice", submitted: "  x  +  3  ", correctAnswer: "x + 3",
    });
    expect(r.correct).toBe(true);
  });
  it("wrong option → incorrect, accuracy 0", () => {
    const r = grade({
      answerType: "multiple_choice", submitted: "x - 3", correctAnswer: "x + 3",
    });
    expect(r.correct).toBe(false);
    expect(r.accuracy).toBe(0);
  });
  it("null submission → wrong", () => {
    const r = grade({
      answerType: "multiple_choice", submitted: null, correctAnswer: "x + 3",
    });
    expect(r.correct).toBe(false);
  });
  it("empty submission → wrong", () => {
    const r = grade({
      answerType: "multiple_choice", submitted: "", correctAnswer: "x + 3",
    });
    expect(r.correct).toBe(false);
  });
});
