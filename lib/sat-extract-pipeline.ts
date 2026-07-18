/**
 * @deprecated Implementation moved to sat-single-shot-pipeline.ts (AP-style single shot).
 * This module re-exports for backward compatibility.
 */
export {
  runSatSectionExtractPipeline,
  runSatSingleShotExtract,
  runSatBucketExtractPipeline,
  buildSatSingleModuleUserPrompt,
  buildSatSectionUserPrompt,
  type SatSectionExtractor,
  type SatSectionPipelineInput,
  type SatSectionPipelineResult,
  type SatSingleShotInput,
  type SatSingleShotResult,
  type SatBucketExtractor,
  type SatBucketPipelineInput,
  type SatBucketPipelineResult,
} from "@/lib/sat-single-shot-pipeline";
