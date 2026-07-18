#!/usr/bin/env node
/**
 * SAT PDF eval harness — mock-first (default) or --live Gemini.
 *
 * Usage:
 *   npm run eval:sat -- --pdf ./fixtures/sat/rw-practice.pdf --subject SAT_RW --format single_module --module-counts '{"rw1":27}'
 *   npm run eval:sat:live -- --pdf ./fixtures/sat/rw-practice.pdf --subject SAT_RW --format single_module
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEvalContext,
  evaluatePipelineResult,
  parseEvalCliArgs,
  runEvalExtraction,
} from "../lib/sat-pdf-eval.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

async function main() {
  const started = Date.now();
  let output;

  try {
    const args = parseEvalCliArgs(process.argv.slice(2));
    const ctx = buildEvalContext(args);
    const mode = args.live ? "live" : "mock";

    const pdfPath = path.isAbsolute(args.pdf)
      ? args.pdf
      : path.resolve(projectRoot, args.pdf);

    if (!fs.existsSync(pdfPath)) {
      output = {
        ok: false,
        mode,
        phase: "extract",
        errorCode: "PDF_NOT_FOUND",
        error: `PDF not found: ${pdfPath}`,
        subject: ctx.subject,
        format: ctx.resolvedSatFormat,
        adaptive: ctx.effectiveAdaptiveMode,
        sectionFilter: ctx.sectionFilter,
        questionCount: 0,
        moduleReport: {
          rw1: 0,
          rw2: 0,
          rw2Easy: 0,
          rw2Hard: 0,
          math1: 0,
          math2: 0,
          math2Easy: 0,
          math2Hard: 0,
        },
        emptyBucketKeys: [],
        durationMs: Date.now() - started,
        hints: ["Place your PDF at fixtures/sat/rw-practice.pdf (see fixtures/sat/README.md)"],
      };
      console.log(JSON.stringify(output));
      process.exit(1);
      return;
    }

    let pdfPart;
    if (mode === "mock") {
      pdfPart = { text: "mock-pdf-placeholder" };
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        output = {
          ok: false,
          mode,
          phase: "extract",
          errorCode: "MISSING_API_KEY",
          error: "GEMINI_API_KEY not set in .env.local",
          subject: ctx.subject,
          format: ctx.resolvedSatFormat,
          adaptive: ctx.effectiveAdaptiveMode,
          sectionFilter: ctx.sectionFilter,
          questionCount: 0,
          moduleReport: {
            rw1: 0,
            rw2: 0,
            rw2Easy: 0,
            rw2Hard: 0,
            math1: 0,
            math2: 0,
            math2Easy: 0,
            math2Hard: 0,
          },
          emptyBucketKeys: [],
          durationMs: Date.now() - started,
          hints: ["Set GEMINI_API_KEY in .env.local for --live mode"],
        };
        console.log(JSON.stringify(output));
        process.exit(1);
        return;
      }
      const buffer = fs.readFileSync(pdfPath);
      const { buildPdfPart } = await import("../lib/gemini-client.ts");
      pdfPart = await buildPdfPart({
        apiKey,
        buffer,
        mimeType: "application/pdf",
        displayName: path.basename(pdfPath),
      });
    }

    const pipelineInput = await runEvalExtraction({
      ctx,
      pdfPart,
      apiKey: process.env.GEMINI_API_KEY ?? "mock-key",
      mode,
    });

    output = evaluatePipelineResult(
      pipelineInput,
      {
        subject: ctx.subject,
        satFormat: ctx.resolvedSatFormat,
        effectiveAdaptiveMode: ctx.effectiveAdaptiveMode,
        sectionFilter: ctx.sectionFilter,
        userModuleCounts: ctx.userModuleCounts,
        mode,
      },
      Date.now() - started
    );
  } catch (err) {
    output = {
      ok: false,
      mode: "mock",
      phase: "extract",
      errorCode: "EVAL_ERROR",
      error: err instanceof Error ? err.message : String(err),
      subject: "SAT_RW",
      format: "single_module",
      adaptive: "none",
      sectionFilter: "rw",
      questionCount: 0,
      moduleReport: {
        rw1: 0,
        rw2: 0,
        rw2Easy: 0,
        rw2Hard: 0,
        math1: 0,
        math2: 0,
        math2Easy: 0,
        math2Hard: 0,
      },
      emptyBucketKeys: [],
      durationMs: Date.now() - started,
      hints: [],
    };
  }

  console.log(JSON.stringify(output));
  process.exit(output.ok ? 0 : 1);
}

main();
